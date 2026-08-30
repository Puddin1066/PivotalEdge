import type { EvidenceRecord, ModelInformationGap, OrchestrationConfig } from "@pivotaledge/schemas";

export type ReviewGateState = {
  pendingEvidence: EvidenceRecord[];
  gaps: ModelInformationGap[];
};

/** True when validated evidence needs human approval before KG write. */
export function needsHumanReview(
  state: ReviewGateState,
  config: OrchestrationConfig,
): boolean {
  if (config.requireHumanReviewOnEvidence) return state.pendingEvidence.length > 0;

  for (const record of state.pendingEvidence) {
    if (record.firstPublicAt === null) return true;
    if (record.extractionConfidence < 0.7) return true;
  }

  return false;
}
