import type { BetAction } from "@pivotaledge/schemas";

/** Simulate binary market PnL using executable ask price and entry stake (mock, not live fills). */
export function simulateTradePnL(
  action: BetAction,
  executablePrice: number,
  stake: number,
  resolvedYes: boolean,
  feeRate: number,
): { grossPnL: number; feesPaid: number; netPnL: number } {
  if (action !== "BET_YES" && action !== "BET_NO") {
    return { grossPnL: 0, feesPaid: 0, netPnL: 0 };
  }

  const feesPaid = stake * feeRate;
  const won = action === "BET_YES" ? resolvedYes : !resolvedYes;
  const grossPnL = won ? stake / executablePrice - stake : -stake;
  return { grossPnL, feesPaid, netPnL: grossPnL - feesPaid };
}

/** Market baseline: always buy YES with the same stake sizing (no model selection). */
export function simulateMarketBaselinePnL(
  executableYesAsk: number,
  stake: number,
  resolvedYes: boolean,
  feeRate: number,
): number {
  return simulateTradePnL("BET_YES", executableYesAsk, stake, resolvedYes, feeRate).netPnL;
}
