export { evaluateOpportunity, type EvaluateOpportunityOptions } from "./evaluate-opportunity.js";
export { type OpportunityDossier } from "./dossier.js";
export { buildOpportunityRadar } from "./radar.js";
export {
  buildPlatformDashboard,
  loadLiveScoreReport,
  loadRetrospectiveSummary,
  loadTradingReadinessSummary,
  type PlatformDashboard,
  type LiveScoredOpportunity,
  type KgProgramInventoryRow,
  type EnrichmentSeedSummary,
  type RetrospectiveSummary,
  type TradingReadinessSummary,
} from "./platform-dashboard.js";
export {
  buildKgMetricsDashboard,
  loadEnrichHistory,
  type KgMetricsDashboard,
  type EnrichHistoryEntry,
  type KgLiveClockRow,
  type KgCoverageGaps,
  type CountBucket,
} from "./kg-metrics.js";
export {
  buildOpsDashboard,
  buildOpsRiskReport,
  createManualPosition,
  patchManualPosition,
  loadManualBook,
  type OpsDashboard,
  type MarkedManualPosition,
  type OpsAttentionItem,
  type OpsPaperPosition,
} from "./ops-dashboard.js";
export {
  loadOpsMarketRationale,
  type OpsMarketRationale,
  type ComponentRationale,
  type EvidenceCitation,
} from "./ops-rationale.js";
export {
  runEdgeScan,
  loadEdgeScanReport,
  type EdgeScanReport,
  type EdgeScanDiscoveredMarket,
  type EdgeScanUnmappedMarket,
} from "./edge-scan.js";
export {
  scoreLiveMarket,
  isSignificantEdge,
  isWatchlistEdge,
  opportunityRankScore,
  buildMarketQuestionForLive,
} from "./live-market-scoring.js";
