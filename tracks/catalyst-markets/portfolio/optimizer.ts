export type PortfolioSignal = {
  ticker: string;
  eventId: string;
  expectedReturn: number;
  expectedDownside: number;
  confidence: number;
  xbiBeta: number;
  spyBeta: number;
  target: string | null;
  indication: string | null;
};

export type PortfolioPosition = {
  ticker: string;
  weight: number;
  side: "long" | "short";
};

/**
 * Constrained equal-risk heuristic (Notion portfolio layer).
 * Enable only after event-level OOS edge exists.
 */
export function optimizePortfolio(
  signals: PortfolioSignal[],
  opts?: {
    maxWeight?: number;
    hedgeWithXbi?: boolean;
    maxTargetExposure?: number;
  },
): {
  positions: PortfolioPosition[];
  expectedAlpha: number;
  estimatedXbiBeta: number;
} {
  const maxWeight = opts?.maxWeight ?? 0.05;
  const hedge = opts?.hedgeWithXbi ?? true;

  const longs = signals
    .filter((s) => s.expectedReturn > 0)
    .sort((a, b) => b.expectedReturn - a.expectedReturn)
    .slice(0, 8);

  const positions: PortfolioPosition[] = longs.map((s) => ({
    ticker: s.ticker,
    weight: Math.min(maxWeight, 1 / Math.max(1, longs.length)),
    side: "long" as const,
  }));

  let xbiBeta = longs.reduce(
    (s, x, i) => s + x.xbiBeta * (positions[i]?.weight ?? 0),
    0,
  );

  if (hedge && positions.length > 0) {
    const grossLong = positions.reduce((s, p) => s + p.weight, 0);
    positions.push({ ticker: "XBI", weight: -grossLong * 0.8, side: "short" });
    xbiBeta = xbiBeta - 0.8 * grossLong;
  }

  const expectedAlpha = longs.reduce(
    (s, x, i) => s + x.expectedReturn * (positions[i]?.weight ?? 0),
    0,
  );

  return { positions, expectedAlpha, estimatedXbiBeta: xbiBeta };
}
