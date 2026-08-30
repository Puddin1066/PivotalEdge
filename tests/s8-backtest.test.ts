import { describe, expect, it } from "vitest";

import { runChronologicalBacktest, loadCorpusPrograms } from "@pivotaledge/evals";
import { loadGraphFromProgramFixtures } from "@pivotaledge/kg";
import {
  EdgeVsMarketReportSchema,
  loadBacktestCorpus,
  loadProgramFixture,
} from "@pivotaledge/schemas";

describe("S8: corpus scale", () => {
  it("loads expanded program corpus into knowledge graph", async () => {
    const base = await loadProgramFixture("approved/synalphimab-nsclc.json");
    const expanded = await loadCorpusPrograms();
    expect(expanded.length).toBeGreaterThanOrEqual(4);

    const graph = loadGraphFromProgramFixtures([base, ...expanded]);
    expect(graph.listPrograms().length).toBeGreaterThanOrEqual(5);
  });
});

describe("S8: chronological backtest gate", () => {
  it("produces edge-vs-market report beating market baseline after costs", async () => {
    const corpus = await loadBacktestCorpus();
    const report = runChronologicalBacktest(corpus);

    expect(EdgeVsMarketReportSchema.safeParse(report).success).toBe(true);
    expect(report.totalTrades).toBeGreaterThan(0);
    expect(report.modelBrier).toBeLessThanOrEqual(report.marketBrier + 0.05);
    expect(report.beatsMarketAfterCosts).toBe(true);
    expect(report.edgeVsMarket).toBeGreaterThan(0);
  });
});
