import type {
  PaperPortfolio,
  PaperTrade,
  ProspectiveCase,
  ProspectiveCorpus,
  ProspectiveSampleReport,
} from "@pivotaledge/schemas";
import { PaperPortfolioSchema, ProspectiveSampleReportSchema } from "@pivotaledge/schemas";
import {
  fitCalibrationWeights,
  meanBrier,
  MODEL_VERSION,
  predictHoldoutCase,
  probabilityInterval,
  type CalibrationWeights,
} from "@pivotaledge/models";
import {
  decideBetAction,
  DEFAULT_BETTING_POLICY,
  stakeFraction,
  type BettingPolicyConfig,
  type EdgeEstimate,
  type RiskAssessment,
} from "@pivotaledge/scoring";

import { simulateTradePnL } from "./pnl.js";

function toHoldoutCase(c: ProspectiveCase) {
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
  return {
    executableYesPrice: yesAsk,
    executableNoPrice: noAsk,
    netEdgeYes: conservativeP - yesAsk - feeRate,
    netEdgeNo: 1 - intervalHigh - noAsk - feeRate,
    marketImpliedProbability: yesAsk,
    marketAdjustedProbability: modelP * 0.85 + yesAsk * 0.15,
  };
}

function buildRisks(c: ProspectiveCase): RiskAssessment {
  return {
    evidenceConfidence: c.evidenceConfidence,
    resolutionRisk: c.applicationFiled ? "moderate" : "low",
    latentInformationRisk: c.supportingEvidenceCount >= 2 ? "low" : "moderate",
  };
}

/**
 * Prospective paper trading: freeze calibration weights on cases before freezeCutoff,
 * then apply frozen model + policy forward without refitting (S9 gate).
 * Simulation only — liveTradingEnabled is always false.
 */
export function runProspectivePaperSample(
  corpus: ProspectiveCorpus,
  options: { policyConfig?: BettingPolicyConfig } = {},
): ProspectiveSampleReport {
  const config = options.policyConfig ?? corpus.policyConfig ?? DEFAULT_BETTING_POLICY;
  const freeze = corpus.freezeCutoff;
  const sorted = [...corpus.cases].sort((a, b) => a.forecastCutoff.localeCompare(b.forecastCutoff));

  const train = sorted.filter((c) => c.forecastCutoff < freeze).map(toHoldoutCase);
  const prospective = sorted.filter((c) => c.forecastCutoff >= freeze);

  if (train.length < 3) {
    throw new Error(`Prospective freeze requires ≥3 train cases before ${freeze}`);
  }
  if (prospective.length < 2) {
    throw new Error(`Prospective freeze requires ≥2 out-of-sample cases after ${freeze}`);
  }

  const weights: CalibrationWeights = fitCalibrationWeights(train);
  let bankroll = corpus.initialBankroll;
  let simulatedNetPnL = 0;
  let paperTrades = 0;
  let winningTrades = 0;
  const modelPreds: number[] = [];
  const marketPreds: number[] = [];
  const outcomes: (0 | 1)[] = [];
  const trades: PaperTrade[] = [];

  for (const c of prospective) {
    const modelP = predictHoldoutCase(
      {
        phase: c.phase,
        therapeuticArea: c.therapeuticArea,
        primaryEndpointMet: c.primaryEndpointMet,
        applicationFiled: c.applicationFiled,
      },
      weights,
    );
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

    modelPreds.push(modelP);
    marketPreds.push(c.executableYesAsk);
    outcomes.push(c.resolvedApproved ? 1 : 0);

    let stake = 0;
    let netPnL: number | null = null;
    let feesPaid = 0;
    let status: PaperTrade["status"] = "cancelled";

    if (decision.action === "BET_YES" || decision.action === "BET_NO") {
      const fraction = stakeFraction(decision.netEdge, config);
      stake = Math.round(bankroll * fraction * 100) / 100;
      const result = simulateTradePnL(
        decision.action,
        decision.executablePrice,
        stake,
        c.resolvedApproved,
        config.feeRate,
      );
      feesPaid = result.feesPaid;
      netPnL = result.netPnL;
      bankroll += result.netPnL;
      simulatedNetPnL += result.netPnL;
      paperTrades += 1;
      if (result.netPnL > 0) winningTrades += 1;
      status = "resolved";
    }

    trades.push({
      id: `paper_${c.caseId}`,
      caseId: c.caseId,
      marketId: null,
      openedAt: c.forecastCutoff,
      closedAt: status === "resolved" ? c.forecastCutoff : null,
      action: decision.action,
      executablePrice:
        decision.action === "BET_YES" || decision.action === "BET_NO"
          ? decision.executablePrice
          : null,
      stake,
      modelProbability: modelP,
      conservativeProbability: interval.low,
      status: status === "cancelled" ? "cancelled" : "resolved",
      resolvedYes: c.resolvedApproved,
      netPnL,
      feesPaid,
      simulation: true,
    });
  }

  const modelBrier = meanBrier(modelPreds, outcomes);
  const marketBrier = meanBrier(marketPreds, outcomes);
  const calibrated = modelBrier <= marketBrier;
  const gatePass = calibrated && simulatedNetPnL > 0 && paperTrades > 0;

  return ProspectiveSampleReportSchema.parse({
    kind: "prospective_sample_report",
    generatedAt: new Date().toISOString(),
    freezeCutoff: freeze,
    policyVersion: config.policyVersion,
    modelVersion: MODEL_VERSION,
    calibrationStatus: "prospective",
    trainCases: train.length,
    prospectiveCases: prospective.length,
    paperTrades,
    winningTrades,
    hitRate: paperTrades > 0 ? winningTrades / paperTrades : null,
    modelBrier,
    marketBrier,
    calibrated,
    simulatedNetPnL,
    finalBankroll: bankroll,
    initialBankroll: corpus.initialBankroll,
    gatePass,
    trades,
  });
}

export function portfolioFromProspectiveReport(report: ProspectiveSampleReport): PaperPortfolio {
  const closed = report.trades.filter((t) => t.status === "resolved");
  return PaperPortfolioSchema.parse({
    id: "paper_portfolio_s9",
    label: "Prospective paper portfolio (simulation)",
    policyVersion: report.policyVersion,
    modelVersion: report.modelVersion,
    initialBankroll: report.initialBankroll,
    cash: report.finalBankroll,
    openTrades: [],
    closedTrades: closed,
    realizedNetPnL: report.simulatedNetPnL,
    updatedAt: report.generatedAt,
    liveTradingEnabled: false,
  });
}
