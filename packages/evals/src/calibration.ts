import {
  DEFAULT_CALIBRATION_WEIGHTS,
  fitCalibrationWeights,
  meanBrier,
  MODEL_VERSION,
  predictBaseRateOnly,
  predictHoldoutCase,
  type CalibrationWeights,
} from "@pivotaledge/models";
import type {
  CalibrationStratum,
  ClinicalCalibrationCase,
  ClinicalCalibrationCorpus,
  ClinicalCalibrationReport,
} from "@pivotaledge/schemas";

import { buildReliabilityBins, brierForPairs } from "./reliability.js";

export type StratumDimension = "phase" | "therapeuticArea" | "applicationFiled" | "phase_x_ta";

export type ClinicalChronoCalibrationOptions = {
  minTrainCases?: number;
  reliabilityBinCount?: number;
  stratumDimensions?: StratumDimension[];
};

type CasePrediction = {
  case: ClinicalCalibrationCase;
  baselineProbability: number;
  calibratedProbability: number;
  observed: 0 | 1;
};

const DEFAULT_STRATA: StratumDimension[] = [
  "phase",
  "therapeuticArea",
  "applicationFiled",
  "phase_x_ta",
];

function stratumKey(caseRow: ClinicalCalibrationCase, dimension: StratumDimension): string {
  switch (dimension) {
    case "phase":
      return caseRow.phase;
    case "therapeuticArea":
      return caseRow.therapeuticArea;
    case "applicationFiled":
      return caseRow.applicationFiled ? "filed" : "not_filed";
    case "phase_x_ta":
      return `${caseRow.phase}|${caseRow.therapeuticArea}`;
  }
}

function stratumLabel(key: string, dimension: StratumDimension): string {
  switch (dimension) {
    case "applicationFiled":
      return key === "filed" ? "Application filed" : "Not filed";
    case "phase_x_ta":
      return key.replace("|", " × ");
    default:
      return key;
  }
}

function toFeatures(caseRow: ClinicalCalibrationCase) {
  return {
    phase: caseRow.phase,
    therapeuticArea: caseRow.therapeuticArea,
    primaryEndpointMet: caseRow.primaryEndpointMet,
    applicationFiled: caseRow.applicationFiled,
    biomarkerEnriched: caseRow.biomarkerEnriched,
    orphanDesignated: caseRow.orphanDesignated,
    priorApprovalCount: caseRow.priorApprovalCount,
    designationCount: caseRow.designationCount,
    enrollmentRatio: caseRow.enrollmentRatio,
    trialStatus: caseRow.trialStatus,
    endpointFamily: caseRow.endpointFamily,
  };
}

function buildStrata(
  predictions: CasePrediction[],
  dimensions: StratumDimension[],
  binCount: number,
): CalibrationStratum[] {
  const strata: CalibrationStratum[] = [];

  for (const dimension of dimensions) {
    const groups = new Map<string, CasePrediction[]>();
    for (const row of predictions) {
      const key = stratumKey(row.case, dimension);
      const bucket = groups.get(key) ?? [];
      bucket.push(row);
      groups.set(key, bucket);
    }

    for (const [key, rows] of groups) {
      const baseline = rows.map((r) => r.baselineProbability);
      const calibrated = rows.map((r) => r.calibratedProbability);
      const outcomes = rows.map((r) => r.observed);
      strata.push({
        stratumKey: `${dimension}:${key}`,
        stratumLabel: stratumLabel(key, dimension),
        dimension,
        n: rows.length,
        baseRateBrier: brierForPairs(baseline, outcomes),
        calibratedBrier: brierForPairs(calibrated, outcomes),
        reliability: buildReliabilityBins(calibrated, outcomes, binCount),
      });
    }
  }

  return strata.sort((a, b) => a.stratumKey.localeCompare(b.stratumKey));
}

/** Expanding-window chronological calibration with Brier + reliability by stratum (no market PnL). */
export function runClinicalChronoCalibration(
  corpus: ClinicalCalibrationCorpus,
  options: ClinicalChronoCalibrationOptions = {},
): ClinicalCalibrationReport {
  const minTrainCases = options.minTrainCases ?? 8;
  const reliabilityBinCount = options.reliabilityBinCount ?? 10;
  const stratumDimensions = options.stratumDimensions ?? DEFAULT_STRATA;

  const sorted = [...corpus.cases].sort((a, b) =>
    a.forecastCutoff.localeCompare(b.forecastCutoff) || a.caseId.localeCompare(b.caseId),
  );

  const casePredictions: CasePrediction[] = [];
  let lastWeights: CalibrationWeights = { ...DEFAULT_CALIBRATION_WEIGHTS };

  // Strict cutoff: never train on same-day or future cases (no same-cutoff leakage).
  for (const testCase of sorted) {
    const train = sorted.filter((c) => c.forecastCutoff < testCase.forecastCutoff);
    if (train.length < minTrainCases) continue;

    const weights = fitCalibrationWeights(train);
    lastWeights = weights;

    const features = toFeatures(testCase);
    casePredictions.push({
      case: testCase,
      baselineProbability: predictBaseRateOnly(features),
      calibratedProbability: predictHoldoutCase(features, weights),
      observed: testCase.resolvedApproved ? 1 : 0,
    });
  }

  const baseline = casePredictions.map((r) => r.baselineProbability);
  const calibrated = casePredictions.map((r) => r.calibratedProbability);
  const outcomes = casePredictions.map((r) => r.observed);

  const baseRateBrier = meanBrier(baseline, outcomes);
  const calibratedBrier = meanBrier(calibrated, outcomes);

  return {
    kind: "clinical_calibration_report",
    generatedAt: new Date().toISOString(),
    modelVersion: MODEL_VERSION,
    corpusKind: "clinical_calibration_corpus",
    dataSource: corpus.dataSource,
    totalCases: sorted.length,
    trainCases: minTrainCases,
    testCases: casePredictions.length,
    baseRateBrier,
    calibratedBrier,
    beatsBaseRate: calibratedBrier < baseRateBrier,
    weights: lastWeights,
    globalReliability: buildReliabilityBins(calibrated, outcomes, reliabilityBinCount),
    strata: buildStrata(casePredictions, stratumDimensions, reliabilityBinCount),
    cases: casePredictions.map((row) => ({
      caseId: row.case.caseId,
      forecastCutoff: row.case.forecastCutoff,
      phase: row.case.phase,
      therapeuticArea: row.case.therapeuticArea,
      applicationFiled: row.case.applicationFiled,
      primaryEndpointMet: row.case.primaryEndpointMet,
      resolvedApproved: row.case.resolvedApproved,
      baselineProbability: row.baselineProbability,
      calibratedProbability: row.calibratedProbability,
      applicationNumber: row.case.applicationNumber,
      brandName: row.case.brandName,
    })),
  };
}
