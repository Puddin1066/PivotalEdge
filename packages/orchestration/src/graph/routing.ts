import type { EnrichmentGraphStateType } from "./graph-state.js";

export type GraphRoute = "plan_research" | "finalize";

export type PostReviewRoute = "write_evidence" | "finalize";

export function routeAfterEvaluateGaps(state: EnrichmentGraphStateType): GraphRoute {
  if (state.shouldContinueResearch) return "plan_research";
  return "finalize";
}

export function routeAfterValidate(state: EnrichmentGraphStateType): "human_review_gate" | "finalize" {
  if (state.lastValidatedCount > 0) return "human_review_gate";
  return "finalize";
}

export function routeAfterHumanReview(state: EnrichmentGraphStateType): PostReviewRoute {
  if (state.reviewRejected || state.pendingEvidence.length === 0) return "finalize";
  return "write_evidence";
}
