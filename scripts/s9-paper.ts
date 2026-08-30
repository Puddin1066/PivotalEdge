#!/usr/bin/env tsx
/** S9 gate CLI: prospective paper sample — calibrated + positive simulated net. */
import { runProspectivePaperSample } from "@pivotaledge/evals";
import { loadProspectiveCorpus } from "@pivotaledge/schemas";
import { buildOpportunityRadar } from "@pivotaledge/workflows";

async function main() {
  const corpus = await loadProspectiveCorpus();
  const report = runProspectivePaperSample(corpus);
  const radar = await buildOpportunityRadar();

  console.log(
    JSON.stringify(
      {
        report: {
          ...report,
          trades: report.trades.filter((t) => t.status === "resolved"),
        },
        radar: {
          opportunityCount: radar.opportunities.length,
          topAction: radar.opportunities[0]?.action,
          paperRealizedNetPnL: radar.paperPortfolio?.realizedNetPnL,
          liveTradingEnabled: radar.paperPortfolio?.liveTradingEnabled,
        },
      },
      null,
      2,
    ),
  );

  if (!report.gatePass) {
    console.error(
      "S9 gate FAIL: need calibrated (model Brier ≤ market) and positive simulated net with ≥1 paper trade",
    );
    process.exit(1);
  }
  console.log("\nS9 gate PASS (prospective sample: calibrated + positive simulated net).");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
