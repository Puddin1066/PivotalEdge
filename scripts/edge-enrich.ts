#!/usr/bin/env tsx
/**
 * Run bounded orchestration enrichment on watchlist markets, then re-scan edges.
 *
 * Usage:
 *   pnpm edge:enrich
 *   pnpm edge:enrich -- --dry-run
 *   pnpm edge:enrich -- --market 3725541
 */
import path from "node:path";

import { startOrchestrationRun } from "@pivotaledge/orchestration";
import { runEdgeScan, loadEdgeScanReport } from "@pivotaledge/workflows";

function repoRoot(): string {
  return path.resolve(import.meta.dirname, "..");
}

function orchestrationRoot(): string {
  return path.join(repoRoot(), "data/orchestration");
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const marketIdx = process.argv.indexOf("--market");
  const singleMarket = marketIdx >= 0 ? process.argv[marketIdx + 1] : null;

  console.log("Edge enrich — scan → orchestration on watchlist → re-scan…");
  let report = await runEdgeScan();

  const targets = singleMarket
    ? report.allScored.filter((o) => o.polymarketId === singleMarket)
    : report.watchlist;

  if (!targets.length) {
    console.log(
      JSON.stringify(
        {
          message: singleMarket
            ? `No scored market ${singleMarket}`
            : "No watchlist markets (contract-blocked latent edge)",
          tradable: report.discoveredTradable,
          scored: report.scoredCount,
          significant: report.significantCount,
          watchlist: report.watchlistCount,
        },
        null,
        2,
      ),
    );
    return;
  }

  const enrichResults: {
    polymarketId: string;
    runId: string;
    status: string;
    probabilityDelta?: number;
    evidenceAdded?: number;
    error?: string;
  }[] = [];

  for (const opp of targets) {
    const marketId = `pm_${opp.polymarketId}`;
    console.log(`\nEnrich ${marketId} — ${opp.question.slice(0, 72)}…`);
    if (dryRun) {
      enrichResults.push({ polymarketId: opp.polymarketId, runId: "dry-run", status: "skipped" });
      continue;
    }
    try {
      const result = await startOrchestrationRun({
        marketId,
        rootDir: orchestrationRoot(),
      });
      enrichResults.push({
        polymarketId: opp.polymarketId,
        runId: result.runId,
        status: result.status,
        probabilityDelta: result.diff?.probabilityDelta,
        evidenceAdded: result.diff?.evidenceAdded,
      });
    } catch (err) {
      enrichResults.push({
        polymarketId: opp.polymarketId,
        runId: "failed",
        status: "error",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (!dryRun) {
    console.log("\nRe-scanning edges after enrichment…");
    report = await runEdgeScan();
  } else {
    report = (await loadEdgeScanReport()) ?? report;
  }

  console.log(
    JSON.stringify(
      {
        enriched: enrichResults,
        tradable: report.discoveredTradable,
        scored: report.scoredCount,
        significant: report.significantCount,
        watchlist: report.watchlistCount,
        report: "fixtures/enrichment/edge-scan-report.json",
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
