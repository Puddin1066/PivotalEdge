export type RankedPrediction = {
  eventId: string;
  predictedEdge: number;
  realizedCar: number | null;
};

/** Decile mean realized CAR by predicted edge (Notion equity metrics). */
export function realizedByPredictedDecile(
  rows: RankedPrediction[],
): Array<{ decile: number; n: number; meanRealizedCar: number | null }> {
  const scored = [...rows].sort((a, b) => a.predictedEdge - b.predictedEdge);
  if (scored.length === 0) return [];
  const out: Array<{ decile: number; n: number; meanRealizedCar: number | null }> =
    [];
  for (let d = 0; d < 10; d++) {
    const start = Math.floor((d * scored.length) / 10);
    const end = Math.floor(((d + 1) * scored.length) / 10);
    const bucket = scored.slice(start, end);
    const realized = bucket
      .map((r) => r.realizedCar)
      .filter((x): x is number => x != null);
    out.push({
      decile: d + 1,
      n: bucket.length,
      meanRealizedCar:
        realized.length === 0
          ? null
          : realized.reduce((a, b) => a + b, 0) / realized.length,
    });
  }
  return out;
}

export function signAccuracy(
  rows: Array<{ predicted: number; realized: number }>,
): number {
  if (rows.length === 0) return 0;
  let hit = 0;
  for (const r of rows) {
    if (Math.sign(r.predicted) === Math.sign(r.realized) || r.realized === 0) {
      hit++;
    }
  }
  return hit / rows.length;
}

export function mae(rows: Array<{ predicted: number; realized: number }>): number {
  if (rows.length === 0) return 0;
  return (
    rows.reduce((s, r) => s + Math.abs(r.predicted - r.realized), 0) / rows.length
  );
}
