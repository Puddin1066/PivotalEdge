import type { StructuredTrialFeatures } from "../schemas/event.js";

/**
 * Model 0 — Lo-style structured baseline (Notion §11).
 * Simple logistic on hand-weighted factors — transparent, not an LLM oracle.
 */
export function estimatePSuccessBaseline(
  features: StructuredTrialFeatures,
  graph: { sameTargetSuccessRate?: number },
): { pSuccess: number; interval: [number, number] } {
  let logit = -0.2;
  if (features.phase === 3) logit += 0.35;
  if (features.phase === 2) logit += 0.1;
  if (features.hasPriorApprovalSameAsset) logit += 0.4;
  if (features.sponsorIsLargeCap) logit += 0.15;
  if (features.isOncology) logit -= 0.05;
  if (features.pipelineConcentration != null && features.pipelineConcentration > 0.7) {
    logit -= 0.05;
  }
  if (graph.sameTargetSuccessRate != null) {
    logit += (graph.sameTargetSuccessRate - 0.5) * 0.8;
  }

  const p = 1 / (1 + Math.exp(-logit));
  const lo = Math.max(0.05, p - 0.12);
  const hi = Math.min(0.95, p + 0.12);
  return { pSuccess: clamp01(p), interval: [lo, hi] };
}

function clamp01(x: number): number {
  return Math.min(0.95, Math.max(0.05, x));
}
