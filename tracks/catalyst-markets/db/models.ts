/**
 * Track-owned logical schema (Notion §6).
 * Postgres + pgvector when packages/db is wired; fixtures for MVP.
 */

export const CATALYST_TABLES = [
  "trials",
  "trial_versions",
  "assets",
  "asset_aliases",
  "targets",
  "indications",
  "companies",
  "sponsor_company_map",
  "trial_asset_edges",
  "trial_lineage_edges",
  "catalyst_events",
  "outcome_labels",
  "daily_prices",
  "benchmark_returns",
  "event_returns",
  "company_fundamentals",
  "evidence_documents",
  "embeddings",
  "predictions",
  "backtest_runs",
] as const;

export type CatalystTable = (typeof CATALYST_TABLES)[number];
