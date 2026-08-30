import { loadEventFixtures } from "../ingestion/aact.js";
import { okAgent, type AgentResponse } from "../schemas/agent-outputs.js";
import type { CatalystEvent } from "../schemas/event.js";

/**
 * Minimal KG-style neighbor retrieval (Notion Graph Retrieval Agent).
 * Same target / indication / sponsor — cutoff constrained.
 */
export async function runGraphRetrievalAgent(
  event: CatalystEvent,
): Promise<AgentResponse> {
  const corpus = await loadEventFixtures();
  const cutoffMs = Date.parse(event.informationCutoff);

  const precedents = corpus
    .filter((e) => e.eventId !== event.eventId)
    .filter((e) => Date.parse(e.informationCutoff) <= cutoffMs)
    .filter((e) => Date.parse(e.eventDate) < Date.parse(event.eventDate))
    .map((e) => {
      let score = 0;
      if (e.target && e.target === event.target) score += 3;
      if (e.indication && e.indication === event.indication) score += 2;
      if (e.ticker === event.ticker) score += 1;
      if (e.phase != null && e.phase === event.phase) score += 1;
      return { event: e, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map(({ event: e, score }) => ({
      eventId: e.eventId,
      ticker: e.ticker,
      target: e.target,
      indication: e.indication,
      outcomeLabel: e.outcomeLabel,
      carM1P1: e.carM1P1,
      score,
    }));

  const successRate =
    precedents.filter((p) => p.outcomeLabel === "positive").length /
    Math.max(1, precedents.filter((p) => p.outcomeLabel != null).length);

  return okAgent("graph_retrieval_agent", event.eventId, event.informationCutoff, {
    precedents,
    nearestAnalogCount: precedents.length,
    sameTargetSuccessRate: successRate,
  });
}
