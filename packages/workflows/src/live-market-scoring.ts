/**
 * Score one Polymarket market against an enriched program fixture + live CLOB.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  fetchClobOrderBook,
  yesNoTokenIds,
  type EnrichSeedProgram,
  type GammaMarket,
} from "@pivotaledge/adapters";
import {
  assessContractEvidence,
  compileQueryPlan,
  InMemoryKnowledgeGraphRepository,
} from "@pivotaledge/kg";
import { buildForecast } from "@pivotaledge/models";
import {
  FrozenOpportunitySnapshotSchema,
  type MarketEventType,
  type MarketQuestion,
  type ProgramFixture,
} from "@pivotaledge/schemas";
import {
  buildBetRecommendation,
  extractExecutableQuotes,
  fingerprintRecommendation,
  DEFAULT_BETTING_POLICY,
} from "@pivotaledge/scoring";

import type { LiveScoredOpportunity } from "./platform-dashboard.js";

export type SeedLike = Pick<
  EnrichSeedProgram,
  "slug" | "preferredName" | "marketEventTypes" | "fallbackCompetitors"
>;

function gammaEndToIso(endDate: string | null): string | null {
  if (!endDate) return null;
  const raw = endDate.includes("T") ? endDate : `${endDate}T23:59:00.000Z`;
  const ms = Date.parse(raw);
  if (Number.isNaN(ms)) return null;
  return new Date(ms).toISOString();
}

function inferEventType(question: string): MarketEventType {
  const q = question.toLowerCase();
  if (q.includes("bla submitted") || q.includes("nda submitted") || q.includes("submitted by")) {
    return "NDA_BLA_SUBMISSION";
  }
  if (
    q.includes("this year") ||
    q.includes("by december") ||
    q.includes("by june") ||
    q.includes("by ")
  ) {
    return "FDA_APPROVAL_BY_DATE";
  }
  return "FDA_APPROVAL";
}

export function buildMarketQuestionForLive(
  seed: SeedLike,
  fixture: ProgramFixture,
  marketId: string,
  gamma: Pick<GammaMarket, "question" | "description" | "endDate">,
): MarketQuestion {
  const deadline = gammaEndToIso(gamma.endDate) ?? "2026-12-31T23:59:00.000Z";
  return {
    marketId: `pm_${marketId}`,
    eventType: seed.marketEventTypes?.[marketId] ?? inferEventType(gamma.question),
    drugAssetId: fixture.drugAsset.id,
    drugAliases: [seed.preferredName],
    sponsorId: fixture.sponsor.id,
    indicationId: fixture.indication.id,
    population: null,
    applicationId: fixture.application?.id ?? null,
    linkedTrialIds: fixture.trials.map((t) => t.id),
    endpointIds: fixture.endpoints.map((e) => e.id),
    eventDeadline: deadline,
    resolutionSource: "polymarket_rules_and_fda",
    resolutionDefinition: (gamma.description || gamma.question).slice(0, 2000),
    conditionalApprovalCounts: true,
    ambiguityFlags: seed.preferredName.toLowerCase().includes("vaccine")
      ? ["asset_alias_resolution"]
      : [],
    parserConfidence: 0.7,
  };
}

export type ScoreLiveMarketOptions = {
  marketId: string;
  seed: SeedLike;
  fixture: ProgramFixture;
  gamma: GammaMarket;
  repo: InMemoryKnowledgeGraphRepository;
  cutoff: string;
  fixturesRoot: string;
  clinicalNote: string;
  bankroll?: number;
  writeSnapshot?: boolean;
};

export async function scoreLiveMarket(
  options: ScoreLiveMarketOptions,
): Promise<LiveScoredOpportunity | null> {
  const {
    marketId,
    seed,
    fixture,
    gamma,
    repo,
    cutoff,
    fixturesRoot,
    clinicalNote,
    bankroll = 10_000,
    writeSnapshot = true,
  } = options;

  if (gamma.closed) return null;
  const tokens = yesNoTokenIds(gamma);
  if (!tokens) return null;

  const [yesBook, noBook] = await Promise.all([
    fetchClobOrderBook(tokens.yes, { marketId: `pm_${marketId}`, depth: 20 }),
    fetchClobOrderBook(tokens.no, { marketId: `pm_${marketId}`, depth: 20 }),
  ]);

  try {
    extractExecutableQuotes(yesBook, noBook);
  } catch {
    return null;
  }

  const marketQuestion = buildMarketQuestionForLive(seed, fixture, marketId, gamma);
  const plan = compileQueryPlan(marketQuestion, {
    forecastCutoff: cutoff,
    therapeuticArea: fixture.indication.therapeuticArea,
  });
  const precedentBundle = repo.executePlan(plan);
  const contract = assessContractEvidence(marketQuestion, precedentBundle);
  const forecast = buildForecast({
    marketQuestion,
    precedentBundle,
    forecastCutoff: cutoff,
    forecastId: `fc_live_${seed.slug}_${marketId}`,
    generatedAt: cutoff,
  });

  const recommendation = buildBetRecommendation({
    marketQuestion,
    forecast,
    yesOrderBook: yesBook,
    noOrderBook: noBook,
    precedentBundle,
    bankroll,
    generatedAt: cutoff,
  });
  const fingerprint = fingerprintRecommendation(recommendation);

  const snapRel = `opportunities/live/${seed.slug}-${marketId}.json`;
  if (writeSnapshot) {
    const snapshot = FrozenOpportunitySnapshotSchema.parse({
      kind: "frozen_opportunity_snapshot",
      snapshotVersion: "live-1",
      frozenAt: cutoff,
      marketQuestion,
      forecast,
      yesOrderBook: yesBook,
      noOrderBook: noBook,
      precedentBundle,
      bankroll,
    });
    await mkdir(path.join(fixturesRoot, "opportunities/live"), { recursive: true });
    await writeFile(path.join(fixturesRoot, snapRel), `${JSON.stringify(snapshot, null, 2)}\n`);
  }

  const closesAt = gammaEndToIso(gamma.endDate);
  const tradability =
    gamma.acceptingOrders && !gamma.closed ? ("purchasable_now" as const) : ("not_purchasable" as const);

  return {
    slug: seed.slug,
    polymarketId: marketId,
    url: `https://polymarket.com/market/${gamma.slug}`,
    question: gamma.question,
    eventType: marketQuestion.eventType,
    dataLane: "live_polymarket",
    tradability,
    clinicalNote,
    modelP: recommendation.modelProbability,
    conservativeP: recommendation.conservativeProbability,
    yesBestAsk: yesBook.bestAsk,
    noBestAsk: noBook.bestAsk,
    action: recommendation.action,
    netEdge: recommendation.netEdge,
    stake: recommendation.recommendedStake,
    evidenceConfidence: recommendation.evidenceConfidence,
    fingerprint: fingerprint.contentHash,
    snapshot: snapRel,
    thesis: recommendation.primaryThesis,
    eventDeadline: marketQuestion.eventDeadline,
    closesAt,
    requiredPresent: contract.requiredPresent,
    requiredMissing: contract.requiredMissing,
    contractCoverage: contract.contractCoverage,
    calibrationBlocked: contract.calibrationBlocked,
    contractNotes: contract.notes,
  };
}

/** Actionable significant edge per betting-policy@2. */
export function isSignificantEdge(opp: LiveScoredOpportunity): boolean {
  if (opp.tradability !== "purchasable_now") return false;
  if (opp.calibrationBlocked) return false;
  if (opp.action !== "BET_YES" && opp.action !== "BET_NO") return false;
  if (Math.abs(opp.netEdge) < DEFAULT_BETTING_POLICY.minNetEdge) return false;
  return true;
}

/** Tradable market with latent edge blocked only by contract checklist (needs enrichment). */
export function isWatchlistEdge(opp: LiveScoredOpportunity): boolean {
  if (isSignificantEdge(opp)) return false;
  if (opp.tradability !== "purchasable_now") return false;
  if (!opp.calibrationBlocked) return false;
  return Math.abs(opp.netEdge) >= DEFAULT_BETTING_POLICY.minNetEdge;
}

export function opportunityRankScore(opp: LiveScoredOpportunity): number {
  const conf =
    opp.evidenceConfidence === "high" ? 1.2 : opp.evidenceConfidence === "moderate" ? 1 : 0.7;
  const contract =
    opp.contractCoverage === "complete" ? 1.3 : opp.contractCoverage === "partial" ? 0.9 : 0.5;
  const actionable = isSignificantEdge(opp) ? 2 : isWatchlistEdge(opp) ? 1.5 : 1;
  return Math.abs(opp.netEdge) * 100 * conf * contract * actionable + opp.stake / 200;
}
