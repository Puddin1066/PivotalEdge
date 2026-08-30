import type { CatalystPrediction } from "../schemas/prediction.js";

/** Simple equal-weight book of top-edge events (pre-optimizer). */
export function simulateTopEdgeBook(
  predictions: CatalystPrediction[],
  opts?: { topN?: number; costBps?: number },
): {
  n: number;
  meanExpectedReturn: number;
  meanExpectedReturnAfterCost: number;
} {
  const topN = opts?.topN ?? 5;
  const cost = (opts?.costBps ?? 20) / 10_000;
  const ranked = [...predictions]
    .filter((p) => p.auditStatus === "pass")
    .sort(
      (a, b) =>
        (b.probabilityEdge ?? b.expectedCatalystReturn) -
        (a.probabilityEdge ?? a.expectedCatalystReturn),
    )
    .slice(0, topN);

  if (ranked.length === 0) {
    return { n: 0, meanExpectedReturn: 0, meanExpectedReturnAfterCost: 0 };
  }
  const mean =
    ranked.reduce((s, p) => s + p.expectedCatalystReturn, 0) / ranked.length;
  return {
    n: ranked.length,
    meanExpectedReturn: mean,
    meanExpectedReturnAfterCost: mean - cost,
  };
}
