#!/usr/bin/env tsx
/** S5 CLI: market → precedent bundle → calibrated Forecast. */
import { loadMarketFixture, loadProgramFixture } from "@pivotaledge/schemas";
import {
  compileQueryPlan,
  InMemoryKnowledgeGraphRepository,
  loadGraphFromProgramFixtures,
} from "@pivotaledge/kg";
import { buildForecast } from "@pivotaledge/models";

const cutoff = process.argv[2] ?? "2024-06-01T00:00:00.000Z";

async function main() {
  const approved = await loadProgramFixture("approved/synalphimab-nsclc.json");
  const crl = await loadProgramFixture("crl/synbetalib-ra.json");
  const market = await loadMarketFixture("market-cases/synalphimab-approval-by-date.json");

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
  });

  console.log(JSON.stringify({ bundle: { cohorts: bundle.cohorts }, forecast }, null, 2));
  console.log("\nS5 forecast generated.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
