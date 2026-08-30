import { okAgent, type AgentResponse } from "../schemas/agent-outputs.js";
import type { CatalystEvent } from "../schemas/event.js";
import type { OutcomeLabels } from "../schemas/outcomes.js";

/** Historical only — live mode should skip until post-catalyst. */
export function runOutcomeAgent(
  event: CatalystEvent,
  mode: "historical" | "live",
): AgentResponse {
  if (mode === "live") {
    return {
      agent: "outcome_agent",
      eventId: event.eventId,
      asOf: event.informationCutoff,
      status: "skipped",
      data: { reason: "live_mode_no_outcome_until_after_catalyst" },
      confidence: 1,
      sources: [],
      warnings: ["Outcome agent disabled in live mode"],
    };
  }

  const labels: OutcomeLabels = {
    efficacyOutcome: event.outcomeLabel ?? "unknown",
    primaryEndpoint:
      event.primaryEndpointMet === true
        ? "met"
        : event.primaryEndpointMet === false
          ? "missed"
          : "unknown",
    safety: event.safetyLabel ?? "unknown",
    development:
      event.outcomeLabel === "positive"
        ? "advanced"
        : event.outcomeLabel === "negative"
          ? "discontinued"
          : "unclear",
    regulatory: event.eventType === "approval" ? "approved" : "not_applicable",
    source: "fixture",
    publicationDate: event.informationCutoff,
    confidence: 0.9,
    extractionMethod: "structured",
    humanReviewStatus: "accepted",
    evidenceUrl: null,
  };

  return okAgent("outcome_agent", event.eventId, event.informationCutoff, {
    labels,
  });
}
