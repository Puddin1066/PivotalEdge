import path from "node:path";

import {
  createFixtureKgAdapter,
  createFixtureMarketAdapter,
  createFixtureResearchAdapter,
  createDefaultForecastAdapter,
  createDefaultScoringAdapter,
  createInMemoryEvidenceWriter,
  createFileRunStore,
} from "../adapters/index.js";
import { createOrchestrationContext, type OrchestrationContext } from "../context.js";
import { loadOrchestrationConfig } from "../config.js";
import { createArtifactStore, type ArtifactStore } from "./artifact-store.js";
import { getSharedCheckpointer } from "./checkpointer-registry.js";

export type ApiOrchestrationBundle = {
  ctx: OrchestrationContext;
  artifacts: ArtifactStore;
  rootDir: string;
  checkpointerScope: string;
};

export type CreateApiContextOptions = {
  rootDir: string;
  configOverrides?: Parameters<typeof loadOrchestrationConfig>[0];
};

/** Web/API orchestration context — file run store, fixture research, enabled by default. */
export function createApiOrchestrationBundle(
  options: CreateApiContextOptions,
): ApiOrchestrationBundle {
  const rootDir = path.resolve(options.rootDir);
  const config = loadOrchestrationConfig({
    enabled: true,
    ...options.configOverrides,
  });

  const ctx = createOrchestrationContext({
    config,
    overrides: {
      market: createFixtureMarketAdapter(),
      kg: createFixtureKgAdapter(),
      forecast: createDefaultForecastAdapter(),
      scoring: createDefaultScoringAdapter(),
      research: createFixtureResearchAdapter(),
      evidenceWriter: createInMemoryEvidenceWriter(),
      runStore: createFileRunStore({ rootDir }),
    },
  });

  return {
    ctx,
    artifacts: createArtifactStore({ rootDir }),
    rootDir,
    checkpointerScope: rootDir,
  };
}

export function getApiCheckpointer(bundle: ApiOrchestrationBundle) {
  return getSharedCheckpointer(bundle.checkpointerScope);
}
