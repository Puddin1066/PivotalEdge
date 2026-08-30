import type { OrchestrationConfig } from "@pivotaledge/schemas";

import {
  createDefaultForecastAdapter,
  createDefaultScoringAdapter,
  createFixtureKgAdapter,
  createFixtureMarketAdapter,
  createMemoryRunStore,
  createNoopEvidenceWriter,
  createNoopResearchAdapter,
} from "./adapters/index.js";
import { loadOrchestrationConfig } from "./config.js";
import type {
  EvidenceWriterPort,
  ForecastPort,
  KgPort,
  MarketPort,
  ResearchPort,
  RunStorePort,
  ScoringPort,
} from "./ports/index.js";

/** Dependency-injection container — swap ports in tests via overrides. */
export type OrchestrationContext = {
  config: OrchestrationConfig;
  market: MarketPort;
  kg: KgPort;
  forecast: ForecastPort;
  scoring: ScoringPort;
  evidenceWriter: EvidenceWriterPort;
  research: ResearchPort;
  runStore: RunStorePort;
};

export type CreateOrchestrationContextOptions = {
  config?: Partial<OrchestrationConfig>;
  overrides?: Partial<Omit<OrchestrationContext, "config">>;
};

export function createOrchestrationContext(
  options: CreateOrchestrationContextOptions = {},
): OrchestrationContext {
  const config = loadOrchestrationConfig(options.config ?? {});
  return {
    config,
    market: options.overrides?.market ?? createFixtureMarketAdapter(),
    kg: options.overrides?.kg ?? createFixtureKgAdapter(),
    forecast: options.overrides?.forecast ?? createDefaultForecastAdapter(),
    scoring: options.overrides?.scoring ?? createDefaultScoringAdapter(),
    evidenceWriter: options.overrides?.evidenceWriter ?? createNoopEvidenceWriter(),
    research: options.overrides?.research ?? createNoopResearchAdapter(),
    runStore: options.overrides?.runStore ?? createMemoryRunStore(),
  };
}
