/** YES/NO CLOB token id helpers for Polymarket Gamma markets. */

export function yesNoTokenIds(market: {
  clobTokenIds: string[];
  outcomes: string[];
}): { yes: string; no: string } | null {
  const tokens = market.clobTokenIds;
  if (tokens.length < 2) return null;
  const outcomes = market.outcomes.map((o) => o.toLowerCase());
  const yesIdx = outcomes.findIndex((o) => o === "yes");
  const noIdx = outcomes.findIndex((o) => o === "no");
  if (yesIdx >= 0 && noIdx >= 0 && tokens[yesIdx] && tokens[noIdx]) {
    return { yes: tokens[yesIdx]!, no: tokens[noIdx]! };
  }
  return { yes: tokens[0]!, no: tokens[1]! };
}
