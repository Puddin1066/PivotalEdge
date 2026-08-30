import { Command } from "@langchain/langgraph";

import type {
  OrchestrationDiff,
  OrchestrationEvidenceSnapshot,
  OrchestrationRun,
  OrchestrationTrace,
} from "@pivotaledge/schemas";

import { buildOrchestrationDiff } from "../pipeline/deterministic-pipeline.js";
import { compileEnrichmentGraph } from "../graph/compile-graph.js";
import type { EnrichmentGraphStateType } from "../graph/graph-state.js";
import { newRunId } from "../graph/nodes.js";
import {
  runEnrichmentGraph,
  type EnrichmentGraphResult,
  type RunEnrichmentGraphOptions,
} from "../enrichment/run-enrichment.js";
import { resolveProfileForMarket } from "./resolve-profile.js";
import {
  createApiOrchestrationBundle,
  getApiCheckpointer,
  type ApiOrchestrationBundle,
} from "./create-api-context.js";

export type StartOrchestrationRunInput = {
  marketId: string;
  forecastCutoff?: string;
  rootDir: string;
  runId?: string;
  requireHumanReviewOnEvidence?: boolean;
};

export type StartOrchestrationRunResult = {
  runId: string;
  status: OrchestrationRun["status"];
  interrupted: boolean;
  diff?: OrchestrationDiff;
  trace?: OrchestrationTrace;
};

export type ResumeOrchestrationRunInput = {
  runId: string;
  rootDir: string;
  approved: boolean;
};

function buildTraceFromState(
  state: EnrichmentGraphStateType,
  status: OrchestrationRun["status"],
  awaitingReview: boolean,
  reviewPayload?: Record<string, unknown> | null,
): OrchestrationTrace {
  return {
    runId: state.runId,
    profileId: state.profileId,
    marketId: state.marketQuestion?.marketId ?? "unknown",
    forecastCutoff: state.forecastCutoff,
    status,
    gapsBefore: state.gaps,
    researchTasks: state.researchTasks,
    researchIterations: state.researchIteration,
    featuresChanged: state.featuresChanged,
    newEvidenceIds: state.newEvidenceIds,
    contradictoryEvidenceIds: [],
    initialProbability: state.initialProbability,
    enrichedProbability: state.enrichedProbability,
    stopReason: state.stopReason,
    awaitingReview,
    reviewPayload: reviewPayload ?? null,
  };
}

async function persistRunArtifacts(
  bundle: ApiOrchestrationBundle,
  result: EnrichmentGraphResult,
  trace: OrchestrationTrace,
  pendingEvidence?: EnrichmentGraphStateType["pendingEvidence"],
) {
  await bundle.artifacts.saveDiff(result.runId, result.diff);
  await bundle.artifacts.saveTrace(result.runId, trace);
  await bundle.artifacts.saveEvidenceSnapshot(result.runId, {
    runId: result.runId,
    newEvidenceIds: result.state.newEvidenceIds,
    contradictoryEvidenceIds: [],
    pendingRecords: pendingEvidence ?? [],
  });
}

async function createPendingRun(
  bundle: ApiOrchestrationBundle,
  runId: string,
  marketId: string,
  forecastCutoff: string,
) {
  const now = new Date().toISOString();
  await bundle.ctx.runStore.create({
    runId,
    marketId,
    forecastCutoff,
    status: "running",
    researchIteration: 0,
    stopReason: null,
    initialForecastId: null,
    enrichedForecastId: null,
    initialProbability: null,
    enrichedProbability: null,
    recommendation: null,
    gapsBefore: [],
    researchTasks: [],
    newEvidenceIds: [],
    contradictoryEvidenceIds: [],
    featuresChanged: [],
    checkpointPath: `artifacts/${runId}`,
    createdAt: now,
    completedAt: null,
  });
}

export async function startOrchestrationRun(
  input: StartOrchestrationRunInput,
): Promise<StartOrchestrationRunResult> {
  const bundle = createApiOrchestrationBundle({
    rootDir: input.rootDir,
    configOverrides: input.requireHumanReviewOnEvidence
      ? { requireHumanReviewOnEvidence: true }
      : undefined,
  });
  const profile = await resolveProfileForMarket(input.marketId, input.forecastCutoff);
  const runId = input.runId ?? newRunId();

  await createPendingRun(bundle, runId, input.marketId, profile.forecastCutoff);

  const checkpointer = getApiCheckpointer(bundle);
  const result = await runEnrichmentGraph(bundle.ctx, {
    profile,
    runId,
    checkpointer,
    artifactStore: bundle.artifacts,
  });

  const interrupted = result.interrupted;
  const status = interrupted ? "awaiting_review" : "completed";
  const trace = buildTraceFromState(
    result.state,
    status,
    interrupted,
    result.reviewPayload ?? null,
  );

  await persistRunArtifacts(bundle, result, trace, result.state.pendingEvidence);

  if (interrupted) {
    await bundle.ctx.runStore.update(runId, { status: "awaiting_review" });
  }

  return {
    runId,
    status,
    interrupted,
    diff: result.diff,
    trace,
  };
}

export async function resumeOrchestrationRun(
  input: ResumeOrchestrationRunInput,
): Promise<StartOrchestrationRunResult> {
  const bundle = createApiOrchestrationBundle({ rootDir: input.rootDir });
  const existing = await bundle.ctx.runStore.get(input.runId);
  if (!existing) {
    throw new Error(`Run not found: ${input.runId}`);
  }
  if (existing.status !== "awaiting_review") {
    throw new Error(`Run ${input.runId} is not awaiting review (status=${existing.status})`);
  }

  const profile = await resolveProfileForMarket(existing.marketId, existing.forecastCutoff);
  const checkpointer = getApiCheckpointer(bundle);
  const graph = compileEnrichmentGraph(bundle.ctx, profile, checkpointer);
  const config = { configurable: { thread_id: input.runId } };

  const finalState = (await graph.invoke(new Command({ resume: { approved: input.approved } }), config)) as EnrichmentGraphStateType;

  const diff = buildOrchestrationDiff({
    initialProbability: finalState.initialProbability,
    finalProbability: finalState.enrichedProbability,
    evidenceAdded: finalState.newEvidenceIds.length,
    featuresChanged: finalState.featuresChanged,
    researchIterations: finalState.researchIteration,
    stopReason: finalState.stopReason,
  });

  const result: EnrichmentGraphResult = {
    runId: input.runId,
    state: finalState,
    diff,
    recommendation: finalState.recommendation ?? null,
    fingerprint: finalState.fingerprint ?? null,
    run: await bundle.ctx.runStore.get(input.runId),
    interrupted: false,
    reviewPayload: null,
  };

  const trace = buildTraceFromState(finalState, "completed", false);
  await persistRunArtifacts(bundle, result, trace);

  return {
    runId: input.runId,
    status: "completed",
    interrupted: false,
    diff,
    trace,
  };
}

export async function getOrchestrationRunDetail(
  runId: string,
  rootDir: string,
): Promise<{ run: OrchestrationRun | null; trace: OrchestrationTrace | null }> {
  const bundle = createApiOrchestrationBundle({ rootDir });
  const run = await bundle.ctx.runStore.get(runId);
  const trace = await bundle.artifacts.getTrace(runId);
  return { run, trace };
}

export async function getOrchestrationRunDiff(
  runId: string,
  rootDir: string,
): Promise<OrchestrationDiff | null> {
  const bundle = createApiOrchestrationBundle({ rootDir });
  return bundle.artifacts.getDiff(runId);
}

export async function getOrchestrationRunEvidence(
  runId: string,
  rootDir: string,
): Promise<OrchestrationEvidenceSnapshot | null> {
  const bundle = createApiOrchestrationBundle({ rootDir });
  const fromArtifact = await bundle.artifacts.getEvidenceSnapshot(runId);
  if (fromArtifact) return fromArtifact;

  const run = await bundle.ctx.runStore.get(runId);
  if (!run) return null;

  return {
    runId,
    newEvidenceIds: run.newEvidenceIds,
    contradictoryEvidenceIds: run.contradictoryEvidenceIds,
    pendingRecords: [],
  };
}

export async function getLatestOrchestrationTraceForMarket(
  marketId: string | string[],
  rootDir: string,
): Promise<{ run: OrchestrationRun | null; trace: OrchestrationTrace | null; diff: OrchestrationDiff | null }> {
  const bundle = createApiOrchestrationBundle({ rootDir });
  const runs = await bundle.ctx.runStore.list();
  const ids = new Set(Array.isArray(marketId) ? marketId : [marketId]);
  const match = runs.find((r) => ids.has(r.marketId));
  if (!match) return { run: null, trace: null, diff: null };
  const trace = await bundle.artifacts.getTrace(match.runId);
  const diff = await bundle.artifacts.getDiff(match.runId);
  return { run: match, trace, diff };
}

export { resolveProfileForMarket, listSupportedMarketIds, resolveOrchestrationMarketIdsForOps } from "./resolve-profile.js";
export { createApiOrchestrationBundle, type ApiOrchestrationBundle } from "./create-api-context.js";
