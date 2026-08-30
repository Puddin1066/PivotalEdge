import { interrupt } from "@langchain/langgraph";
import { randomUUID } from "node:crypto";

import {
  loadFrozenOpportunitySnapshot,
  loadOrderBookFixture,
  type EvidenceRecord,
} from "@pivotaledge/schemas";

import type { OrchestrationContext } from "../context.js";
import {
  applyFieldOverrides,
  changedFeatures,
  overridesFromEvidence,
} from "../enrichment/field-overrides.js";
import { evaluateInformationGaps } from "../gaps/evaluate-gaps.js";
import { planTargetedResearch } from "../gaps/plan-research.js";
import { validateEvidenceRecords } from "../evidence/validate.js";
import { dedupeWithContradictions } from "../evidence/contradictions.js";
import type { ResearchDomain } from "../gaps/research-domain.js";
import { buildOrchestrationDiff, shouldStopResearch } from "../pipeline/deterministic-pipeline.js";
import { needsHumanReview } from "../review/needs-human-review.js";
import type { FixtureProfile } from "../fixtures/profiles.js";
import type { EnrichmentGraphStateType } from "./graph-state.js";

export type EnrichmentNodeDeps = {
  ctx: OrchestrationContext;
  profile: FixtureProfile;
};

export function createEnrichmentNodes(deps: EnrichmentNodeDeps) {
  const { ctx, profile } = deps;

  async function bootstrap(): Promise<Partial<EnrichmentGraphStateType>> {
    const snapshot = await loadFrozenOpportunitySnapshot(
      profile.liveSnapshotPath ?? profile.snapshotPath,
    );

    let marketQuestion = snapshot.marketQuestion;
    let market: EnrichmentGraphStateType["market"];

    if (profile.liveSnapshotPath) {
      market = {
        id: marketQuestion.marketId,
        platform: "polymarket",
        eventId: `event_${marketQuestion.marketId}`,
        question: snapshot.forecast.supportingEvidenceIds.length
          ? marketQuestion.resolutionDefinition.slice(0, 200)
          : marketQuestion.resolutionDefinition,
        resolutionRules: marketQuestion.resolutionDefinition,
        closesAt: marketQuestion.eventDeadline,
        tokenYesId: `yes_${marketQuestion.marketId}`,
        tokenNoId: `no_${marketQuestion.marketId}`,
        active: true,
      };
    } else {
      const loaded = await ctx.market.loadMarketFixture(profile.marketFixturePath);
      market = loaded.market;
      marketQuestion = loaded.marketQuestion;
    }

    const precedentBundle = await ctx.kg.executePlan({
      marketQuestion,
      forecastCutoff: profile.forecastCutoff,
      therapeuticArea: profile.therapeuticArea,
      programFixturePaths: profile.programFixturePaths,
    });

    const forecast = await ctx.forecast.buildForecast({
      marketQuestion,
      precedentBundle,
      forecastCutoff: profile.forecastCutoff,
      forecastId: snapshot.forecast.id,
      generatedAt: snapshot.frozenAt,
    });

    const gaps = evaluateInformationGaps(marketQuestion, precedentBundle, forecast);

    return {
      market,
      marketQuestion,
      precedentBundle,
      initialForecast: forecast,
      enrichedForecast: forecast,
      initialProbability: forecast.modelProbability,
      enrichedProbability: forecast.modelProbability,
      gaps,
      bankroll: snapshot.bankroll,
      generatedAt: snapshot.frozenAt,
      policyConfig: snapshot.policyConfig,
      yesOrderBookPath: profile.liveSnapshotPath ?? profile.yesOrderBookPath,
      noOrderBookPath: profile.liveSnapshotPath ?? profile.noOrderBookPath,
      status: "running",
      stopReason: "pending",
    };
  }

  async function evaluateGaps(state: EnrichmentGraphStateType): Promise<Partial<EnrichmentGraphStateType>> {
    const marketQuestion = state.marketQuestion!;
    const bundle = state.precedentBundle!;
    const forecast = state.enrichedForecast ?? state.initialForecast!;

    const gaps = evaluateInformationGaps(marketQuestion, bundle, forecast);
    const { stop, reason } = shouldStopResearch({
      iteration: state.researchIteration,
      initialProbability: state.initialProbability,
      currentProbability: forecast.modelProbability,
      gaps,
      config: ctx.config,
    });

    return {
      gaps,
      shouldContinueResearch: !stop,
      stopReason: stop ? reason : state.stopReason,
    };
  }

  async function planResearch(state: EnrichmentGraphStateType): Promise<Partial<EnrichmentGraphStateType>> {
    const tasks = planTargetedResearch(state.gaps, ctx.config);
    return { researchTasks: tasks };
  }

  async function executeResearchBatch(
    state: EnrichmentGraphStateType,
    domain: ResearchDomain,
  ): Promise<Partial<EnrichmentGraphStateType>> {
    const marketQuestion = state.marketQuestion;
    if (!marketQuestion) {
      throw new Error(`research_${domain}: marketQuestion missing from graph state`);
    }
    const tasks =
      state.batchTasks.length > 0
        ? state.batchTasks
        : state.researchTasks.filter((t) => (t.domain ?? "clinical") === domain);
    const allRecords: EvidenceRecord[] = [];

    for (const task of tasks) {
      const records = await ctx.research.executeTask({
        task,
        marketQuestion,
        forecastCutoff: state.forecastCutoff,
      });
      allRecords.push(...records);
    }

    return { pendingEvidence: allRecords, batchTasks: [] };
  }

  async function researchClinical(state: EnrichmentGraphStateType) {
    return executeResearchBatch(state, "clinical");
  }

  async function researchRegulatory(state: EnrichmentGraphStateType) {
    return executeResearchBatch(state, "regulatory");
  }

  async function researchCompany(state: EnrichmentGraphStateType) {
    return executeResearchBatch(state, "company");
  }

  async function validateEvidence(state: EnrichmentGraphStateType): Promise<Partial<EnrichmentGraphStateType>> {
    const { accepted } = validateEvidenceRecords(state.pendingEvidence, state.forecastCutoff);
    const { novel, contradictoryIds } = dedupeWithContradictions(accepted, []);

    return {
      pendingEvidence: novel,
      lastValidatedCount: novel.length,
      contradictoryEvidenceIds: contradictoryIds,
      stopReason: novel.length === 0 ? "no_new_validated_evidence" : state.stopReason,
      shouldContinueResearch: novel.length > 0,
    };
  }

  async function humanReviewGate(state: EnrichmentGraphStateType): Promise<Partial<EnrichmentGraphStateType>> {
    if (state.pendingEvidence.length === 0) {
      return { reviewRejected: false };
    }

    if (!needsHumanReview({ pendingEvidence: state.pendingEvidence, gaps: state.gaps }, ctx.config)) {
      return { reviewRejected: false };
    }

    try {
      await ctx.runStore.update(state.runId, { status: "awaiting_review" });
    } catch {
      // run ledger may not exist yet
    }

    const decision = interrupt({
      type: "evidence_review",
      runId: state.runId,
      evidenceCount: state.pendingEvidence.length,
      recordIds: state.pendingEvidence.map((r) => r.id),
    }) as { approved?: boolean } | undefined;

    if (!decision?.approved) {
      return {
        reviewRejected: true,
        shouldContinueResearch: false,
        stopReason: "human_rejected",
        pendingEvidence: [],
      };
    }

    try {
      await ctx.runStore.update(state.runId, { status: "running" });
    } catch {
      // ignore
    }

    return { reviewRejected: false };
  }

  async function writeEvidence(state: EnrichmentGraphStateType): Promise<Partial<EnrichmentGraphStateType>> {
    const programFixturePath = profile.programFixturePaths[0] ?? "approved/synalphimab-nsclc.json";

    const writeResult = await ctx.evidenceWriter.writeValidated({
      runId: state.runId,
      records: state.pendingEvidence,
      programFixturePath,
    });

    const newOverrides = overridesFromEvidence(state.pendingEvidence);
    const mergedOverrides = { ...state.fieldOverrides, ...newOverrides };
    const featuresChanged = changedFeatures(state.fieldOverrides, mergedOverrides);

    const patchedBundle = applyFieldOverrides(state.precedentBundle!, mergedOverrides);

    return {
      fieldOverrides: newOverrides,
      newEvidenceIds: writeResult.newEvidenceIds,
      contradictoryEvidenceIds: [
        ...new Set([...state.contradictoryEvidenceIds, ...writeResult.contradictoryEvidenceIds]),
      ],
      featuresChanged,
      precedentBundle: patchedBundle,
    };
  }

  async function rerunPrediction(state: EnrichmentGraphStateType): Promise<Partial<EnrichmentGraphStateType>> {
    const marketQuestion = state.marketQuestion!;
    const snapshot = await loadFrozenOpportunitySnapshot(profile.snapshotPath);

    const precedentBundle = await ctx.kg.executePlan({
      marketQuestion,
      forecastCutoff: profile.forecastCutoff,
      therapeuticArea: profile.therapeuticArea,
      programFixturePaths: profile.programFixturePaths,
    });
    const patchedBundle = applyFieldOverrides(precedentBundle, state.fieldOverrides);

    const forecast = await ctx.forecast.buildForecast({
      marketQuestion,
      precedentBundle: patchedBundle,
      forecastCutoff: profile.forecastCutoff,
      forecastId: `${snapshot.forecast.id}_enriched_${state.researchIteration + 1}`,
      generatedAt: state.generatedAt,
    });

    return {
      precedentBundle: patchedBundle,
      enrichedForecast: forecast,
      enrichedProbability: forecast.modelProbability,
      researchIteration: state.researchIteration + 1,
    };
  }

  async function finalize(state: EnrichmentGraphStateType): Promise<Partial<EnrichmentGraphStateType>> {
    const marketQuestion = state.marketQuestion!;
    const forecast = state.enrichedForecast ?? state.initialForecast!;

    let yesOrderBook;
    let noOrderBook;
    if (profile.liveSnapshotPath) {
      const snapshot = await loadFrozenOpportunitySnapshot(profile.liveSnapshotPath);
      yesOrderBook = snapshot.yesOrderBook;
      noOrderBook = snapshot.noOrderBook;
    } else {
      yesOrderBook = await loadOrderBookFixture(state.yesOrderBookPath);
      noOrderBook = state.noOrderBookPath
        ? await loadOrderBookFixture(state.noOrderBookPath)
        : null;
    }

    const recommendation = await ctx.scoring.buildRecommendation({
      marketQuestion,
      forecast,
      yesOrderBook,
      noOrderBook,
      precedentBundle: state.precedentBundle!,
      bankroll: state.bankroll,
      generatedAt: state.generatedAt,
      policyConfig: state.policyConfig ?? undefined,
    });

    const fingerprint = ctx.scoring.fingerprintRecommendation(recommendation);

    const runId = state.runId;
    const now = new Date().toISOString();
    const diff = buildOrchestrationDiff({
      initialProbability: state.initialProbability,
      finalProbability: state.enrichedProbability,
      evidenceAdded: state.newEvidenceIds.length,
      featuresChanged: state.featuresChanged,
      researchIterations: state.researchIteration,
      stopReason: state.stopReason,
    });

    try {
      await ctx.runStore.create({
      runId,
      marketId: marketQuestion.marketId,
      forecastCutoff: state.forecastCutoff,
      status: "completed",
      researchIteration: state.researchIteration,
      stopReason: state.stopReason,
      initialForecastId: state.initialForecast?.id ?? null,
      enrichedForecastId: forecast.id,
      initialProbability: state.initialProbability,
      enrichedProbability: state.enrichedProbability,
      recommendation,
      gapsBefore: state.gaps,
      researchTasks: state.researchTasks,
      newEvidenceIds: state.newEvidenceIds,
      contradictoryEvidenceIds: state.contradictoryEvidenceIds,
      featuresChanged: state.featuresChanged,
      checkpointPath: null,
      createdAt: now,
      completedAt: now,
    });
    } catch {
      await ctx.runStore.update(runId, {
        status: "completed",
        stopReason: state.stopReason,
        enrichedForecastId: forecast.id,
        enrichedProbability: state.enrichedProbability,
        recommendation,
        newEvidenceIds: state.newEvidenceIds,
        featuresChanged: state.featuresChanged,
        completedAt: now,
      });
    }

    return {
      recommendation,
      fingerprint,
      status: "completed",
    };
  }

  return {
    bootstrap,
    evaluateGaps,
    planResearch,
    researchClinical,
    researchRegulatory,
    researchCompany,
    validateEvidence,
    humanReviewGate,
    writeEvidence,
    rerunPrediction,
    finalize,
  };
}

export function newRunId(): string {
  return `orch_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
}
