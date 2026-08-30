import type { BacktestCase, EdgeVsMarketReport } from "@pivotaledge/schemas";
import { EdgeVsMarketReportSchema } from "@pivotaledge/schemas";
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

import { simulateMarketBaselinePnL, simulateTradePnL } from "./pnl.js";

export type ChronologicalBacktestOptions = {
  minTrainCases?: number;
  policyConfig?: BettingPolicyConfig;
};

function toHoldoutCase(c: BacktestCase) {
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

export function runChronologicalBacktest(
  corpus: { initialBankroll: number; cases: BacktestCase[] },
  options: ChronologicalBacktestOptions = {},
): EdgeVsMarketReport {
  const config = options.policyConfig ?? DEFAULT_BETTING_POLICY;
  const minTrainCases = options.minTrainCases ?? 4;
  const sorted = [...corpus.cases].sort((a, b) => a.forecastCutoff.localeCompare(b.forecastCutoff));

  let bankroll = corpus.initialBankroll;
  let modelNetPnL = 0;
  let marketBaselineNetPnL = 0;
  let totalTrades = 0;
  let winningTrades = 0;
  const modelPreds: number[] = [];
  const marketPreds: number[] = [];
  const outcomes: (0 | 1)[] = [];
  const trades: EdgeVsMarketReport["trades"] = [];

  for (let i = minTrainCases; i < sorted.length; i++) {
    const train = sorted.slice(0, i).map(toHoldoutCase);
    const c = sorted[i]!;
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

    let stake = 0;
    let netPnL = 0;
    let grossPnL = 0;
    let feesPaid = 0;

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
      grossPnL = result.grossPnL;
      feesPaid = result.feesPaid;
      netPnL = result.netPnL;
      bankroll += netPnL;
      modelNetPnL += netPnL;
      totalTrades += 1;
      if (netPnL > 0) winningTrades += 1;
    }

    modelPreds.push(modelP);
    marketPreds.push(c.executableYesAsk);
    outcomes.push(c.resolvedApproved ? 1 : 0);

    trades.push({
      caseId: c.caseId,
      forecastCutoff: c.forecastCutoff,
      action: decision.action,
      modelProbability: modelP,
      conservativeProbability: interval.low,
      executablePrice:
        decision.action === "BET_YES" || decision.action === "BET_NO"
          ? decision.executablePrice
          : null,
      stake,
      grossPnL,
      feesPaid,
      netPnL,
      resolvedYes: c.resolvedApproved,
      marketBaselineNetPnL: baselinePnl,
    });
  }

  const modelBrier = meanBrier(modelPreds, outcomes);
  const marketBrier = meanBrier(marketPreds, outcomes);

  return EdgeVsMarketReportSchema.parse({
    kind: "edge_vs_market_report",
    generatedAt: new Date().toISOString(),
    policyVersion: config.policyVersion,
    modelVersion: MODEL_VERSION,
    initialBankroll: corpus.initialBankroll,
    finalBankroll: bankroll,
    modelNetPnL,
    marketBaselineNetPnL,
    edgeVsMarket: modelNetPnL - marketBaselineNetPnL,
    totalTrades,
    winningTrades,
    hitRate: totalTrades > 0 ? winningTrades / totalTrades : null,
    modelBrier,
    marketBrier,
    beatsMarketAfterCosts: modelNetPnL > 0 && modelNetPnL > marketBaselineNetPnL,
    trades,
  });
}
