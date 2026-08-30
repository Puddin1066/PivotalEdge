import { lookupBaseRate } from "./base-rates.js";
import type { ModelFeatures } from "./features.js";

export const MODEL_VERSION = "base-rate-calibrated@3";

export type CalibrationWeights = {
  endpointBoost: number;
  filingBoost: number;
  cohortWeight: number;
  biomarkerBoost: number;
  orphanBoost: number;
  priorApprovalBoost: number;
  designationBoost: number;
  underEnrollmentPenalty: number;
};

export const DEFAULT_CALIBRATION_WEIGHTS: CalibrationWeights = {
  endpointBoost: 0.12,
  filingBoost: 0.18,
  cohortWeight: 0.35,
  biomarkerBoost: 0.05,
  orphanBoost: 0.04,
  priorApprovalBoost: 0.08,
  designationBoost: 0.02,
  underEnrollmentPenalty: 0.04,
};

export type HoldoutCaseFeatures = {
  phase: string;
  therapeuticArea: string;
  primaryEndpointMet: boolean;
  applicationFiled: boolean;
  biomarkerEnriched?: boolean;
  orphanDesignated?: boolean;
  priorApprovalCount?: number;
  designationCount?: number;
  enrollmentRatio?: number | null;
  trialStatus?: string | null;
  endpointFamily?: string | null;
};

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function logit(p: number): number {
  const bounded = clamp01(p);
  const eps = 1e-6;
  const x = Math.min(1 - eps, Math.max(eps, bounded));
  return Math.log(x / (1 - x));
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

/** Beta-binomial shrinkage of cohort empirical rate toward base-rate prior. */
export function shrinkTowardBaseRate(
  baseRate: number,
  cohortRate: number | null,
  cohortApprovals: number,
  cohortDecided: number,
  priorStrength = 8,
): number {
  if (cohortDecided <= 0 || cohortRate == null) return baseRate;
  const alpha = baseRate * priorStrength;
  const beta = (1 - baseRate) * priorStrength;
  const posterior = (cohortApprovals + alpha) / (cohortDecided + alpha + beta);
  return clamp01(posterior);
}

export function applyFeatureAdjustments(
  baseProbability: number,
  features: Pick<
    ModelFeatures,
    | "primaryEndpointMet"
    | "applicationFiled"
    | "biomarkerEnriched"
    | "orphanDesignated"
    | "priorApprovalCount"
    | "designationCount"
    | "enrollmentRatio"
    | "trialStatus"
  >,
  weights: CalibrationWeights = DEFAULT_CALIBRATION_WEIGHTS,
): number {
  let logOdds = logit(baseProbability);
  if (features.primaryEndpointMet === true) logOdds += weights.endpointBoost;
  if (features.primaryEndpointMet === false) logOdds -= weights.endpointBoost;
  if (features.applicationFiled) logOdds += weights.filingBoost;
  if (features.biomarkerEnriched) logOdds += weights.biomarkerBoost;
  if (features.orphanDesignated) logOdds += weights.orphanBoost;
  if (features.priorApprovalCount > 0) logOdds += weights.priorApprovalBoost;
  if (features.designationCount > 0) {
    logOdds += weights.designationBoost * Math.min(2, features.designationCount);
  }
  if (features.trialStatus === "terminated") logOdds -= weights.endpointBoost;
  if (features.enrollmentRatio != null && features.enrollmentRatio < 0.7) {
    logOdds -= weights.underEnrollmentPenalty;
  }
  return clamp01(sigmoid(logOdds));
}

export function blendCohortEstimate(
  adjusted: number,
  cohortRate: number | null,
  cohortSize: number,
  weight: number,
): number {
  if (cohortRate == null || cohortSize === 0) return adjusted;
  const w = clamp01(weight * Math.min(1, cohortSize / 10));
  return clamp01(adjusted * (1 - w) + cohortRate * w);
}

export function resolveTerminalProbability(
  features: Pick<ModelFeatures, "programStatus">,
  modelProbability: number,
): number {
  if (features.programStatus === "approved") return 1;
  if (features.programStatus === "crl") return 0;
  return modelProbability;
}

export function calibratedApprovalProbability(
  features: ModelFeatures,
  weights: CalibrationWeights = DEFAULT_CALIBRATION_WEIGHTS,
): number {
  const base = lookupBaseRate(features.phase, features.therapeuticArea);
  const shrunk = shrinkTowardBaseRate(
    base.approvalRate,
    features.cohortEmpiricalRate,
    Math.round((features.cohortEmpiricalRate ?? 0) * features.cohortSize),
    features.cohortSize,
  );
  const adjusted = applyFeatureAdjustments(shrunk, features, weights);
  const blended = blendCohortEstimate(
    adjusted,
    features.cohortEmpiricalRate,
    features.cohortSize,
    weights.cohortWeight,
  );
  return resolveTerminalProbability(features, blended);
}

export function holdoutFeaturesToModelFeatures(features: HoldoutCaseFeatures): ModelFeatures {
  return {
    phase: features.phase,
    therapeuticArea: features.therapeuticArea,
    primaryEndpointMet: features.primaryEndpointMet,
    applicationFiled: features.applicationFiled,
    applicationAccepted: false,
    filedAt: null,
    acceptedAt: null,
    pdufaDate: null,
    expectedFilingAt: null,
    reviewProgram: "unknown",
    forecastCutoff: null,
    eventDeadline: null,
    daysRegistrationToPrimaryCompletion: null,
    daysPrimaryCompletionToAcceptance: null,
    daysAcceptanceToPdufa: null,
    daysAcceptanceToAction: null,
    daysCutoffToPdufa: null,
    daysCutoffToDeadline: null,
    daysPdufaToDeadline: null,
    daysExpectedFilingToDeadline: null,
    inferredReviewWindowDays: 240,
    cohortEmpiricalRate: null,
    cohortSize: 0,
    supportingEvidenceCount: 0,
    programStatus: null,
    endpointFamily: features.endpointFamily ?? null,
    biomarkerEnriched: features.biomarkerEnriched ?? false,
    orphanDesignated: features.orphanDesignated ?? false,
    designationCount: features.designationCount ?? 0,
    priorApprovalCount: features.priorApprovalCount ?? 0,
    approvedTherapyCount: 0,
    trialStatus: features.trialStatus ?? null,
    enrollmentRatio: features.enrollmentRatio ?? null,
    primaryResultPublicAt: null,
    peToFilingLagPriorDays: 365,
  };
}

export function predictHoldoutCase(
  features: HoldoutCaseFeatures,
  weights: CalibrationWeights = DEFAULT_CALIBRATION_WEIGHTS,
): number {
  return calibratedApprovalProbability(holdoutFeaturesToModelFeatures(features), weights);
}

export function predictBaseRateOnly(features: HoldoutCaseFeatures): number {
  return lookupBaseRate(features.phase, features.therapeuticArea).approvalRate;
}

/** Wilson score interval for binomial proportion. */
export function wilsonInterval(
  successes: number,
  trials: number,
  z = 1.96,
): { low: number; high: number } {
  if (trials <= 0) return { low: 0, high: 1 };
  const p = successes / trials;
  const z2 = z * z;
  const denom = 1 + z2 / trials;
  const center = (p + z2 / (2 * trials)) / denom;
  const margin = (z * Math.sqrt((p * (1 - p)) / trials + z2 / (4 * trials * trials))) / denom;
  return { low: clamp01(center - margin), high: clamp01(center + margin) };
}

export function probabilityInterval(
  probability: number,
  evidenceWeight: number,
): { low: number; high: number } {
  const pseudoTrials = 12 + evidenceWeight * 4;
  const successes = Math.round(probability * pseudoTrials);
  return wilsonInterval(successes, pseudoTrials);
}
