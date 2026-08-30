import { runTrialAgent } from "../agents/trial.js";
import { runGraphRetrievalAgent } from "../agents/graph-retrieval.js";
import { cosineSimilarity } from "../embeddings/trial.js";
import { loadEventFixtures } from "../ingestion/aact.js";
import type { FieldEmbeddings } from "../embeddings/trial.js";

/** Milestone 3 — field embeddings + minimal graph precedents. */
async function main() {
  const events = await loadEventFixtures();
  const rows = [];
  for (const e of events) {
    const trial = runTrialAgent(e);
    const graph = await runGraphRetrievalAgent(e);
    const emb = trial.data.embeddings as FieldEmbeddings;
    rows.push({
      eventId: e.eventId,
      endpointNorm: Math.hypot(...emb.endpoint),
      nearestAnalogs: graph.data.nearestAnalogCount,
      sameTargetSuccessRate: graph.data.sameTargetSuccessRate,
      selfSim: cosineSimilarity(emb.mechanism, emb.mechanism),
    });
  }
  console.log(JSON.stringify({ milestone: "M3", rows }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
