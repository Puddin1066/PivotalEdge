import { describe, expect, it } from "vitest";

import { normalizeClobBook } from "@pivotaledge/adapters";
import {
  compileQueryPlan,
  InMemoryKnowledgeGraphRepository,
  loadGraphFromProgramFixtures,
} from "@pivotaledge/kg";
import { buildForecast } from "@pivotaledge/models";
import {
  buildBetRecommendation,
  fingerprintRecommendation,
  fingerprintsMatch,
  recommendationFromSnapshot,
} from "@pivotaledge/scoring";
import {
  BetRecommendationSchema,
  loadFrozenOpportunitySnapshot,
  loadMarketFixture,
  loadOrderBookFixture,
  loadProgramFixture,
} from "@pivotaledge/schemas";

describe("S6: executable quotes", () => {
  it("uses best ask only, never midpoint", async () => {
    const yesBook = await loadOrderBookFixture("orderbooks/synalphimab-yes.json");
    const normalized = normalizeClobBook(
      {
        bids: [{ price: "0.68", size: "100" }],
        asks: [{ price: "0.72", size: "100" }],
      },
      { marketId: "pm_test", snapshotId: "ob_test" },
    );
    expect(normalized.bestAsk).toBe(0.72);
    expect(normalized.midpoint).toBeCloseTo(0.7);
    expect(yesBook.bestAsk).toBe(0.72);
  });
});

describe("S6: betting policy gate", () => {
  it("frozen snapshot → BetRecommendation is reproducible", async () => {
    const snapshot = await loadFrozenOpportunitySnapshot("opportunities/synalphimab-frozen.json");
    const a = recommendationFromSnapshot(snapshot);
    const b = buildBetRecommendation({
      marketQuestion: snapshot.marketQuestion,
      forecast: snapshot.forecast,
      yesOrderBook: snapshot.yesOrderBook,
      noOrderBook: snapshot.noOrderBook,
      precedentBundle: snapshot.precedentBundle,
      bankroll: snapshot.bankroll,
      generatedAt: snapshot.frozenAt,
      policyConfig: snapshot.policyConfig,
    });

    expect(BetRecommendationSchema.safeParse(a).success).toBe(true);
    expect(fingerprintsMatch(fingerprintRecommendation(a), fingerprintRecommendation(b))).toBe(
      true,
    );
  });

  it("end-to-end pipeline yields BET_YES on synalphimab fixture with mock order book", async () => {
    const approved = await loadProgramFixture("approved/synalphimab-nsclc.json");
    const crl = await loadProgramFixture("crl/synbetalib-ra.json");
    const market = await loadMarketFixture("market-cases/synalphimab-approval-by-date.json");
    const yesBook = await loadOrderBookFixture("orderbooks/synalphimab-yes.json");
    const noBook = await loadOrderBookFixture("orderbooks/synalphimab-no.json");

    const cutoff = "2024-06-01T00:00:00.000Z";
    const frozenAt = "2024-06-01T12:00:00.000Z";
    const graph = loadGraphFromProgramFixtures([approved, crl]);
    const repo = new InMemoryKnowledgeGraphRepository(graph);
    const plan = compileQueryPlan(market.marketQuestion, {
      forecastCutoff: cutoff,
      therapeuticArea: "oncology",
    });
    const bundle = repo.executePlan(plan);
    const forecast = buildForecast({
      marketQuestion: market.marketQuestion,
      precedentBundle: bundle,
      forecastCutoff: cutoff,
      forecastId: "fc_synalpha_test",
      generatedAt: frozenAt,
    });

    const rec = buildBetRecommendation({
      marketQuestion: market.marketQuestion,
      forecast,
      yesOrderBook: yesBook,
      noOrderBook: noBook,
      precedentBundle: bundle,
      generatedAt: frozenAt,
    });

    expect(rec.action).toBe("BET_YES");
    expect(rec.netEdge).toBeGreaterThan(0.05);
    expect(rec.executablePrice).toBe(0.72);
    expect(rec.recommendedStake).toBeGreaterThan(0);
  });
});
