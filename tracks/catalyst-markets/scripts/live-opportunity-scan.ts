import { loadEventFixtures } from "../ingestion/aact.js";
import { runCatalystPipeline } from "../orchestration/graph.js";
import { optimizePortfolio } from "../portfolio/optimizer.js";
import { biologicalClusterExposures } from "../portfolio/biological-risk.js";

/**
 * Live opportunity scan — upcoming catalysts (null outcome), rank by edge,
 * optional XBI-hedged book. MOCK fixtures until live price/catalyst feeds wired.
 */
async function main() {
  const upcoming = (await loadEventFixtures()).filter((e) => e.outcomeLabel == null);
  const scored = [];
  for (const e of upcoming) {
    const { prediction, state } = await runCatalystPipeline(e, {
      mode: "live",
      freeze: true,
      runId: `live_${e.eventId}`,
    });
    if (!prediction || prediction.auditStatus !== "pass") continue;
    scored.push({ event: e, prediction, thesis: state.thesis });
  }
  scored.sort(
    (a, b) =>
      (b.prediction.probabilityEdge ?? b.prediction.expectedCatalystReturn) -
      (a.prediction.probabilityEdge ?? a.prediction.expectedCatalystReturn),
  );

  const book = optimizePortfolio(
    scored.map(({ event, prediction }) => ({
      ticker: event.ticker,
      eventId: event.eventId,
      expectedReturn: prediction.expectedCatalystReturn,
      expectedDownside: prediction.rFailure,
      confidence: prediction.confidence,
      xbiBeta: 1.1,
      spyBeta: 0.4,
      target: event.target,
      indication: event.indication,
    })),
  );

  const clusters = biologicalClusterExposures(
    scored.map(({ event, prediction }) => ({
      weight: 0.04,
      target: event.target,
      indication: event.indication,
      expectedReturn: prediction.expectedCatalystReturn,
    })),
  );

  console.log(
    JSON.stringify(
      {
        scanned: upcoming.length,
        opportunities: scored.map(({ event, prediction }) => ({
          ticker: event.ticker,
          eventId: event.eventId,
          eventDate: event.eventDate,
          pSuccess: prediction.pSuccess,
          marketImplied: prediction.marketImpliedProbability,
          probabilityEdge: prediction.probabilityEdge,
          expectedCatalystReturn: prediction.expectedCatalystReturn,
          rSuccess: prediction.rSuccess,
          rFailure: prediction.rFailure,
        })),
        suggestedBook: book,
        biologicalClusterExposures: clusters,
        note: "MOCK fixture scan — not live brokerage execution",
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
