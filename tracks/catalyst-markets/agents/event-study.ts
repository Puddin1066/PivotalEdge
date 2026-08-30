import { computeEventStudy } from "../event-study/abnormal-returns.js";
import { fetchDailyPrices } from "../ingestion/prices.js";
import { okAgent, type AgentResponse } from "../schemas/agent-outputs.js";
import type { CatalystEvent } from "../schemas/event.js";

/** Historical only — produces AR/CAR labels (Notion Event-Study Agent). */
export async function runEventStudyAgent(
  event: CatalystEvent,
  mode: "historical" | "live",
): Promise<AgentResponse> {
  if (mode === "live") {
    return {
      agent: "event_study_agent",
      eventId: event.eventId,
      asOf: event.informationCutoff,
      status: "skipped",
      data: { reason: "live_mode_labels_after_catalyst" },
      confidence: 1,
      sources: [],
      warnings: ["Event-study labeling disabled in live mode"],
    };
  }

  const stock = await fetchDailyPrices(event.ticker);
  const market = await fetchDailyPrices("XBI");
  const result = computeEventStudy({
    stockBars: stock,
    marketBars: market,
    eventDate: event.eventDate,
  });

  return okAgent(
    "event_study_agent",
    event.eventId,
    event.informationCutoff,
    { ...result, benchmark: "XBI_market_model" },
    { confidence: result.estimationDays >= 40 ? 0.9 : 0.6 },
  );
}
