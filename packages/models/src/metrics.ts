export function brierScore(predicted: number, observed: 0 | 1): number {
  const p = Math.min(1, Math.max(0, predicted));
  return (p - observed) ** 2;
}

export function meanBrier(predictions: number[], outcomes: (0 | 1)[]): number {
  if (predictions.length !== outcomes.length || predictions.length === 0) {
    throw new Error("predictions and outcomes must be same non-empty length");
  }
  const total = predictions.reduce((sum, p, i) => sum + brierScore(p, outcomes[i]!), 0);
  return total / predictions.length;
}
