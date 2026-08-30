import { Annotation } from "@langchain/langgraph";

import type {
  BetRecommendation,
  BettingPolicyConfig,
  Forecast,
  MarketQuestion,
  ModelInformationGap,
  PredictionMarket,
  PrecedentBundle,
  ResearchTask,
} from "@pivotaledge/schemas";
import type { RecommendationFingerprint } from "@pivotaledge/scoring";

function replace<T>(left: T, right: T | undefined): T {
  return right ?? left;
}

export const EnrichmentGraphState = Annotation.Root({
  runId: Annotation<string>,
  profileId: Annotation<string>,
  forecastCutoff: Annotation<string>,
  programFixturePaths: Annotation<string[]>,
  therapeuticArea: Annotation<string | undefined>,

  market: Annotation<PredictionMarket | null>({ default: () => null, reducer: replace }),
  marketQuestion: Annotation<MarketQuestion | null>({ default: () => null, reducer: replace }),
  precedentBundle: Annotation<PrecedentBundle | null>({ default: () => null, reducer: replace }),
  initialForecast: Annotation<Forecast | null>({ default: () => null, reducer: replace }),
  enrichedForecast: Annotation<Forecast | null>({ default: () => null, reducer: replace }),
  recommendation: Annotation<BetRecommendation | null>({ default: () => null, reducer: replace }),
  fingerprint: Annotation<RecommendationFingerprint | null>({ default: () => null, reducer: replace }),

  initialProbability: Annotation<number>({ default: () => 0, reducer: replace }),
  enrichedProbability: Annotation<number>({ default: () => 0, reducer: replace }),

  gaps: Annotation<ModelInformationGap[]>({ default: () => [], reducer: (_, right) => right }),
  researchTasks: Annotation<ResearchTask[]>({ default: () => [], reducer: (_, right) => right }),
  researchIteration: Annotation<number>({ default: () => 0, reducer: replace }),

  fieldOverrides: Annotation<Record<string, unknown>>({
    default: () => ({}),
    reducer: (left, right) => ({ ...left, ...right }),
  }),
  newEvidenceIds: Annotation<string[]>({
    default: () => [],
    reducer: (left, right) => left.concat(right),
  }),
  featuresChanged: Annotation<string[]>({
    default: () => [],
    reducer: (left, right) => [...new Set([...left, ...right])],
  }),

  shouldContinueResearch: Annotation<boolean>({ default: () => false, reducer: replace }),
  stopReason: Annotation<string>({ default: () => "pending", reducer: replace }),
  status: Annotation<string>({ default: () => "running", reducer: replace }),

  bankroll: Annotation<number>({ default: () => 10_000, reducer: replace }),
  generatedAt: Annotation<string>({ default: () => new Date().toISOString(), reducer: replace }),
  policyConfig: Annotation<BettingPolicyConfig | null>({ default: () => null, reducer: replace }),
  yesOrderBookPath: Annotation<string>({ default: () => "", reducer: replace }),
  noOrderBookPath: Annotation<string | null>({ default: () => null, reducer: replace }),

  lastValidatedCount: Annotation<number>({ default: () => 0, reducer: replace }),
  pendingEvidence: Annotation<import("@pivotaledge/schemas").EvidenceRecord[]>({
    default: () => [],
    reducer: (left, right) => left.concat(right),
  }),
  batchTasks: Annotation<import("@pivotaledge/schemas").ResearchTask[]>({
    default: () => [],
    reducer: (_, right) => right,
  }),
  contradictoryEvidenceIds: Annotation<string[]>({
    default: () => [],
    reducer: (left, right) => [...new Set([...left, ...right])],
  }),
  reviewRejected: Annotation<boolean>({ default: () => false, reducer: replace }),
});

export type EnrichmentGraphStateType = typeof EnrichmentGraphState.State;
