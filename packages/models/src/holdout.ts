import { z } from "zod";

import {
  type CalibrationWeights,
  DEFAULT_CALIBRATION_WEIGHTS,
  predictBaseRateOnly,
  predictHoldoutCase,
} from "./calibration.js";
import { meanBrier } from "./metrics.js";

export const HoldoutCaseSchema = z.object({
  caseId: z.string().min(1),
  forecastCutoff: z.string().min(1),
  phase: z.string().min(1),
  therapeuticArea: z.string().min(1),
  primaryEndpointMet: z.boolean(),
  applicationFiled: z.boolean(),
  resolvedApproved: z.boolean(),
  biomarkerEnriched: z.boolean().optional(),
  orphanDesignated: z.boolean().optional(),
  priorApprovalCount: z.number().int().nonnegative().optional(),
  designationCount: z.number().int().nonnegative().optional(),
  enrollmentRatio: z.number().nullable().optional(),
  trialStatus: z.string().nullable().optional(),
  endpointFamily: z.string().nullable().optional(),
});
export type HoldoutCase = z.infer<typeof HoldoutCaseSchema>;

export const HoldoutCorpusSchema = z.object({
  kind: z.literal("forecast_holdout_corpus"),
  description: z.string(),
  cases: z.array(HoldoutCaseSchema).min(3),
});
export type HoldoutCorpus = z.infer<typeof HoldoutCorpusSchema>;

export type HoldoutEvaluation = {
  trainSize: number;
  testSize: number;
  baseRateBrier: number;
  calibratedBrier: number;
  beatsBaseRate: boolean;
  weights: CalibrationWeights;
};

const ENDPOINT_GRID = [0.05, 0.08, 0.1, 0.12, 0.15, 0.18];
const FILING_GRID = [0.08, 0.12, 0.15, 0.18, 0.22, 0.25];

function caseFeatures(c: HoldoutCase) {
  return {
    phase: c.phase,
    therapeuticArea: c.therapeuticArea,
    primaryEndpointMet: c.primaryEndpointMet,
    applicationFiled: c.applicationFiled,
    biomarkerEnriched: c.biomarkerEnriched,
    orphanDesignated: c.orphanDesignated,
    priorApprovalCount: c.priorApprovalCount,
    designationCount: c.designationCount,
    enrollmentRatio: c.enrollmentRatio,
    trialStatus: c.trialStatus,
    endpointFamily: c.endpointFamily,
  };
}

export function fitCalibrationWeights(train: HoldoutCase[]): CalibrationWeights {
  let best = DEFAULT_CALIBRATION_WEIGHTS;
  let bestBrier = Number.POSITIVE_INFINITY;

  for (const endpointBoost of ENDPOINT_GRID) {
    for (const filingBoost of FILING_GRID) {
      const weights: CalibrationWeights = {
        ...DEFAULT_CALIBRATION_WEIGHTS,
        endpointBoost,
        filingBoost,
      };
      const preds = train.map((c) => predictHoldoutCase(caseFeatures(c), weights));
      const outcomes = train.map((c) => (c.resolvedApproved ? 1 : 0) as 0 | 1);
      const brier = meanBrier(preds, outcomes);
      if (brier < bestBrier) {
        bestBrier = brier;
        best = weights;
      }
    }
  }

  return best;
}

export type ChronologicalHoldoutOptions = {
  minTrainCases?: number;
};

/** Expanding-window chronological holdout; train only on cases strictly before test cutoff. */
export function evaluateChronologicalHoldout(
  corpus: HoldoutCorpus,
  options: ChronologicalHoldoutOptions = {},
): HoldoutEvaluation {
  const minTrainCases = options.minTrainCases ?? 4;
  const sorted = [...corpus.cases].sort((a, b) => a.forecastCutoff.localeCompare(b.forecastCutoff));

  const basePredictions: number[] = [];
  const calibratedPredictions: number[] = [];
  const outcomes: (0 | 1)[] = [];
  let lastWeights = DEFAULT_CALIBRATION_WEIGHTS;

  for (let i = minTrainCases; i < sorted.length; i++) {
    const testCase = sorted[i]!;
    const train = sorted.filter((c) => c.forecastCutoff < testCase.forecastCutoff);
    if (train.length < minTrainCases) continue;
    const weights = fitCalibrationWeights(train);
    lastWeights = weights;

    const features = caseFeatures(testCase);
    basePredictions.push(predictBaseRateOnly(features));
    calibratedPredictions.push(predictHoldoutCase(features, weights));
    outcomes.push(testCase.resolvedApproved ? 1 : 0);
  }

  const baseRateBrier = meanBrier(basePredictions, outcomes);
  const calibratedBrier = meanBrier(calibratedPredictions, outcomes);

  return {
    trainSize: minTrainCases,
    testSize: outcomes.length,
    baseRateBrier,
    calibratedBrier,
    beatsBaseRate: calibratedBrier < baseRateBrier,
    weights: lastWeights,
  };
}
