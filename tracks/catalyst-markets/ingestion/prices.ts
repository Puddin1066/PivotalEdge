import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { PriceBar } from "../event-study/windows.js";

const here = path.dirname(fileURLToPath(import.meta.url));
export const FIXTURES_ROOT = path.join(here, "..", "fixtures");

export type PriceFixture = {
  symbol: string;
  bars: PriceBar[];
};

export async function loadPriceFixture(symbol: string): Promise<PriceFixture> {
  const file = path.join(FIXTURES_ROOT, "prices", `${symbol.toLowerCase()}.json`);
  const raw = JSON.parse(await readFile(file, "utf8")) as PriceFixture;
  return raw;
}

/** MOCK: local fixture prices only — not a live market-data API. */
export async function fetchDailyPrices(
  symbol: string,
  _opts?: { start?: string; end?: string },
): Promise<PriceBar[]> {
  const fx = await loadPriceFixture(symbol);
  return fx.bars;
}
