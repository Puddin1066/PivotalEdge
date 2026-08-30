#!/usr/bin/env tsx
/**
 * Snapshot executable YES/NO best asks for Polymarket-seeded FDA markets.
 * Appends to fixtures/quotes/archive.jsonl (outside clinical KG).
 *
 * Usage:
 *   pnpm quotes:snapshot
 *   pnpm quotes:snapshot --times 3
 */
import { config } from "dotenv";
import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  appendQuoteRows,
  fetchClobOrderBook,
  fetchGammaMarketById,
  loadQuoteArchive,
  summarizeQuoteVault,
  writeQuoteVaultSummary,
  yesNoTokenIds,
  type EnrichSeedProgram,
} from "@pivotaledge/adapters";
import { defaultFixturesRoot, type ArchivedQuoteRow } from "@pivotaledge/schemas";
import { extractExecutableQuotes } from "@pivotaledge/scoring";

config();

type SeedFile = { programs: EnrichSeedProgram[] };

function parseTimes(argv: string[]): number {
  const idx = argv.indexOf("--times");
  if (idx < 0) return 1;
  const n = Number(argv[idx + 1]);
  return Number.isFinite(n) && n >= 1 ? Math.min(20, Math.floor(n)) : 1;
}

async function snapshotOnce(root: string, seed: SeedFile): Promise<number> {
  const capturedAt = new Date().toISOString();
  const rows: ArchivedQuoteRow[] = [];
  const seen = new Set<string>();

  for (const program of seed.programs) {
    for (const marketId of program.polymarketMarketIds) {
      if (seen.has(marketId)) continue;
      seen.add(marketId);
      console.log(`Snapshot ${marketId} (${program.slug})…`);
      const gamma = await fetchGammaMarketById(marketId);
      if (!gamma) {
        console.warn(`  skip: gamma miss`);
        continue;
      }
      const tokens = yesNoTokenIds(gamma);
      if (!tokens) {
        console.warn(`  skip: no YES/NO tokens`);
        continue;
      }
      try {
        const [yesBook, noBook] = await Promise.all([
          fetchClobOrderBook(tokens.yes, { marketId: `pm_${marketId}`, depth: 10 }),
          fetchClobOrderBook(tokens.no, { marketId: `pm_${marketId}`, depth: 10 }),
        ]);
        const quotes = extractExecutableQuotes(yesBook, noBook);
        rows.push({
          kind: "archived_clob_quote",
          capturedAt,
          marketId,
          tokenYesId: tokens.yes,
          tokenNoId: tokens.no,
          bestAskYes: quotes.yesAsk,
          bestAskNo: quotes.noAsk,
          bestAskYesSize: quotes.yesAskSize,
          bestAskNoSize: quotes.noAskSize,
          source: "quotes_snapshot",
          slug: program.slug,
          question: gamma.question,
        });
        console.log(
          `  YES ask=${quotes.yesAsk} (sz ${quotes.yesAskSize}) · NO ask=${quotes.noAsk} (sz ${quotes.noAskSize})`,
        );
      } catch (err) {
        console.warn(`  skip: ${err instanceof Error ? err.message : err}`);
      }
    }
  }

  return appendQuoteRows(rows, root);
}

async function main() {
  const times = parseTimes(process.argv);
  const root = defaultFixturesRoot();
  const seed = JSON.parse(
    await readFile(path.join(root, "enrichment/seed-programs.json"), "utf8"),
  ) as SeedFile;

  let appended = 0;
  for (let i = 0; i < times; i++) {
    if (times > 1) console.log(`\n=== pass ${i + 1}/${times} ===`);
    appended += await snapshotOnce(root, seed);
    if (i + 1 < times) await new Promise((r) => setTimeout(r, 2000));
  }

  const all = await loadQuoteArchive(root);
  const summary = summarizeQuoteVault(all, root);
  await writeQuoteVaultSummary(summary, root);
  const days = new Set(all.map((r) => r.capturedAt.slice(0, 10))).size;

  console.log(
    JSON.stringify(
      {
        appended,
        passes: times,
        totalRows: summary.totalRows,
        distinctMarkets: summary.distinctMarkets,
        distinctUtcDays: days,
        latestCapturedAt: summary.latestCapturedAt,
        archive: "fixtures/quotes/archive.jsonl",
        note: "Re-snapshot when asks may be stale (>48h). Multi-day history is optional for edge studies.",
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
