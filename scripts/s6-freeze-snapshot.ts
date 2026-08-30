#!/usr/bin/env tsx
/** Build and optionally write a frozen opportunity snapshot from fixture pipeline. */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { loadMarketFixture, loadProgramFixture, defaultFixturesRoot } from "@pivotaledge/schemas";
import {
  compileQueryPlan,
  InMemoryKnowledgeGraphRepository,
  loadGraphFromProgramFixtures,
} from "@pivotaledge/kg";
import { buildForecast } from "@pivotaledge/models";
import { FrozenOpportunitySnapshotSchema } from "@pivotaledge/schemas";

const cutoff = process.argv[2] ?? "2024-06-01T00:00:00.000Z";
const outPath = process.argv[3];

async function loadOrderBook(relativePath: string) {
  const { loadOrderBookFixture } = await import("@pivotaledge/schemas");
  return loadOrderBookFixture(relativePath);
}

async function main() {
  const approved = await loadProgramFixture("approved/synalphimab-nsclc.json");
  const crl = await loadProgramFixture("crl/synbetalib-ra.json");
  const market = await loadMarketFixture("market-cases/synalphimab-approval-by-date.json");
  const yesOrderBook = await loadOrderBook("orderbooks/synalphimab-yes.json");
  const noOrderBook = await loadOrderBook("orderbooks/synalphimab-no.json");

  const graph = loadGraphFromProgramFixtures([approved, crl]);
  const repo = new InMemoryKnowledgeGraphRepository(graph);
  const plan = compileQueryPlan(market.marketQuestion, {
    forecastCutoff: cutoff,
    therapeuticArea: "oncology",
  });
  const bundle = repo.executePlan(plan);

  const frozenAt = "2024-06-01T12:00:00.000Z";
  const forecast = buildForecast({
    marketQuestion: market.marketQuestion,
    precedentBundle: bundle,
    forecastCutoff: cutoff,
    forecastId: "fc_synalpha_fixture",
    generatedAt: frozenAt,
  });

  const snapshot = FrozenOpportunitySnapshotSchema.parse({
    kind: "frozen_opportunity_snapshot",
    snapshotVersion: "1",
    frozenAt,
    marketQuestion: market.marketQuestion,
    forecast,
    yesOrderBook,
    noOrderBook,
    precedentBundle: bundle,
    bankroll: 10_000,
  });

  const json = JSON.stringify(snapshot, null, 2);
  if (outPath) {
    const target = path.isAbsolute(outPath) ? outPath : path.join(defaultFixturesRoot(), outPath);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, `${json}\n`, "utf8");
    console.log(`Wrote ${target}`);
  } else {
    console.log(json);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
