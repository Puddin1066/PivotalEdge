import { isAvailableAtCutoff } from "@pivotaledge/schemas";

import { okAgent, type AgentResponse } from "../schemas/agent-outputs.js";
import type { CatalystEvent } from "../schemas/event.js";
import type { CatalystPipelineState } from "../orchestration/state.js";

/**
 * Audit / leakage agent (Notion §14).
 * Fails closed on post-cutoff evidence or missing mandatory cutoff.
 */
export function runAuditAgent(
  event: CatalystEvent,
  state: CatalystPipelineState,
): AgentResponse {
  const findings: string[] = [];

  if (!event.informationCutoff) {
    findings.push("missing_information_cutoff");
  }

  for (const src of state.provenance) {
    if (src.firstPublicAt && !isAvailableAtCutoff(src.firstPublicAt, event.informationCutoff)) {
      findings.push(`leakage:${src.url ?? "unknown"}`);
    }
  }

  if (state.pSuccess == null) {
    findings.push("missing_p_success");
  }

  // Event-study labels are required only when building/evaluating historical records.
  if (
    (state.mode === "historical" || state.mode === "backtest") &&
    state.abnormalReturns == null
  ) {
    findings.push("missing_event_study_labels");
  }

  const pass = findings.length === 0;
  return okAgent(
    "audit_agent",
    event.eventId,
    event.informationCutoff,
    {
      auditStatus: pass ? "pass" : "fail",
      findings,
    },
    { confidence: 1, warnings: findings },
  );
}
