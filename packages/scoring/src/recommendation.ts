import { createHash } from "node:crypto";

import type {
  BetRecommendation,
  Forecast,
  MarketQuestion,
  OrderBookSnapshot,
  PrecedentBundle,
} from "@pivotaledge/schemas";
import type { BettingPolicyConfig } from "@pivotaledge/schemas";
import { BetRecommendationSchema } from "@pivotaledge/schemas";

import { assessRisks } from "./confidence.js";
import { assessContractEvidence } from "@pivotaledge/kg";
import { computeEdge, extractExecutableQuotes } from "./edge.js";
import { applyContractCalibrationGate, decideBetAction, stakeFraction, type PolicyClockContext } from "./policy.js";
import { DEFAULT_BETTING_POLICY, BettingPolicyConfigSchema } from "./policy-config.js";

export type BuildRecommendationInput = {
  marketQuestion: MarketQuestion;
  forecast: Forecast;
  yesOrderBook: OrderBookSnapshot;
  noOrderBook?: OrderBookSnapshot | null;
  precedentBundle: PrecedentBundle;
  bankroll?: number;
  generatedAt?: string;
  policyConfig?: BettingPolicyConfig;
};

export function buildBetRecommendation(input: BuildRecommendationInput): BetRecommendation {
  const {
    marketQuestion,
    forecast,
    yesOrderBook,
    noOrderBook = null,
    precedentBundle,
    bankroll = 10_000,
    generatedAt = new Date().toISOString(),
    policyConfig = DEFAULT_BETTING_POLICY,
  } = input;

  const config = BettingPolicyConfigSchema.parse(policyConfig);
  const quotes = extractExecutableQuotes(yesOrderBook, noOrderBook);
  const edge = computeEdge(forecast, quotes, config);
  const risks = assessRisks(precedentBundle, quotes, config);

  const cp = precedentBundle.currentProgram;
  const decisionComponent = forecast.components.find((c) => c.name === "decision_by_T");
  const clock: PolicyClockContext | undefined = cp
    ? {
        yesBestAsk: quotes.yesAsk,
        eventDeadline: marketQuestion.eventDeadline,
        applicationAccepted: cp.applicationAccepted === true,
        acceptedAt: cp.acceptedAt ?? null,
        pdufaDate: cp.pdufaDate ?? null,
        expectedFilingAt: cp.expectedFilingAt ?? null,
        reviewProgram: cp.reviewProgram ?? "unknown",
        decisionByDeadlineP: decisionComponent?.probability ?? null,
      }
    : undefined;

  const decision = applyContractCalibrationGate(
    decideBetAction(edge, risks, config, clock),
    assessContractEvidence(marketQuestion, precedentBundle),
  );

  const bankrollFraction = stakeFraction(decision.netEdge, config);
  const recommendedStake =
    decision.action === "BET_YES" || decision.action === "BET_NO"
      ? Math.round(bankroll * bankrollFraction * 100) / 100
      : 0;
  const maximumStake = Math.round(bankroll * config.maxBankrollFraction * 100) / 100;

  const expiresAt = new Date(
    Date.parse(generatedAt) + config.recommendationTtlHours * 60 * 60 * 1000,
  ).toISOString();

  return BetRecommendationSchema.parse({
    action: decision.action,
    marketId: marketQuestion.marketId,
    generatedAt,
    expiresAt,
    modelProbability: forecast.modelProbability,
    marketAdjustedProbability: edge.marketAdjustedProbability,
    conservativeProbability: forecast.conservativeProbability,
    executablePrice: decision.executablePrice,
    maximumEntryPrice: decision.maximumEntryPrice,
    netEdge: decision.netEdge,
    recommendedStake,
    maximumStake,
    bankrollFraction,
    evidenceConfidence: risks.evidenceConfidence,
    resolutionRisk: risks.resolutionRisk,
    latentInformationRisk: risks.latentInformationRisk,
    primaryThesis: decision.primaryThesis,
    strongestCounterargument: decision.strongestCounterargument,
    invalidators: decision.invalidators,
    supportingEvidenceIds: forecast.supportingEvidenceIds,
    forecastId: forecast.id,
    orderBookSnapshotId: yesOrderBook.id,
    policyVersion: config.policyVersion,
  });
}

export type RecommendationFingerprint = {
  action: BetRecommendation["action"];
  netEdge: number;
  executablePrice: number;
  modelProbability: number;
  conservativeProbability: number;
  recommendedStake: number;
  policyVersion: string;
  contentHash: string;
};

/** Deterministic fingerprint for S6 reproducibility gate (excludes timestamps). */
export function fingerprintRecommendation(
  recommendation: BetRecommendation,
): RecommendationFingerprint {
  const payload = JSON.stringify({
    action: recommendation.action,
    netEdge: recommendation.netEdge,
    executablePrice: recommendation.executablePrice,
    modelProbability: recommendation.modelProbability,
    conservativeProbability: recommendation.conservativeProbability,
    recommendedStake: recommendation.recommendedStake,
    policyVersion: recommendation.policyVersion,
    maximumEntryPrice: recommendation.maximumEntryPrice,
    forecastId: recommendation.forecastId,
    orderBookSnapshotId: recommendation.orderBookSnapshotId,
  });
  return {
    action: recommendation.action,
    netEdge: recommendation.netEdge,
    executablePrice: recommendation.executablePrice,
    modelProbability: recommendation.modelProbability,
    conservativeProbability: recommendation.conservativeProbability,
    recommendedStake: recommendation.recommendedStake,
    policyVersion: recommendation.policyVersion,
    contentHash: createHash("sha256").update(payload).digest("hex"),
  };
}

export function fingerprintsMatch(
  a: RecommendationFingerprint,
  b: RecommendationFingerprint,
): boolean {
  return a.contentHash === b.contentHash;
}
