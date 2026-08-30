/** Polymarket CLOB order book — read-only (no API key). */

import type { OrderBookSnapshot } from "@pivotaledge/schemas";
import { OrderBookSnapshotSchema } from "@pivotaledge/schemas";

const DEFAULT_CLOB_URL = "https://clob.polymarket.com";

type ClobLevel = { price: string; size: string };

type ClobBookResponse = {
  bids?: ClobLevel[];
  asks?: ClobLevel[];
};

export type FetchOrderBookOptions = {
  baseUrl?: string;
  marketId: string;
  snapshotId?: string;
  depth?: number;
};

function parseLevels(levels: ClobLevel[] | undefined): { price: number; size: number }[] {
  if (!levels?.length) return [];
  return levels
    .map((l) => ({ price: Number(l.price), size: Number(l.size) }))
    .filter((l) => Number.isFinite(l.price) && Number.isFinite(l.size) && l.size > 0);
}

function sortBids(levels: { price: number; size: number }[]): { price: number; size: number }[] {
  return [...levels].sort((a, b) => b.price - a.price);
}

function sortAsks(levels: { price: number; size: number }[]): { price: number; size: number }[] {
  return [...levels].sort((a, b) => a.price - b.price);
}

export function normalizeClobBook(
  raw: ClobBookResponse,
  options: FetchOrderBookOptions,
): OrderBookSnapshot {
  const bids = sortBids(parseLevels(raw.bids));
  const asks = sortAsks(parseLevels(raw.asks));
  const bestBid = bids[0]?.price ?? null;
  const bestAsk = asks[0]?.price ?? null;
  const midpoint = bestBid != null && bestAsk != null ? (bestBid + bestAsk) / 2 : null;

  return OrderBookSnapshotSchema.parse({
    id: options.snapshotId ?? `ob_${options.marketId}_${Date.now()}`,
    marketId: options.marketId,
    capturedAt: new Date().toISOString(),
    bids,
    asks,
    midpoint,
    bestBid,
    bestAsk,
  });
}

export async function fetchClobOrderBook(
  tokenId: string,
  options: FetchOrderBookOptions,
): Promise<OrderBookSnapshot> {
  const baseUrl = options.baseUrl ?? DEFAULT_CLOB_URL;
  const url = new URL("/book", baseUrl);
  url.searchParams.set("token_id", tokenId);

  const response = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`CLOB book fetch failed (${response.status}): ${url.toString()}`);
  }
  const raw = (await response.json()) as ClobBookResponse;
  return normalizeClobBook(raw, options);
}

export function orderBookFromFixture(
  fixture: OrderBookSnapshot,
  overrides?: Partial<Pick<OrderBookSnapshot, "id" | "capturedAt">>,
): OrderBookSnapshot {
  return OrderBookSnapshotSchema.parse({
    ...fixture,
    ...overrides,
  });
}
