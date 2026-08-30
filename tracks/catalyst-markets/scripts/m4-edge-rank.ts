import { simulateTopEdgeBook } from "../backtest/portfolio.js";
import { partitionBySplit } from "../backtest/temporal-split.js";
import { loadEventFixtures } from "../ingestion/aact.js";
import { runCatalystPipeline } from "../orchestration/graph.js";

/** Milestone 4 — multi-agent edge ranking on chronological holdout. */
async function main() {
  const events = (await loadEventFixtures()).filter((e) => e.outcomeLabel != null);
  const parts = partitionBySplit(events);
  const holdout = [...parts.validate, ...parts.test];
  const predictions = [];
  for (const e of holdout) {
    const { prediction, state } = await runCatalystPipeline(e, {
      mode: "backtest",
      runId: `m4_${e.eventId}`,
    });
    if (prediction) {
      predictions.push({
        ...prediction,
        realizedCar: e.carM1P1,
        thesisPreview: state.thesis?.split("\n")[0],
      });
    }
  }
  const book = simulateTopEdgeBook(predictions, { topN: 3, costBps: 25 });
  console.log(
    JSON.stringify(
      {
        milestone: "M4",
        holdoutN: holdout.length,
        predictions: predictions.map((p) => ({
          eventId: p.eventId,
          pSuccess: p.pSuccess,
          probabilityEdge: p.probabilityEdge,
          expectedCatalystReturn: p.expectedCatalystReturn,
          realizedCar: p.realizedCar,
          auditStatus: p.auditStatus,
        })),
        topEdgeBook: book,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
