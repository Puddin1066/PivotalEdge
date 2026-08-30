import type { Forecast, OrderBookSnapshot } from "@pivotaledge/schemas";

import type { BettingPolicyConfig } from "./policy-config.js";

export type ExecutableQuotes = {
  yesAsk: number;
  yesBid: number | null;
  noAsk: number | null;
  yesAskSize: number;
  noAskSize: number;
};

export type EdgeEstimate = {
  executableYesPrice: number;
  executableNoPrice: number | null;
  netEdgeYes: number;
  netEdgeNo: number | null;
  marketImpliedProbability: number | null;
  marketAdjustedProbability: number;
};

function bestLevel(
  book: OrderBookSnapshot,
  side: "bid" | "ask",
): { price: number; size: number } | null {
  if (side === "ask") {
    if (book.bestAsk != null) {
      const level = book.asks[0];
      return { price: book.bestAsk, size: level?.size ?? 0 };
    }
    const level = book.asks[0];
    return level ? { price: level.price, size: level.size } : null;
  }
  if (book.bestBid != null) {
    const level = book.bids[0];
    return { price: book.bestBid, size: level?.size ?? 0 };
  }
  const level = book.bids[0];
  return level ? { price: level.price, size: level.size } : null;
}

/** Executable quotes from YES and optional NO order books (never midpoint). */
export function extractExecutableQuotes(
  yesBook: OrderBookSnapshot,
  noBook: OrderBookSnapshot | null,
): ExecutableQuotes {
  const yesAsk = bestLevel(yesBook, "ask");
  const yesBid = bestLevel(yesBook, "bid");
  const noAsk = noBook ? bestLevel(noBook, "ask") : null;

  if (!yesAsk) {
    throw new Error("YES order book missing executable ask");
  }

  return {
    yesAsk: yesAsk.price,
    yesBid: yesBid?.price ?? null,
    noAsk: noAsk?.price ?? null,
    yesAskSize: yesAsk.size,
    noAskSize: noAsk?.size ?? 0,
  };
}

export function computeEdge(
  forecast: Forecast,
  quotes: ExecutableQuotes,
  config: BettingPolicyConfig,
): EdgeEstimate {
  const netEdgeYes = forecast.conservativeProbability - quotes.yesAsk - config.feeRate;
  const conservativeNo = 1 - forecast.intervalHigh;
  const netEdgeNo = quotes.noAsk != null ? conservativeNo - quotes.noAsk - config.feeRate : null;

  const marketImpliedProbability = quotes.yesAsk;
  const shrink = 0.15;
  const marketAdjustedProbability =
    forecast.modelProbability * (1 - shrink) +
    (marketImpliedProbability ?? forecast.modelProbability) * shrink;

  return {
    executableYesPrice: quotes.yesAsk,
    executableNoPrice: quotes.noAsk,
    netEdgeYes,
    netEdgeNo,
    marketImpliedProbability,
    marketAdjustedProbability,
  };
}
