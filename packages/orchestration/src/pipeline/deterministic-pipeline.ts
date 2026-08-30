import {
  loadFrozenOpportunitySnapshot,
  loadOrderBookFixture,
  OrchestrationDiffSchema,
  type BetRecommendation,
  type Forecast,
  type FrozenOpportunitySnapshot,
  type ModelInformationGap,
  type OrchestrationDiff,
  type PrecedentBundle,
  type PredictionMarket,
} from "@pivotaledge/schemas";
import type { MarketQuestion } from "@pivotaledge/schemas";
import { recommendationFromSnapshot } from "@pivotaledge/scoring";
import type { RecommendationFingerprint } from "@pivotaledge/scoring";

import type { OrchestrationContext } from "../context.js";
import { evaluateInformationGaps } from "../gaps/evaluate-gaps.js";
import { hasMaterialGaps, planTargetedResearch } from "../gaps/plan-research.js";
import type { FixtureProfile } from "../fixtures/profiles.js";

export type DeterministicPipelineResult = {
  market: PredictionMarket;
  marketQuestion: MarketQuestion;
  precedentBundle: PrecedentBundle;
  forecast: Forecast;
  recommendation: BetRecommendation;
  fingerprint: RecommendationFingerprint;
  gaps: ModelInformationGap[];
  metadata: {
    profileId: string;
    snapshotPath: string;
    forecastCutoff: string;
    evaluatedAt: string;
    orderBooksAreMock: boolean;
  };
};

export type RunDeterministicPipelineOptions = {
  profile: FixtureProfile;
  /** When set, compare recommendation fingerprint to frozen snapshot gate. */
  verifyFrozenFingerprint?: boolean;
};

/**
 * Composes market → KG → forecast → scoring through injected ports.
 * Pure orchestration composition — no LangGraph runtime required.
 */
export async function runDeterministicPipeline(
  ctx: OrchestrationContext,
  options: RunDeterministicPipelineOptions,
): Promise<DeterministicPipelineResult> {
  const { profile } = options;
  const snapshot = await loadFrozenOpportunitySnapshot(profile.snapshotPath);
  const { market, marketQuestion } = await ctx.market.loadMarketFixture(profile.marketFixturePath);

  const yesOrderBook = await loadOrderBookFixture(profile.yesOrderBookPath);
  const noOrderBook = profile.noOrderBookPath
    ? await loadOrderBookFixture(profile.noOrderBookPath)
    : null;

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

  const recommendation = await ctx.scoring.buildRecommendation({
    marketQuestion,
    forecast,
    yesOrderBook,
    noOrderBook,
    precedentBundle,
    bankroll: snapshot.bankroll,
    generatedAt: snapshot.frozenAt,
    policyConfig: snapshot.policyConfig,
  });

  const fingerprint = ctx.scoring.fingerprintRecommendation(recommendation);
  const gaps = evaluateInformationGaps(marketQuestion, precedentBundle, forecast);

  if (options.verifyFrozenFingerprint !== false) {
    const mergedSnapshot: FrozenOpportunitySnapshot = {
      ...snapshot,
      forecast,
      precedentBundle,
      yesOrderBook,
      noOrderBook,
    };
    const fromSnapshot = recommendationFromSnapshot(mergedSnapshot);
    const snapshotFp = ctx.scoring.fingerprintRecommendation(fromSnapshot);
    if (snapshotFp.contentHash !== fingerprint.contentHash) {
      throw new Error("Deterministic pipeline fingerprint mismatch vs frozen snapshot gate");
    }
  }

  return {
    market,
    marketQuestion,
    precedentBundle,
    forecast,
    recommendation,
    fingerprint,
    gaps,
    metadata: {
      profileId: profile.id,
      snapshotPath: profile.snapshotPath,
      forecastCutoff: profile.forecastCutoff,
      evaluatedAt: new Date().toISOString(),
      orderBooksAreMock: true,
    },
  };
}

export function buildOrchestrationDiff(input: {
  initialProbability: number;
  finalProbability: number;
  evidenceAdded: number;
  featuresChanged: string[];
  researchIterations: number;
  stopReason: string;
}): OrchestrationDiff {
  return OrchestrationDiffSchema.parse({
    initialProbability: input.initialProbability,
    finalProbability: input.finalProbability,
    probabilityDelta: input.finalProbability - input.initialProbability,
    evidenceAdded: input.evidenceAdded,
    featuresChanged: input.featuresChanged,
    researchIterations: input.researchIterations,
    stopReason: input.stopReason,
  });
}

export function shouldStopResearch(input: {
  iteration: number;
  initialProbability: number;
  currentProbability: number;
  gaps: ModelInformationGap[];
  config: OrchestrationContext["config"];
}): { stop: boolean; reason: string } {
  const { iteration, initialProbability, currentProbability, gaps, config } = input;

  if (iteration >= config.maxResearchIterations) {
    return { stop: true, reason: "max_research_iterations" };
  }

  if (!hasMaterialGaps(gaps, config)) {
    return { stop: true, reason: "no_material_gaps" };
  }

  const delta = Math.abs(currentProbability - initialProbability);
  if (iteration > 0 && delta < config.minProbabilityChange) {
    return { stop: true, reason: "probability_change_below_threshold" };
  }

  return { stop: false, reason: "continue" };
}

export { planTargetedResearch, hasMaterialGaps };
