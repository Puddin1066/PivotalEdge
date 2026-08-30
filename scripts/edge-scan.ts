#!/usr/bin/env tsx
/**
 * Discover trial-related Polymarket markets, score vs clinical KG, surface significant edges.
 *
 * Usage:
 *   pnpm edge:scan
 *   pnpm edge:scan --seeds-only
 */
import { config } from "dotenv";

import { runEdgeScan } from "@pivotaledge/workflows";

config();

async function main() {
  const seedsOnly = process.argv.includes("--seeds-only");
  const limitIdx = process.argv.indexOf("--limit");
  const discoverLimit = limitIdx >= 0 ? Number(process.argv[limitIdx + 1]) : 60;

  console.log(`Edge scan (discover=${!seedsOnly}, limit=${discoverLimit})…`);
  const report = await runEdgeScan({ seedsOnly, discoverLimit });

  console.log(
    JSON.stringify(
      {
        tradable: report.discoveredTradable,
        open: report.discoveredOpen,
        keywordMatches: report.discoveredTotal,
        scored: report.scoredCount,
        significant: report.significantCount,
        watchlist: report.watchlistCount,
        watchlistBlocked: report.watchlist.length,
        unmapped: report.unmapped.length,
        discoveredMarkets: report.discoveredMarkets.map((m) => ({
          id: m.polymarketId,
          tradable: m.tradable,
          scored: m.scored,
          question: m.question.slice(0, 72),
        })),
        report: "fixtures/enrichment/edge-scan-report.json",
        significantEdges: report.significantEdges.map((e) => ({
          action: e.action,
          netEdge: e.netEdge,
          slug: e.slug,
          question: e.question.slice(0, 80),
          contractCoverage: e.contractCoverage,
          url: e.url,
        })),
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
