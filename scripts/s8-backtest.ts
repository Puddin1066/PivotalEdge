#!/usr/bin/env tsx
/** S8 gate CLI: chronological backtest → edge-vs-market report. */
import { runChronologicalBacktest, loadCorpusPrograms } from "@pivotaledge/evals";
import { loadBacktestCorpus } from "@pivotaledge/schemas";
import { loadGraphFromProgramFixtures } from "@pivotaledge/kg";

async function main() {
  const corpus = await loadBacktestCorpus();
  const programs = await loadCorpusPrograms();
  const graph = loadGraphFromProgramFixtures(programs);

  const report = runChronologicalBacktest(corpus);
  console.log(
    JSON.stringify(
      {
        report,
        corpusScale: {
          backtestCases: corpus.cases.length,
          corpusPrograms: programs.length,
          graphPrograms: graph.listPrograms().length,
        },
      },
      null,
      2,
    ),
  );

  if (!report.beatsMarketAfterCosts) {
    console.error("S8 gate FAIL: model did not beat market baseline after costs");
    process.exit(1);
  }
  console.log("\nS8 gate PASS (edge-vs-market report after costs).");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
