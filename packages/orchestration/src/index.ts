export { createOrchestrationContext, type OrchestrationContext } from "./context.js";
export { loadOrchestrationConfig, isOrchestrationEnabled, DEFAULT_ORCHESTRATION_CONFIG } from "./config.js";
export type {
  MarketPort,
  KgPort,
  ForecastPort,
  ScoringPort,
  EvidenceWriterPort,
  ResearchPort,
  RunStorePort,
} from "./ports/index.js";
export {
  createFixtureMarketAdapter,
  createFixtureKgAdapter,
  createDefaultForecastAdapter,
  createDefaultScoringAdapter,
  createInMemoryEvidenceWriter,
  createNoopEvidenceWriter,
  createNoopResearchAdapter,
  createFixtureResearchAdapter,
  createMemoryRunStore,
  createFileRunStore,
  createEnrichmentKgAdapter,
} from "./adapters/index.js";
export {
  runDeterministicPipeline,
  buildOrchestrationDiff,
  shouldStopResearch,
  planTargetedResearch,
  hasMaterialGaps,
  type DeterministicPipelineResult,
  type RunDeterministicPipelineOptions,
} from "./pipeline/deterministic-pipeline.js";
export { runEnrichmentGraph, type EnrichmentGraphResult, type RunEnrichmentGraphOptions } from "./enrichment/run-enrichment.js";
export { compileEnrichmentGraph } from "./graph/compile-graph.js";
export { EnrichmentGraphState, type EnrichmentGraphStateType } from "./graph/graph-state.js";
export { newRunId } from "./graph/nodes.js";
export { applyFieldOverrides, overridesFromEvidence } from "./enrichment/field-overrides.js";
export { needsHumanReview } from "./review/needs-human-review.js";
export {
  startOrchestrationRun,
  resumeOrchestrationRun,
  getOrchestrationRunDetail,
  getOrchestrationRunDiff,
  getOrchestrationRunEvidence,
  getLatestOrchestrationTraceForMarket,
  resolveProfileForMarket,
  listSupportedMarketIds,
  resolveOrchestrationMarketIdsForOps,
  createApiOrchestrationBundle,
  type StartOrchestrationRunInput,
  type StartOrchestrationRunResult,
  type ResumeOrchestrationRunInput,
} from "./api/orchestration-service.js";
export { evaluateInformationGaps, topGapScore } from "./gaps/evaluate-gaps.js";
export { contractRequirementsFor, CONTRACT_REQUIREMENTS } from "./gaps/contract-matrix.js";
export { validateEvidenceRecords } from "./evidence/validate.js";
export { dedupeEvidenceRecords } from "./evidence/dedupe.js";
export { dedupeWithContradictions } from "./evidence/contradictions.js";
export { inferResearchDomain, groupTasksByDomain, type ResearchDomain } from "./gaps/research-domain.js";
export { FAIL_CLOSED_GAP_FEATURES } from "./gaps/plan-research.js";
export { SYNALPHIMAB_PROFILE, SYNBETALIB_PROFILE, ENRICHMENT_AB_PROFILE_IDS, getFixtureProfile, type FixtureProfile } from "./fixtures/profiles.js";
export {
  resolveLiveProfileForMarket,
  listLiveMarketIds,
  polymarketIdFromMarketId,
} from "./services/live-market.js";
