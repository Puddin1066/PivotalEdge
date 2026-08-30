import {
  compileQueryPlan,
  InMemoryKnowledgeGraphRepository,
  loadGraphFromProgramFixtures,
} from "@pivotaledge/kg";
import { buildForecast } from "@pivotaledge/models";
import {
  loadFrozenOpportunitySnapshot,
  loadMarketFixture,
  loadOrderBookFixture,
  loadProgramFixture,
} from "@pivotaledge/schemas";
import {
  buildBetRecommendation,
  fingerprintRecommendation,
  recommendationFromSnapshot,
} from "@pivotaledge/scoring";

import type { OpportunityDossier } from "./dossier.js";

export type EvaluateOpportunityOptions = {
  snapshotPath?: string;
  cutoff?: string;
  /** When true, rebuild from raw fixtures instead of frozen forecast fields. */
  livePipeline?: boolean;
};

const DEFAULT_SNAPSHOT = "opportunities/synalphimab-frozen.json";
const DEFAULT_CUTOFF = "2024-06-01T00:00:00.000Z";

export async function evaluateOpportunity(
  options: EvaluateOpportunityOptions = {},
): Promise<OpportunityDossier> {
  const snapshotPath = options.snapshotPath ?? DEFAULT_SNAPSHOT;
  const cutoff = options.cutoff ?? DEFAULT_CUTOFF;
  const snapshot = await loadFrozenOpportunitySnapshot(snapshotPath);
  const marketFixture = await loadMarketFixture("market-cases/synalphimab-approval-by-date.json");

  let forecast = snapshot.forecast;
  let precedentBundle = snapshot.precedentBundle;
  let yesOrderBook = snapshot.yesOrderBook;
  let noOrderBook = snapshot.noOrderBook;

  if (options.livePipeline) {
    const approved = await loadProgramFixture("approved/synalphimab-nsclc.json");
    const crl = await loadProgramFixture("crl/synbetalib-ra.json");
    yesOrderBook = await loadOrderBookFixture("orderbooks/synalphimab-yes.json");
    noOrderBook = await loadOrderBookFixture("orderbooks/synalphimab-no.json");

    const graph = loadGraphFromProgramFixtures([approved, crl]);
    const repo = new InMemoryKnowledgeGraphRepository(graph);
    const plan = compileQueryPlan(marketFixture.marketQuestion, {
      forecastCutoff: cutoff,
      therapeuticArea: "oncology",
    });
    precedentBundle = repo.executePlan(plan);
    forecast = buildForecast({
      marketQuestion: marketFixture.marketQuestion,
      precedentBundle,
      forecastCutoff: cutoff,
      forecastId: snapshot.forecast.id,
      generatedAt: snapshot.frozenAt,
    });
  }

  const fromSnapshot = recommendationFromSnapshot({
    ...snapshot,
    forecast,
    precedentBundle,
    yesOrderBook,
    noOrderBook,
  });
  const fromPipeline = buildBetRecommendation({
    marketQuestion: marketFixture.marketQuestion,
    forecast,
    yesOrderBook,
    noOrderBook,
    precedentBundle,
    bankroll: snapshot.bankroll,
    generatedAt: snapshot.frozenAt,
    policyConfig: snapshot.policyConfig,
  });

  const fpSnapshot = fingerprintRecommendation(fromSnapshot);
  const fpPipeline = fingerprintRecommendation(fromPipeline);
  if (fpSnapshot.contentHash !== fpPipeline.contentHash) {
    throw new Error("Opportunity pipeline fingerprint mismatch");
  }

  return {
    market: marketFixture.market,
    marketQuestion: marketFixture.marketQuestion,
    precedentBundle,
    forecast,
    recommendation: fromPipeline,
    fingerprint: fpPipeline,
    yesOrderBook,
    noOrderBook,
    metadata: {
      snapshotPath,
      fixtureSource: "fixtures/market-cases/synalphimab-approval-by-date.json",
      evaluatedAt: new Date().toISOString(),
      orderBooksAreMock: true,
    },
  };
}
