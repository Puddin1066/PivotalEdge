import { loadEventFixtures } from "../ingestion/aact.js";
import { runCatalystPipeline } from "../orchestration/graph.js";

/** Milestone 5 — freeze live/forward forecasts (no retrospective edits). */
async function main() {
  const live = (await loadEventFixtures()).filter(
    (e) => e.outcomeLabel == null || e.eventId.includes("LIVE"),
  );
  const frozen = [];
  for (const e of live) {
    const result = await runCatalystPipeline(e, {
      mode: "live",
      freeze: true,
      runId: `m5_${e.eventId}`,
    });
    frozen.push({
      eventId: e.eventId,
      frozenPath: result.frozenPath,
      prediction: result.prediction,
      auditStatus: result.state.auditStatus,
      thesis: result.state.thesis,
    });
  }
  console.log(JSON.stringify({ milestone: "M5", frozen }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
