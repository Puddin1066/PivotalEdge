import { brierScore, meanBrier } from "@pivotaledge/models";

export type ReliabilityBin = {
  binLow: number;
  binHigh: number;
  meanPredicted: number;
  empiricalRate: number;
  count: number;
};

/** Equal-width reliability bins on [0, 1]. Empty bins are omitted. */
export function buildReliabilityBins(
  predictions: number[],
  outcomes: (0 | 1)[],
  binCount = 10,
): ReliabilityBin[] {
  if (predictions.length !== outcomes.length) {
    throw new Error("predictions and outcomes must be same length");
  }
  if (predictions.length === 0) return [];

  const bins: { preds: number[]; outcomes: (0 | 1)[] }[] = Array.from({ length: binCount }, () => ({
    preds: [],
    outcomes: [],
  }));

  for (let i = 0; i < predictions.length; i++) {
    const p = Math.min(1, Math.max(0, predictions[i]!));
    const idx = Math.min(binCount - 1, Math.floor(p * binCount));
    bins[idx]!.preds.push(p);
    bins[idx]!.outcomes.push(outcomes[i]!);
  }

  const width = 1 / binCount;
  return bins
    .map((bin, idx) => {
      if (bin.preds.length === 0) return null;
      const meanPredicted = bin.preds.reduce((s, v) => s + v, 0) / bin.preds.length;
      const empiricalRate = bin.outcomes.reduce<number>((s, v) => s + v, 0) / bin.outcomes.length;
      return {
        binLow: idx * width,
        binHigh: (idx + 1) * width,
        meanPredicted,
        empiricalRate,
        count: bin.preds.length,
      };
    })
    .filter((b): b is ReliabilityBin => b != null);
}

export function brierForPairs(predictions: number[], outcomes: (0 | 1)[]): number {
  if (predictions.length === 0) return Number.NaN;
  return meanBrier(predictions, outcomes);
}

export { brierScore };
