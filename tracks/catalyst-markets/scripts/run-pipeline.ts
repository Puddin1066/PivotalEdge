import { loadEventById } from "../ingestion/aact.js";
import { runCatalystPipeline } from "../orchestration/graph.js";

/** Run full multi-agent pipeline for one event (default: phase-3 fixture). */
async function main() {
  const eventId = process.argv[2] ?? "NCT01234567_2024-05-17";
  const mode = (process.argv[3] as "historical" | "live" | "backtest") ?? "historical";
  const event = await loadEventById(eventId);
  const result = await runCatalystPipeline(event, { mode, runId: `run_${eventId}` });
  console.log(
    JSON.stringify(
      {
        eventId,
        mode,
        auditStatus: result.state.auditStatus,
        prediction: result.prediction,
        thesis: result.state.thesis,
        agents: result.state.agentLog.map((a) => ({
          agent: a.agent,
          status: a.status,
          confidence: a.confidence,
        })),
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
