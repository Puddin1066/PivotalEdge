import { z } from "zod";

import { ConfidenceLevelSchema, IdSchema, IsoDateTimeSchema } from "./common.js";
import { CutoffAuditSchema } from "./provenance.js";

export const ForecastComponentSchema = z.object({
  id: IdSchema,
  name: z.enum([
    "clinical_adequacy",
    "submission_by_T",
    "acceptance_given_submission",
    "approval_given_acceptance",
    "decision_by_T",
    "other",
  ]),
  probability: z.number().min(0).max(1),
  intervalLow: z.number().min(0).max(1).nullable(),
  intervalHigh: z.number().min(0).max(1).nullable(),
  modelVersion: z.string().min(1),
  calibrationStatus: z.enum(["uncalibrated", "held_out", "prospective", "unknown"]),
});
export type ForecastComponent = z.infer<typeof ForecastComponentSchema>;

export const ForecastSchema = z.object({
  id: IdSchema,
  marketQuestionId: IdSchema.nullable(),
  programId: IdSchema.nullable(),
  generatedAt: IsoDateTimeSchema,
  forecastCutoff: IsoDateTimeSchema,
  modelProbability: z.number().min(0).max(1),
  conservativeProbability: z.number().min(0).max(1),
  intervalLow: z.number().min(0).max(1),
  intervalHigh: z.number().min(0).max(1),
  modelVersion: z.string().min(1),
  calibrationStatus: z.enum(["uncalibrated", "held_out", "prospective", "unknown"]),
  components: z.array(ForecastComponentSchema).default([]),
  supportingEvidenceIds: z.array(IdSchema).default([]),
  cutoffAudit: CutoffAuditSchema.nullable(),
});
export type Forecast = z.infer<typeof ForecastSchema>;

export const OpportunitySignalSchema = z.object({
  id: IdSchema,
  marketId: IdSchema,
  forecastId: IdSchema,
  orderBookSnapshotId: IdSchema,
  netEdge: z.number(),
  opportunityScore: z.number().nullable(),
  evidenceConfidence: ConfidenceLevelSchema,
  resolutionRisk: ConfidenceLevelSchema,
  generatedAt: IsoDateTimeSchema,
});
export type OpportunitySignal = z.infer<typeof OpportunitySignalSchema>;

export const ModelRunSchema = z.object({
  id: IdSchema,
  modelName: z.string().min(1),
  modelVersion: z.string().min(1),
  startedAt: IsoDateTimeSchema,
  completedAt: IsoDateTimeSchema.nullable(),
  forecastCutoff: IsoDateTimeSchema,
  inputManifestHash: z.string().min(1),
  status: z.enum(["running", "succeeded", "failed"]),
});
export type ModelRun = z.infer<typeof ModelRunSchema>;
