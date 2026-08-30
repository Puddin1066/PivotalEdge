import type { ReturnSeries } from "./windows.js";

export type MarketModelParams = {
  alpha: number;
  beta: number;
};

/**
 * OLS market model on estimation window: R_i = alpha + beta * R_m + e.
 * Notion §10 — reproducible expected-return baseline.
 */
export function fitMarketModel(
  stock: ReturnSeries[],
  market: ReturnSeries[],
): MarketModelParams {
  const byDate = new Map(market.map((m) => [m.date, m.ret]));
  const xs: number[] = [];
  const ys: number[] = [];
  for (const s of stock) {
    const m = byDate.get(s.date);
    if (m === undefined) continue;
    xs.push(m);
    ys.push(s.ret);
  }
  if (xs.length < 5) {
    return { alpha: 0, beta: 1 };
  }
  const n = xs.length;
  let sumX = 0;
  let sumY = 0;
  let sumXX = 0;
  let sumXY = 0;
  for (let i = 0; i < n; i++) {
    sumX += xs[i]!;
    sumY += ys[i]!;
    sumXX += xs[i]! * xs[i]!;
    sumXY += xs[i]! * ys[i]!;
  }
  const denom = n * sumXX - sumX * sumX;
  if (Math.abs(denom) < 1e-12) {
    return { alpha: sumY / n, beta: 1 };
  }
  const beta = (n * sumXY - sumX * sumY) / denom;
  const alpha = sumY / n - beta * (sumX / n);
  return { alpha, beta };
}

export function expectedReturn(
  params: MarketModelParams,
  marketRet: number,
): number {
  return params.alpha + params.beta * marketRet;
}

/** XBI-relative model: treat XBI as the sole factor (beta vs XBI). */
export function fitXbiRelativeModel(
  stock: ReturnSeries[],
  xbi: ReturnSeries[],
): MarketModelParams {
  return fitMarketModel(stock, xbi);
}
