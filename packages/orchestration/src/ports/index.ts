import type {
  Forecast,
  MarketQuestion,
  OrderBookSnapshot,
  PredictionMarket,
  PrecedentBundle,
} from "@pivotaledge/schemas";

/** Loads market question + prediction market metadata for a run. */
export type MarketPort = {
  loadMarketFixture(relativePath: string): Promise<{
    market: PredictionMarket;
    marketQuestion: MarketQuestion;
  }>;
};

export type KgExecuteInput = {
  marketQuestion: MarketQuestion;
  forecastCutoff: string;
  therapeuticArea?: string | null;
  programFixturePaths: string[];
};

/** Knowledge-graph query execution (read path). */
export type KgPort = {
  executePlan(input: KgExecuteInput): Promise<PrecedentBundle>;
};

export type ForecastBuildInput = {
  marketQuestion: MarketQuestion;
  precedentBundle: PrecedentBundle;
  forecastCutoff: string;
  forecastId?: string;
  generatedAt?: string;
};

/** Deterministic feature + probability engine. */
export type ForecastPort = {
  buildForecast(input: ForecastBuildInput): Promise<Forecast>;
};

export type ScoringBuildInput = {
  marketQuestion: MarketQuestion;
  forecast: Forecast;
  precedentBundle: PrecedentBundle;
  yesOrderBook: OrderBookSnapshot;
  noOrderBook: OrderBookSnapshot | null;
  bankroll?: number;
  generatedAt?: string;
  policyConfig?: import("@pivotaledge/schemas").BettingPolicyConfig;
};

/** Edge + BET_* policy (unchanged by orchestration). */
export type ScoringPort = {
  buildRecommendation(input: ScoringBuildInput): Promise<import("@pivotaledge/schemas").BetRecommendation>;
  fingerprintRecommendation(
    recommendation: import("@pivotaledge/schemas").BetRecommendation,
  ): import("@pivotaledge/scoring").RecommendationFingerprint;
};

export type EvidenceWriteInput = {
  runId: string;
  records: import("@pivotaledge/schemas").EvidenceRecord[];
  programFixturePath: string;
};

export type EvidenceWriteResult = {
  newEvidenceIds: string[];
  contradictoryEvidenceIds: string[];
  fixturePath: string;
};

/** Validated evidence persistence (write path). */
export type EvidenceWriterPort = {
  writeValidated(input: EvidenceWriteInput): Promise<EvidenceWriteResult>;
};

export type ResearchExecuteInput = {
  task: import("@pivotaledge/schemas").ResearchTask;
  marketQuestion: MarketQuestion;
  forecastCutoff: string;
};

/** Targeted fetch for one research task — mockable in tests. */
export type ResearchPort = {
  executeTask(input: ResearchExecuteInput): Promise<import("@pivotaledge/schemas").EvidenceRecord[]>;
};

/** Run ledger for orchestration audit trail. */
export type RunStorePort = {
  create(run: import("@pivotaledge/schemas").OrchestrationRun): Promise<void>;
  get(runId: string): Promise<import("@pivotaledge/schemas").OrchestrationRun | null>;
  update(
    runId: string,
    patch: Partial<import("@pivotaledge/schemas").OrchestrationRun>,
  ): Promise<import("@pivotaledge/schemas").OrchestrationRun>;
  list(): Promise<import("@pivotaledge/schemas").OrchestrationRun[]>;
};
