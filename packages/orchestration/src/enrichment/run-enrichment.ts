import type { MemorySaver } from "@langchain/langgraph";

import type { BetRecommendation, OrchestrationDiff, OrchestrationRun } from "@pivotaledge/schemas";
import type { RecommendationFingerprint } from "@pivotaledge/scoring";

import type { OrchestrationContext } from "../context.js";
import { buildOrchestrationDiff } from "../pipeline/deterministic-pipeline.js";
import type { FixtureProfile } from "../fixtures/profiles.js";
import { compileEnrichmentGraph } from "../graph/compile-graph.js";
import type { EnrichmentGraphStateType } from "../graph/graph-state.js";
import { newRunId } from "../graph/nodes.js";
import { runDeterministicPipeline } from "../pipeline/deterministic-pipeline.js";
import type { ArtifactStore } from "../api/artifact-store.js";

export type EnrichmentGraphResult = {
  runId: string;
  state: EnrichmentGraphStateType;
  diff: OrchestrationDiff;
  recommendation: BetRecommendation | null;
  fingerprint: RecommendationFingerprint | null;
  run: OrchestrationRun | null;
  interrupted: boolean;
  reviewPayload: Record<string, unknown> | null;
};

export type RunEnrichmentGraphOptions = {
  profile: FixtureProfile;
  runId?: string;
  checkpointer?: MemorySaver;
  artifactStore?: ArtifactStore;
};

function extractReviewPayload(snapshot: {
  tasks?: Array<{ interrupts?: Array<{ value?: unknown }> }>;
}): Record<string, unknown> | null {
  for (const task of snapshot.tasks ?? []) {
    for (const intr of task.interrupts ?? []) {
      if (intr.value && typeof intr.value === "object") {
        return intr.value as Record<string, unknown>;
      }
    }
  }
  return null;
}

/**
 * LangGraph enrichment loop: baseline forecast → gap research → validate → rerun → finalize.
 * When orchestration is disabled, falls back to deterministic pipeline only.
 */
export async function runEnrichmentGraph(
  ctx: OrchestrationContext,
  options: RunEnrichmentGraphOptions,
): Promise<EnrichmentGraphResult> {
  const runId = options.runId ?? newRunId();
  const { profile } = options;

  if (!ctx.config.enabled) {
    const baseline = await runDeterministicPipeline(ctx, { profile });
    const diff = buildOrchestrationDiff({
      initialProbability: baseline.forecast.modelProbability,
      finalProbability: baseline.forecast.modelProbability,
      evidenceAdded: 0,
      featuresChanged: [],
      researchIterations: 0,
      stopReason: "orchestration_disabled",
    });
    return {
      runId,
      state: {
        runId,
        profileId: profile.id,
        forecastCutoff: profile.forecastCutoff,
        programFixturePaths: profile.programFixturePaths,
        initialProbability: baseline.forecast.modelProbability,
        enrichedProbability: baseline.forecast.modelProbability,
        researchIteration: 0,
        stopReason: "orchestration_disabled",
        status: "completed",
      } as EnrichmentGraphStateType,
      diff,
      recommendation: baseline.recommendation,
      fingerprint: baseline.fingerprint,
      run: null,
      interrupted: false,
      reviewPayload: null,
    };
  }

  const checkpointer = options.checkpointer;
  const graph = compileEnrichmentGraph(ctx, profile, checkpointer);
  const config = { configurable: { thread_id: runId } };

  const finalState = (await graph.invoke(
    {
      runId,
      profileId: profile.id,
      forecastCutoff: profile.forecastCutoff,
      programFixturePaths: profile.programFixturePaths,
      therapeuticArea: profile.therapeuticArea,
    },
    config,
  )) as EnrichmentGraphStateType;

  const stateSnapshot = await graph.getState(config);
  const interrupted = (stateSnapshot.next?.length ?? 0) > 0;
  const reviewPayload = interrupted ? extractReviewPayload(stateSnapshot) : null;

  if (interrupted && options.artifactStore && finalState.pendingEvidence.length > 0) {
    await options.artifactStore.savePendingEvidence(runId, finalState.pendingEvidence);
  }

  const diff = buildOrchestrationDiff({
    initialProbability: finalState.initialProbability,
    finalProbability: finalState.enrichedProbability,
    evidenceAdded: finalState.newEvidenceIds.length,
    featuresChanged: finalState.featuresChanged,
    researchIterations: finalState.researchIteration,
    stopReason: interrupted ? "awaiting_human_review" : finalState.stopReason,
  });

  const run = await ctx.runStore.get(runId);

  return {
    runId,
    state: finalState,
    diff,
    recommendation: finalState.recommendation ?? null,
    fingerprint: finalState.fingerprint ?? null,
    run,
    interrupted,
    reviewPayload,
  };
}

export { newRunId };
