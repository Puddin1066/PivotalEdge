/**
 * Calculated regulatory / trial clock metrics (evidence layer: calculated_metric).
 * Sourced dates stay on entities; deltas are derived at forecast cutoff.
 */

export type ClockDateInputs = {
  forecastCutoff: string;
  eventDeadline?: string | null;
  registeredAt?: string | null;
  studyStartAt?: string | null;
  primaryCompletionAt?: string | null;
  completionAt?: string | null;
  filedAt?: string | null;
  acceptedAt?: string | null;
  pdufaDate?: string | null;
  expectedFilingAt?: string | null;
  actionDate?: string | null;
  reviewProgram?: string | null;
};

export type RegulatoryClockMetrics = {
  daysRegistrationToPrimaryCompletion: number | null;
  daysPrimaryCompletionToAcceptance: number | null;
  daysAcceptanceToPdufa: number | null;
  daysAcceptanceToAction: number | null;
  daysCutoffToPdufa: number | null;
  daysCutoffToDeadline: number | null;
  daysPdufaToDeadline: number | null;
  daysExpectedFilingToDeadline: number | null;
  /** Model prior for review length when PDUFA unpublished (CNPV ≈ 45d, priority ≈ 180d). */
  inferredReviewWindowDays: number;
};

const MS_PER_DAY = 86_400_000;

export function daysBetween(aIso: string | null | undefined, bIso: string | null | undefined): number | null {
  if (!aIso || !bIso) return null;
  const a = Date.parse(aIso);
  const b = Date.parse(bIso);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return (b - a) / MS_PER_DAY;
}

export function inferredReviewWindowDays(reviewProgram: string | null | undefined): number {
  switch (reviewProgram) {
    case "cnpv":
      return 45;
    case "priority":
    case "accelerated":
      return 180;
    case "standard":
      return 300;
    default:
      return 240;
  }
}

/** Derive milestone deltas used by features / decision_by_T. */
export function computeRegulatoryClockMetrics(input: ClockDateInputs): RegulatoryClockMetrics {
  const reviewDays = inferredReviewWindowDays(input.reviewProgram);
  return {
    daysRegistrationToPrimaryCompletion: daysBetween(
      input.registeredAt ?? input.studyStartAt,
      input.primaryCompletionAt,
    ),
    daysPrimaryCompletionToAcceptance: daysBetween(input.primaryCompletionAt, input.acceptedAt),
    daysAcceptanceToPdufa: daysBetween(input.acceptedAt, input.pdufaDate),
    daysAcceptanceToAction: daysBetween(input.acceptedAt, input.actionDate),
    daysCutoffToPdufa: daysBetween(input.forecastCutoff, input.pdufaDate),
    daysCutoffToDeadline: daysBetween(input.forecastCutoff, input.eventDeadline),
    daysPdufaToDeadline: daysBetween(input.pdufaDate, input.eventDeadline),
    daysExpectedFilingToDeadline: daysBetween(input.expectedFilingAt, input.eventDeadline),
    inferredReviewWindowDays: reviewDays,
  };
}
