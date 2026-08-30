import type { MarketQuestion, PrecedentBundle } from "@pivotaledge/schemas";

import { daysBetween, inferredPeToFilingLagDays, inferredReviewWindowDays } from "./clock-math.js";

export type ModelFeatures = {
  phase: string;
  therapeuticArea: string | null;
  primaryEndpointMet: boolean | null;
  applicationFiled: boolean;
  applicationAccepted: boolean;
  filedAt: string | null;
  acceptedAt: string | null;
  pdufaDate: string | null;
  expectedFilingAt: string | null;
  reviewProgram: string;
  forecastCutoff: string | null;
  eventDeadline: string | null;
  daysRegistrationToPrimaryCompletion: number | null;
  daysPrimaryCompletionToAcceptance: number | null;
  daysAcceptanceToPdufa: number | null;
  daysAcceptanceToAction: number | null;
  daysCutoffToPdufa: number | null;
  daysCutoffToDeadline: number | null;
  daysPdufaToDeadline: number | null;
  daysExpectedFilingToDeadline: number | null;
  inferredReviewWindowDays: number;
  cohortEmpiricalRate: number | null;
  cohortSize: number;
  supportingEvidenceCount: number;
  programStatus: string | null;
  /** KG enrichment (ADR 0011) — optional with safe defaults. */
  endpointFamily: string | null;
  biomarkerEnriched: boolean;
  orphanDesignated: boolean;
  designationCount: number;
  priorApprovalCount: number;
  approvedTherapyCount: number;
  trialStatus: string | null;
  enrollmentRatio: number | null;
  /** Earliest public primary-endpoint readout at cutoff (for filing-lag priors). */
  primaryResultPublicAt: string | null;
  /** Median PE→filing lag from cohort or calibration priors (days). */
  peToFilingLagPriorDays: number;
};

export type FeatureExtractionOptions = {
  phase?: string;
  forecastCutoff?: string;
  eventDeadline?: string | null;
};

export function extractFeatures(
  bundle: PrecedentBundle,
  question: MarketQuestion,
  options: FeatureExtractionOptions = {},
): ModelFeatures {
  const phase = options.phase ?? "III";
  const therapeuticArea = bundle.currentProgram?.therapeuticArea ?? null;
  const current = bundle.currentProgram;
  const forecastCutoff = options.forecastCutoff ?? null;
  const eventDeadline = options.eventDeadline ?? question.eventDeadline ?? null;

  const bestCohort = bundle.cohorts
    .filter((c) => c.programs.length > 0)
    .sort((a, b) => b.programs.length - a.programs.length)[0];

  const filingLagCohort = bundle.cohorts.find((c) => c.peToFilingLagSampleSize != null);
  const peToFilingLagPriorDays =
    filingLagCohort?.peToFilingLagDaysMedian ??
    (therapeuticArea != null
      ? inferredPeToFilingLagDays(therapeuticArea, phase)
      : inferredPeToFilingLagDays(null, phase));

  const primaryEndpointMet =
    current?.primaryEndpointMet ??
    bestCohort?.programs.find((p) => p.programId === current?.programId)?.primaryEndpointMet ??
    bundle.cohorts.flatMap((c) => c.programs).find((p) => p.programId === current?.programId)
      ?.primaryEndpointMet ??
    null;

  const applicationFiled =
    current?.applicationFiled ??
    (question.applicationId != null || current?.applicationId != null);
  const applicationAccepted = current?.applicationAccepted === true;
  const filedAt = current?.filedAt ?? null;
  const acceptedAt = current?.acceptedAt ?? null;
  const pdufaDate = current?.pdufaDate ?? null;
  const expectedFilingAt = current?.expectedFilingAt ?? null;
  const reviewProgram = current?.reviewProgram ?? "unknown";

  const planned = current?.plannedEnrollment ?? null;
  const actual = current?.actualEnrollment ?? null;
  const enrollmentRatio =
    planned != null && planned > 0 && actual != null ? actual / planned : null;

  return {
    phase,
    therapeuticArea,
    primaryEndpointMet,
    applicationFiled,
    applicationAccepted,
    filedAt,
    acceptedAt,
    pdufaDate,
    expectedFilingAt,
    reviewProgram,
    forecastCutoff,
    eventDeadline,
    daysRegistrationToPrimaryCompletion: current?.daysRegistrationToPrimaryCompletion ?? null,
    daysPrimaryCompletionToAcceptance: current?.daysPrimaryCompletionToAcceptance ?? null,
    daysAcceptanceToPdufa: current?.daysAcceptanceToPdufa ?? null,
    daysAcceptanceToAction: current?.daysAcceptanceToAction ?? null,
    daysCutoffToPdufa: daysBetween(forecastCutoff, pdufaDate),
    daysCutoffToDeadline: daysBetween(forecastCutoff, eventDeadline),
    daysPdufaToDeadline: daysBetween(pdufaDate, eventDeadline),
    daysExpectedFilingToDeadline: daysBetween(expectedFilingAt, eventDeadline),
    inferredReviewWindowDays:
      current?.inferredReviewWindowDays ?? inferredReviewWindowDays(reviewProgram),
    cohortEmpiricalRate: bestCohort?.empiricalRate ?? null,
    cohortSize: bestCohort?.programs.length ?? 0,
    supportingEvidenceCount: bundle.supportingEvidenceIds.length,
    programStatus: current?.status ?? null,
    endpointFamily: current?.endpointFamily ?? null,
    biomarkerEnriched: current?.biomarkerEnriched ?? false,
    orphanDesignated: current?.orphanDesignated ?? false,
    designationCount: current?.designationTypes?.length ?? 0,
    priorApprovalCount: current?.priorApprovalCount ?? 0,
    approvedTherapyCount: current?.approvedTherapyCount ?? 0,
    trialStatus: current?.trialStatus ?? null,
    enrollmentRatio,
    primaryResultPublicAt: current?.primaryResultPublicAt ?? null,
    peToFilingLagPriorDays,
  };
}
