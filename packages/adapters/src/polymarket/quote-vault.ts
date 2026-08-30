/**
 * Append-only Polymarket CLOB ask archive (outside clinical KG).
 * JSONL under fixtures/quotes/archive.jsonl
 */
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  ArchivedQuoteRowSchema,
  QuoteVaultSummarySchema,
  type ArchivedQuoteRow,
  type QuoteVaultSummary,
  defaultFixturesRoot,
} from "@pivotaledge/schemas";

export function quoteArchivePath(fixturesRoot = defaultFixturesRoot()): string {
  return path.join(fixturesRoot, "quotes/archive.jsonl");
}

export async function appendQuoteRows(
  rows: ArchivedQuoteRow[],
  fixturesRoot = defaultFixturesRoot(),
): Promise<number> {
  if (rows.length === 0) return 0;
  const archive = quoteArchivePath(fixturesRoot);
  await mkdir(path.dirname(archive), { recursive: true });
  const lines = rows
    .map((r) => JSON.stringify(ArchivedQuoteRowSchema.parse(r)))
    .join("\n");
  await appendFile(archive, `${lines}\n`, "utf8");
  return rows.length;
}

export async function loadQuoteArchive(
  fixturesRoot = defaultFixturesRoot(),
): Promise<ArchivedQuoteRow[]> {
  const archive = quoteArchivePath(fixturesRoot);
  let raw: string;
  try {
    raw = await readFile(archive, "utf8");
  } catch {
    return [];
  }
  const rows: ArchivedQuoteRow[] = [];
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    rows.push(ArchivedQuoteRowSchema.parse(JSON.parse(trimmed)));
  }
  return rows;
}

/** Latest quote per marketId (max capturedAt). */
export function latestQuotesByMarket(
  rows: ArchivedQuoteRow[],
): Map<string, ArchivedQuoteRow> {
  const map = new Map<string, ArchivedQuoteRow>();
  for (const row of rows) {
    const prev = map.get(row.marketId);
    if (!prev || row.capturedAt > prev.capturedAt) map.set(row.marketId, row);
  }
  return map;
}

/** Latest quote for market with capturedAt <= asOf (inclusive). */
export function quoteAsOf(
  rows: ArchivedQuoteRow[],
  marketId: string,
  asOf: string,
): ArchivedQuoteRow | null {
  let best: ArchivedQuoteRow | null = null;
  for (const row of rows) {
    if (row.marketId !== marketId) continue;
    if (row.capturedAt > asOf) continue;
    if (!best || row.capturedAt > best.capturedAt) best = row;
  }
  return best;
}

export function summarizeQuoteVault(
  rows: ArchivedQuoteRow[],
  fixturesRoot = defaultFixturesRoot(),
): QuoteVaultSummary {
  const byMarket = new Map<string, ArchivedQuoteRow[]>();
  for (const row of rows) {
    const list = byMarket.get(row.marketId) ?? [];
    list.push(row);
    byMarket.set(row.marketId, list);
  }
  const markets = [...byMarket.entries()]
    .map(([marketId, list]) => {
      const sorted = [...list].sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
      const latest = sorted.at(-1)!;
      return {
        marketId,
        slug: latest.slug,
        rows: list.length,
        latestCapturedAt: latest.capturedAt,
        latestBestAskYes: latest.bestAskYes,
        latestBestAskNo: latest.bestAskNo,
      };
    })
    .sort((a, b) => a.marketId.localeCompare(b.marketId));

  const latestCapturedAt =
    rows.map((r) => r.capturedAt).sort().at(-1) ?? null;

  return QuoteVaultSummarySchema.parse({
    kind: "quote_vault_summary",
    generatedAt: new Date().toISOString(),
    archivePath: "fixtures/quotes/archive.jsonl",
    totalRows: rows.length,
    distinctMarkets: markets.length,
    latestCapturedAt,
    markets,
  });
}

export async function writeQuoteVaultSummary(
  summary: QuoteVaultSummary,
  fixturesRoot = defaultFixturesRoot(),
): Promise<string> {
  const out = path.join(fixturesRoot, "quotes/summary.json");
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  return out;
}
