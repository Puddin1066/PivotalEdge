import { okAgent, type AgentResponse } from "../schemas/agent-outputs.js";
import type { CatalystEvent } from "../schemas/event.js";
import type { CatalystPipelineState } from "../orchestration/state.js";

/** Thesis from structured outputs only — no free-form agent chat. */
export function runThesisAgent(
  event: CatalystEvent,
  state: CatalystPipelineState,
): AgentResponse {
  const thesis = [
    `${event.ticker} — ${event.drug ?? "asset"} ${event.eventType} (${event.indication ?? "n/a"})`,
    `Model P(success): ${state.pSuccess != null ? (state.pSuccess * 100).toFixed(0) + "%" : "n/a"}`,
    `Market P(success): ${
      state.marketImpliedProbability != null
        ? (state.marketImpliedProbability * 100).toFixed(0) + "%"
        : "n/a"
    }`,
    `Probability edge: ${
      state.probabilityEdge != null
        ? (state.probabilityEdge >= 0 ? "+" : "") +
          (state.probabilityEdge * 100).toFixed(0) +
          " pts"
        : "n/a"
    }`,
    `Expected CAR if success: ${fmtPct(state.rSuccess)}`,
    `Expected CAR if failure: ${fmtPct(state.rFailure)}`,
    `Probability-weighted CAR: ${fmtPct(state.expectedReturn)}`,
    `Nearest historical analogs: ${state.graphPrecedents?.length ?? 0}`,
    `Leakage audit: ${(state.auditStatus ?? "pending").toUpperCase()}`,
  ].join("\n");

  const counter = [
    "Outcome label noise or mis-timed catalyst date.",
    "Market-implied probability proxy may be weak without options/IV.",
    "Precedent set may be sparse for novel targets.",
  ];

  return okAgent("thesis_agent", event.eventId, event.informationCutoff, {
    thesis,
    counterThesis: counter,
  });
}

function fmtPct(x: number | null | undefined): string {
  if (x == null) return "n/a";
  const sign = x >= 0 ? "+" : "";
  return `${sign}${(x * 100).toFixed(1)}%`;
}
