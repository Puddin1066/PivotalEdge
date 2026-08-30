import type { ModelFeatures } from "./features.js";
import { inferredReviewWindowDays } from "./clock-math.js";

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export { daysBetween, inferredPeToFilingLagDays, inferredReviewWindowDays } from "./clock-math.js";

/**
 * P(FDA decision by market deadline | acceptance / PDUFA / filing guidance).
 * Uses calculated milestone deltas — not a point estimate of approval day.
 */
export function decisionByDeadlineProbability(
  features: ModelFeatures,
  eventDeadline: string | null,
): number {
  if (features.programStatus === "approved") return 1;
  if (features.programStatus === "crl") return 0;

  const reviewDays =
    features.inferredReviewWindowDays ?? inferredReviewWindowDays(features.reviewProgram);
  const deadlineMs = eventDeadline ? Date.parse(eventDeadline) : Number.NaN;
  const hasDeadline = Number.isFinite(deadlineMs);

  if (features.applicationAccepted && features.pdufaDate) {
    const pdufaMs = Date.parse(features.pdufaDate);
    if (!Number.isFinite(pdufaMs)) return 0.7;
    if (!hasDeadline) return 0.75;
    if (pdufaMs <= deadlineMs) {
      const slackDays = (deadlineMs - pdufaMs) / 86_400_000;
      return clamp01(0.86 + Math.min(0.12, Math.max(0, slackDays) / 365 * 0.12));
    }
    const overrun = (pdufaMs - deadlineMs) / 86_400_000;
    return clamp01(0.22 * Math.exp(-overrun / 90));
  }

  if (features.applicationAccepted && features.acceptedAt) {
    const acceptedMs = Date.parse(features.acceptedAt);
    if (!Number.isFinite(acceptedMs)) return 0.7;
    const inferredAction = acceptedMs + reviewDays * 86_400_000;
    if (!hasDeadline) return 0.72;
    if (inferredAction <= deadlineMs) {
      const slackDays = (deadlineMs - inferredAction) / 86_400_000;
      // CNPV + months of slack to year-end → near-certain clock
      return clamp01(0.9 + Math.min(0.08, Math.max(0, slackDays) / 180 * 0.08));
    }
    return clamp01(0.18 * Math.exp(-(inferredAction - deadlineMs) / 86_400_000 / 60));
  }

  if (features.expectedFilingAt && hasDeadline) {
    const filingMs = Date.parse(features.expectedFilingAt);
    if (!Number.isFinite(filingMs)) return 0.4;
    const inferredAction = filingMs + reviewDays * 86_400_000;
    if (inferredAction > deadlineMs) return 0.1;
    return 0.42;
  }

  if (
    features.primaryEndpointMet === true &&
    features.primaryResultPublicAt &&
    hasDeadline &&
    features.peToFilingLagPriorDays != null &&
    !features.applicationAccepted &&
    !features.expectedFilingAt &&
    !features.pdufaDate
  ) {
    const peMs = Date.parse(features.primaryResultPublicAt);
    if (Number.isFinite(peMs)) {
      const filingMs = peMs + features.peToFilingLagPriorDays * 86_400_000;
      const inferredAction = filingMs + reviewDays * 86_400_000;
      if (inferredAction > deadlineMs) return 0.08;
      const slackDays = (deadlineMs - inferredAction) / 86_400_000;
      return clamp01(0.22 + Math.min(0.18, Math.max(0, slackDays) / 365 * 0.18));
    }
  }

  const daysLeft = features.daysCutoffToDeadline;
  if (daysLeft == null) return 0.5;
  if (daysLeft > 400) return 0.55;
  if (daysLeft > 200) return 0.45;
  if (daysLeft > 90) return 0.35;
  return 0.25;
}

/** P(submission by market deadline) using filing state + sponsor guidance + PE→filing priors. */
export function submissionByDeadlineProbability(features: ModelFeatures, eventDeadline: string | null): number {
  if (features.applicationAccepted || features.applicationFiled) return 0.95;

  if (features.expectedFilingAt && eventDeadline) {
    const filingMs = Date.parse(features.expectedFilingAt);
    const deadlineMs = Date.parse(eventDeadline);
    if (Number.isFinite(filingMs) && Number.isFinite(deadlineMs)) {
      if (filingMs > deadlineMs) return 0.08;
      const leadDays = (deadlineMs - filingMs) / 86_400_000;
      return clamp01(0.35 + Math.min(0.35, leadDays / 365 * 0.35));
    }
  }

  if (
    features.primaryEndpointMet === true &&
    features.primaryResultPublicAt &&
    eventDeadline &&
    features.peToFilingLagPriorDays != null
  ) {
    const peMs = Date.parse(features.primaryResultPublicAt);
    const deadlineMs = Date.parse(eventDeadline);
    if (Number.isFinite(peMs) && Number.isFinite(deadlineMs)) {
      const estimatedFilingMs = peMs + features.peToFilingLagPriorDays * 86_400_000;
      if (estimatedFilingMs > deadlineMs) return 0.12;
      const leadDays = (deadlineMs - estimatedFilingMs) / 86_400_000;
      return clamp01(0.28 + Math.min(0.3, leadDays / 365 * 0.3));
    }
  }

  if (features.primaryEndpointMet === true) return 0.72;
  if (features.primaryEndpointMet === false) return 0.2;
  return 0.35;
}

export function acceptanceGivenSubmissionProbability(features: ModelFeatures): number {
  if (features.applicationAccepted) return 0.98;
  if (features.applicationFiled) return 0.93;
  return 0.8;
}
