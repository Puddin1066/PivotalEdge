import type {
  BacktestCase,
  BacktestCorpus,
  ClinicalCalibrationCorpus,
  ResolvedMarketRetroReport,
  RetrospectiveGateReport,
} from "@pivotaledge/schemas";
import { ResolvedMarketRetroReportSchema, RetrospectiveGateReportSchema } from "@pivotaledge/schemas";
import {
  fitCalibrationWeights,
  meanBrier,
  MODEL_VERSION,
  predictHoldoutCase,
  probabilityInterval,
} from "@pivotaledge/models";
import {
  decideBetAction,
  DEFAULT_BETTING_POLICY,
  stakeFraction,
  type BettingPolicyConfig,
} from "@pivotaledge/scoring";
import type { EdgeEstimate, RiskAssessment } from "@pivotaledge/scoring";

import { runChronologicalBacktest } from "./backtest.js";
import { runClinicalChronoCalibration } from "./calibration.js";
import { simulateMarketBaselinePnL, simulateTradePnL } from "./pnl.js";

export type ResolvedMarketRetroOptions = {
  minTrainCases?: number;
  policyConfig?: BettingPolicyConfig;
  askProvenance?: string;
  initialBankroll?: number;
};

function toHoldoutTrain(c: ClinicalCalibrationCorpus["cases"][number]) {
  return {
    caseId: c.caseId,
    forecastCutoff: c.forecastCutoff,
    phase: c.phase,
    therapeuticArea: c.therapeuticArea,
    primaryEndpointMet: c.primaryEndpointMet,
    applicationFiled: c.applicationFiled,
    resolvedApproved: c.resolvedApproved,
  };
}

function buildEdgeEstimate(
  conservativeP: number,
  modelP: number,
  intervalHigh: number,
  yesAsk: number,
  noAsk: number,
  feeRate: number,
): EdgeEstimate {
  const netEdgeYes = conservativeP - yesAsk - feeRate;
  const conservativeNo = 1 - intervalHigh;
  const netEdgeNo = conservativeNo - noAsk - feeRate;
  return {
    executableYesPrice: yesAsk,
    executableNoPrice: noAsk,
    netEdgeYes,
    netEdgeNo,
    marketImpliedProbability: yesAsk,
    marketAdjustedProbability: modelP * 0.85 + yesAsk * 0.15,
  };
}

function buildRisks(c: BacktestCase): RiskAssessment {
  return {
    evidenceConfidence: c.evidenceConfidence,
    resolutionRisk: c.applicationFiled ? "moderate" : "low",
    latentInformationRisk: c.supportingEvidenceCount >= 2 ? "low" : "moderate",
  };
}

/**
 * Score resolved Polymarket FDA markets using clinical weights fit only on
 * FDA chrono cases with forecastCutoff < market cutoff (no future leakage).
 */
export function runResolvedMarketRetrospective(
  clinical: ClinicalCalibrationCorpus,
  markets: BacktestCorpus,
  options: ResolvedMarketRetroOptions = {},
): ResolvedMarketRetroReport {
  const config = options.policyConfig ?? DEFAULT_BETTING_POLICY;
  const minTrainCases = options.minTrainCases ?? 8;
  const askProvenance =
    options.askProvenance ??
    "curated_pre_resolution_mid_plus_spread_proxy";
  const initialBankroll = options.initialBankroll ?? markets.initialBankroll;

  const clinicalSorted = [...clinical.cases].sort(
    (a, b) =>
      a.forecastCutoff.localeCompare(b.forecastCutoff) || a.caseId.localeCompare(b.caseId),
  );
  const marketSorted = [...markets.cases].sort(
    (a, b) =>
      a.forecastCutoff.localeCompare(b.forecastCutoff) || a.caseId.localeCompare(b.caseId),
  );

  let bankroll = initialBankroll;
  let modelNetPnL = 0;
  let marketBaselineNetPnL = 0;
  const modelPreds: number[] = [];
  const marketPreds: number[] = [];
  const outcomes: (0 | 1)[] = [];
  const cases: ResolvedMarketRetroReport["cases"] = [];

  for (const c of marketSorted) {
    const train = clinicalSorted
      .filter((row) => row.forecastCutoff < c.forecastCutoff)
      .map(toHoldoutTrain);
    if (train.length < minTrainCases) continue;

    const weights = fitCalibrationWeights(train);
    const features = {
      phase: c.phase,
      therapeuticArea: c.therapeuticArea,
      primaryEndpointMet: c.primaryEndpointMet,
      applicationFiled: c.applicationFiled,
    };
    const modelP = predictHoldoutCase(features, weights);
    const interval = probabilityInterval(modelP, c.supportingEvidenceCount);
    const edge = buildEdgeEstimate(
      interval.low,
      modelP,
      interval.high,
      c.executableYesAsk,
      c.executableNoAsk,
      config.feeRate,
    );
    const decision = decideBetAction(edge, buildRisks(c), config);

    const baselineStake = bankroll * config.maxBankrollFraction * 0.5;
    const baselinePnl = simulateMarketBaselinePnL(
      c.executableYesAsk,
      baselineStake,
      c.resolvedApproved,
      config.feeRate,
    );
    marketBaselineNetPnL += baselinePnl;

    let netPnL = 0;
    if (decision.action === "BET_YES" || decision.action === "BET_NO") {
      const fraction = stakeFraction(decision.netEdge, config);
      const stake = Math.round(bankroll * fraction * 100) / 100;
      const pnl = simulateTradePnL(
        decision.action,
        decision.executablePrice,
        stake,
        c.resolvedApproved,
        config.feeRate,
      );
      netPnL = pnl.netPnL;
      bankroll += netPnL;
      modelNetPnL += netPnL;
    }

    modelPreds.push(modelP);
    marketPreds.push(c.executableYesAsk);
    outcomes.push(c.resolvedApproved ? 1 : 0);

    cases.push({
      caseId: c.caseId,
      forecastCutoff: c.forecastCutoff,
      resolvedApproved: c.resolvedApproved,
      modelProbability: modelP,
      conservativeProbability: interval.low,
      marketImpliedProbability: c.executableYesAsk,
      executableYesAsk: c.executableYesAsk,
      executableNoAsk: c.executableNoAsk,
      action: decision.action,
      netPnL,
      marketBaselineNetPnL: baselinePnl,
      trainCasesUsed: train.length,
    });
  }

  const modelBrier = meanBrier(modelPreds, outcomes);
  const marketBrier = meanBrier(marketPreds, outcomes);
  const edgeVsMarket = modelNetPnL - marketBaselineNetPnL;

  return ResolvedMarketRetroReportSchema.parse({
    kind: "resolved_market_retro_report",
    generatedAt: new Date().toISOString(),
    modelVersion: MODEL_VERSION,
    policyVersion: config.policyVersion,
    askProvenance,
    marketCases: markets.cases.length,
    clinicalTrainPool: clinical.cases.length,
    scoredCases: cases.length,
    modelBrier,
    marketBrier,
    beatsMarketBrier: modelBrier < marketBrier,
    modelNetPnL,
    marketBaselineNetPnL,
    edgeVsMarket,
    beatsMarketAfterCosts: edgeVsMarket > 0,
    cases,
  });
}

export type RetrospectiveValidateOptions = {
  minClinicalCases?: number;
  minClinicalTestCases?: number;
  minResolvedScored?: number;
  /** When true, edge-vs-market on resolved markets is a hard gate (default: informational). */
  requireResolvedEdge?: boolean;
};

export function buildRetrospectiveGateReport(args: {
  clinical: ReturnType<typeof runClinicalChronoCalibration>;
  resolved: ResolvedMarketRetroReport;
  synthetic: ReturnType<typeof runChronologicalBacktest>;
  options?: RetrospectiveValidateOptions;
}): RetrospectiveGateReport {
  const opts = args.options ?? {};
  const minClinicalCases = opts.minClinicalCases ?? 20;
  const minClinicalTestCases = opts.minClinicalTestCases ?? 8;
  const minResolvedScored = opts.minResolvedScored ?? 6;
  const requireResolvedEdge = opts.requireResolvedEdge ?? false;

  const blockers: string[] = [];

  const clinicalPassed =
    args.clinical.totalCases >= minClinicalCases &&
    args.clinical.testCases >= minClinicalTestCases &&
    args.clinical.beatsBaseRate;
  if (args.clinical.totalCases < minClinicalCases) {
    blockers.push(`clinical corpus < ${minClinicalCases} cases`);
  }
  if (args.clinical.testCases < minClinicalTestCases) {
    blockers.push(`clinical OOS tests < ${minClinicalTestCases}`);
  }
  if (!args.clinical.beatsBaseRate) {
    blockers.push("clinical calibrated Brier did not beat base-rate");
  }

  const resolvedRunnable = args.resolved.scoredCases >= minResolvedScored;
  if (!resolvedRunnable) {
    blockers.push(`resolved market scored cases < ${minResolvedScored}`);
  }
  // With curated ask proxies, require skill on Brier and/or edge (not both).
  const resolvedSkill =
    args.resolved.beatsMarketBrier || args.resolved.beatsMarketAfterCosts;
  if (resolvedRunnable && !resolvedSkill) {
    blockers.push(
      "resolved markets: neither model Brier nor edge-after-costs beat market baseline",
    );
  }
  if (requireResolvedEdge && !args.resolved.beatsMarketAfterCosts) {
    blockers.push("resolved-market edge after costs required but missing");
  }

  const syntheticPassed = args.synthetic.beatsMarketAfterCosts;
  if (!syntheticPassed) {
    blockers.push("synthetic S8 edge smoke failed (beatsMarketAfterCosts)");
  }

  const resolvedPassed =
    resolvedRunnable &&
    resolvedSkill &&
    (!requireResolvedEdge || args.resolved.beatsMarketAfterCosts);

  return RetrospectiveGateReportSchema.parse({
    kind: "retrospective_gate_report",
    generatedAt: new Date().toISOString(),
    passed: clinicalPassed && resolvedPassed && syntheticPassed,
    clinical: {
      passed: clinicalPassed,
      totalCases: args.clinical.totalCases,
      testCases: args.clinical.testCases,
      baseRateBrier: args.clinical.baseRateBrier,
      calibratedBrier: args.clinical.calibratedBrier,
      beatsBaseRate: args.clinical.beatsBaseRate,
    },
    resolvedMarkets: {
      passed: resolvedPassed,
      scoredCases: args.resolved.scoredCases,
      modelBrier: args.resolved.modelBrier,
      marketBrier: args.resolved.marketBrier,
      beatsMarketBrier: args.resolved.beatsMarketBrier,
      edgeVsMarket: args.resolved.edgeVsMarket,
      beatsMarketAfterCosts: args.resolved.beatsMarketAfterCosts,
      askProvenance: args.resolved.askProvenance,
      edgeInformational: !requireResolvedEdge,
    },
    syntheticEdgeSmoke: {
      passed: syntheticPassed,
      beatsMarketAfterCosts: args.synthetic.beatsMarketAfterCosts,
      edgeVsMarket: args.synthetic.edgeVsMarket,
      totalTrades: args.synthetic.totalTrades,
    },
    blockers,
  });
}
