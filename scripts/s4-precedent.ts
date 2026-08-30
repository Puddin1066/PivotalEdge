#!/usr/bin/env tsx
/** S4 CLI: compile query plan and fetch PrecedentBundle from fixture graph. */
import { loadMarketFixture, loadProgramFixture } from "@pivotaledge/schemas";
import {
  compileQueryPlan,
  InMemoryKnowledgeGraphRepository,
  loadGraphFromProgramFixtures,
  validateQueryPlan,
} from "@pivotaledge/kg";

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
  const issues = validateQueryPlan(plan);
  if (issues.length) {
    console.error("Plan validation issues:", issues);
    process.exit(1);
  }

  const bundle = repo.executePlan(plan);
  console.log(JSON.stringify({ plan, bundle }, null, 2));

  if (bundle.cutoffCompliance.leakageDetected) {
    console.error("S4 gate FAIL: leakage detected");
    process.exit(1);
  }
  console.log("\nS4 gate PASS (no leakage).");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
