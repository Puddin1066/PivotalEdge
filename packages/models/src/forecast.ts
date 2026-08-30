import type { Forecast, MarketQuestion, PrecedentBundle } from "@pivotaledge/schemas";
import { ForecastSchema } from "@pivotaledge/schemas";

import {
  MODEL_VERSION,
  calibratedApprovalProbability,
  probabilityInterval,
} from "./calibration.js";
import { decomposeForecast } from "./components.js";
import { extractFeatures, type FeatureExtractionOptions } from "./features.js";

export type BuildForecastInput = {
  marketQuestion: MarketQuestion;
  precedentBundle: PrecedentBundle;
  forecastCutoff: string;
  generatedAt?: string;
  forecastId?: string;
  featureOptions?: FeatureExtractionOptions;
};

export function buildForecast(input: BuildForecastInput): Forecast {
  const {
    marketQuestion,
    precedentBundle,
    forecastCutoff,
    generatedAt = new Date().toISOString(),
    forecastId = `fc_${marketQuestion.marketId}_${Date.now()}`,
    featureOptions,
  } = input;

  const features = extractFeatures(precedentBundle, marketQuestion, {
    ...featureOptions,
    forecastCutoff,
    eventDeadline: marketQuestion.eventDeadline,
  });
  const modelProbability = calibratedApprovalProbability(features);
  const { components, compositeProbability } = decomposeForecast(
    marketQuestion,
    features,
    modelProbability,
  );

  const evidenceWeight =
    features.supportingEvidenceCount + features.cohortSize + (features.applicationFiled ? 2 : 0);
  const interval = probabilityInterval(compositeProbability, evidenceWeight);
  const conservativeProbability = interval.low;

  return ForecastSchema.parse({
    id: forecastId,
    marketQuestionId: marketQuestion.marketId,
    programId: precedentBundle.currentProgram?.programId ?? null,
    generatedAt,
    forecastCutoff,
    modelProbability: compositeProbability,
    conservativeProbability,
    intervalLow: interval.low,
    intervalHigh: interval.high,
    modelVersion: MODEL_VERSION,
    calibrationStatus: "held_out",
    components,
    supportingEvidenceIds: precedentBundle.supportingEvidenceIds,
    cutoffAudit: precedentBundle.cutoffCompliance,
  });
}
