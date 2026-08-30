import type { CatalystPipelineState } from "./state.js";

export type RouteDecision =
  | { next: "continue" }
  | { next: "reject"; reason: string }
  | { next: "thesis" }
  | { next: "end" };

/** Deterministic routing after audit (Notion §5 mermaid). */
export function routeAfterAudit(state: CatalystPipelineState): RouteDecision {
  if (state.auditStatus === "fail") {
    return { next: "reject", reason: state.auditFindings.join("; ") || "audit_fail" };
  }
  return { next: "thesis" };
}
