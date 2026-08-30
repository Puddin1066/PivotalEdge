import type { PortfolioPosition } from "./optimizer.js";

export function buildLongShortXbiHedge(
  ticker: string,
  longWeight: number,
): PortfolioPosition[] {
  return [
    { ticker, weight: longWeight, side: "long" },
    { ticker: "XBI", weight: -longWeight, side: "short" },
  ];
}
