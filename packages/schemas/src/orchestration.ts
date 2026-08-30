import { z } from "zod";

import { BetRecommendationSchema } from "./bet.js";
import { IdSchema, IsoDateTimeSchema } from "./common.js";

export const OrchestrationRunStatusSchema = z.enum([
  "pending",
  "running",
  "awaiting_review",
  "completed",
  "failed",
]);
export type OrchestrationRunStatus = z.infer<typeof OrchestrationRunStatusSchema>;

export const EvidenceTypeSchema = z.enum([
  "clinical",
  "regulatory",
  "biological",
  "commercial",
  "safety",
  "timing",
]);
export type EvidenceType = z.infer<typeof EvidenceTypeSchema>;

export const SupportDirectionSchema = z.enum(["supports", "contradicts", "neutral"]);
export type SupportDirection = z.infer<typeof SupportDirectionSchema>;

/** Canonical evidence candidate before KG write (Notion §6). */
export const EvidenceRecordSchema = z.object({
  id: IdSchema,
  subjectId: IdSchema,
  predicate: z.string().min(1),
  objectValue: z.union([z.string(), z.number(), z.boolean(), z.null()]),

  evidenceType: EvidenceTypeSchema,
  sourceType: z.string().min(1),
  sourceUrl: z.string().min(1),
  sourceId: z.string().nullable(),

  firstPublicAt: IsoDateTimeSchema.nullable(),
  retrievedAt: IsoDateTimeSchema,
  forecastCutoff: IsoDateTimeSchema,

  supportDirection: SupportDirectionSchema,
  evidenceStrength: z.number().min(0).max(1).nullable(),
  extractionConfidence: z.number().min(0).max(1),

  exactPassage: z.string().nullable(),
  locator: z.string().nullable(),
  extractorVersion: z.string().min(1),
  checksum: z.string().min(1),
});
export type EvidenceRecord = z.infer<typeof EvidenceRecordSchema>;

export const ModelInformationGapSchema = z.object({
  featureName: z.string().min(1),
  currentValue: z.unknown().nullable(),
  missing: z.boolean(),
  featureImportance: z.number().min(0).max(1),
  localSensitivity: z.number().min(0).max(1).nullable(),
  uncertainty: z.number().min(0).max(1).nullable(),
  potentiallyDecisionChanging: z.boolean(),
  researchQuestion: z.string().min(1),
  sourcePriority: z.array(z.string()).default([]),
});
export type ModelInformationGap = z.infer<typeof ModelInformationGapSchema>;

export const ResearchTaskSchema = z.object({
  taskId: IdSchema,
  gapFeature: z.string().min(1),
  researchQuestion: z.string().min(1),
  sourcePriority: z.array(z.string()).default([]),
  priorityScore: z.number().min(0),
  domain: z.enum(["clinical", "regulatory", "company"]).optional(),
});
export type ResearchTask = z.infer<typeof ResearchTaskSchema>;

export const OrchestrationConfigSchema = z.object({
  enabled: z.boolean().default(false),
  maxResearchIterations: z.number().int().positive().default(3),
  minProbabilityChange: z.number().min(0).max(1).default(0.02),
  minHighValueGapScore: z.number().min(0).max(1).default(0.25),
  maxParallelResearchTasks: z.number().int().positive().default(4),
  /** When true, pause before write_evidence for human approval (API resume). */
  requireHumanReviewOnEvidence: z.boolean().default(false),
});
export type OrchestrationConfig = z.infer<typeof OrchestrationConfigSchema>;

export const OrchestrationDiffSchema = z.object({
  initialProbability: z.number().min(0).max(1),
  finalProbability: z.number().min(0).max(1),
  probabilityDelta: z.number(),
  evidenceAdded: z.number().int().nonnegative(),
  featuresChanged: z.array(z.string()),
  researchIterations: z.number().int().nonnegative(),
  stopReason: z.string().min(1),
});
export type OrchestrationDiff = z.infer<typeof OrchestrationDiffSchema>;

export const OrchestrationRunSchema = z.object({
  runId: IdSchema,
  marketId: IdSchema,
  forecastCutoff: IsoDateTimeSchema,
  status: OrchestrationRunStatusSchema,
  researchIteration: z.number().int().nonnegative(),
  stopReason: z.string().nullable(),
  initialForecastId: IdSchema.nullable(),
  enrichedForecastId: IdSchema.nullable(),
  initialProbability: z.number().min(0).max(1).nullable(),
  enrichedProbability: z.number().min(0).max(1).nullable(),
  recommendation: BetRecommendationSchema.nullable(),
  gapsBefore: z.array(ModelInformationGapSchema).default([]),
  researchTasks: z.array(ResearchTaskSchema).default([]),
  newEvidenceIds: z.array(IdSchema).default([]),
  contradictoryEvidenceIds: z.array(IdSchema).default([]),
  featuresChanged: z.array(z.string()).default([]),
  checkpointPath: z.string().nullable(),
  createdAt: IsoDateTimeSchema,
  completedAt: IsoDateTimeSchema.nullable(),
});
export type OrchestrationRun = z.infer<typeof OrchestrationRunSchema>;

export const OrchestrationTraceSchema = z.object({
  runId: IdSchema,
  profileId: z.string().min(1),
  marketId: IdSchema,
  forecastCutoff: IsoDateTimeSchema,
  status: OrchestrationRunStatusSchema,
  gapsBefore: z.array(ModelInformationGapSchema).default([]),
  researchTasks: z.array(ResearchTaskSchema).default([]),
  researchIterations: z.number().int().nonnegative(),
  featuresChanged: z.array(z.string()).default([]),
  newEvidenceIds: z.array(IdSchema).default([]),
  contradictoryEvidenceIds: z.array(IdSchema).default([]),
  initialProbability: z.number().min(0).max(1).nullable(),
  enrichedProbability: z.number().min(0).max(1).nullable(),
  stopReason: z.string().nullable(),
  awaitingReview: z.boolean().default(false),
  reviewPayload: z.record(z.unknown()).nullable().optional(),
});
export type OrchestrationTrace = z.infer<typeof OrchestrationTraceSchema>;

export const OrchestrationEvidenceSnapshotSchema = z.object({
  runId: IdSchema,
  newEvidenceIds: z.array(IdSchema).default([]),
  contradictoryEvidenceIds: z.array(IdSchema).default([]),
  pendingRecords: z.array(EvidenceRecordSchema).default([]),
});
export type OrchestrationEvidenceSnapshot = z.infer<typeof OrchestrationEvidenceSnapshotSchema>;

export const EvidenceValidationRejectionSchema = z.object({
  recordId: IdSchema,
  reason: z.string().min(1),
});
export type EvidenceValidationRejection = z.infer<typeof EvidenceValidationRejectionSchema>;

export const EvidenceValidationResultSchema = z.object({
  accepted: z.array(EvidenceRecordSchema),
  rejected: z.array(EvidenceValidationRejectionSchema),
});
export type EvidenceValidationResult = z.infer<typeof EvidenceValidationResultSchema>;

/** Single case for enrichment A/B telemetry (Phase 5). */
export const EnrichmentAbCaseSchema = z.object({
  caseId: z.string().min(1),
  profileId: z.string().min(1),
  resolvedApproved: z.boolean(),
  labelSource: z.string().min(1).optional(),
  /** Populated after enrichment run. */
  pInitial: z.number().min(0).max(1).optional(),
  pEnriched: z.number().min(0).max(1).optional(),
  enrichmentRunId: IdSchema.optional(),
});
export type EnrichmentAbCase = z.infer<typeof EnrichmentAbCaseSchema>;

export const EnrichmentAbCorpusSchema = z.object({
  kind: z.literal("enrichment_ab_corpus"),
  description: z.string(),
  cases: z.array(EnrichmentAbCaseSchema).min(1),
});
export type EnrichmentAbCorpus = z.infer<typeof EnrichmentAbCorpusSchema>;

export const EnrichmentAbCaseResultSchema = z.object({
  caseId: z.string().min(1),
  profileId: z.string().min(1),
  enrichmentRunId: IdSchema,
  resolvedApproved: z.boolean(),
  pInitial: z.number().min(0).max(1),
  pEnriched: z.number().min(0).max(1),
  probabilityDelta: z.number(),
  initialAction: BetRecommendationSchema.shape.action,
  enrichedAction: BetRecommendationSchema.shape.action,
  evidenceAdded: z.number().int().nonnegative(),
  researchIterations: z.number().int().nonnegative(),
  stopReason: z.string().min(1),
  initialActionCorrect: z.boolean(),
  enrichedActionCorrect: z.boolean(),
});
export type EnrichmentAbCaseResult = z.infer<typeof EnrichmentAbCaseResultSchema>;

export const EnrichmentAbReportSchema = z.object({
  kind: z.literal("enrichment_ab_report"),
  generatedAt: IsoDateTimeSchema,
  corpusDescription: z.string(),
  caseCount: z.number().int().positive(),
  initialBrier: z.number(),
  enrichedBrier: z.number(),
  brierImprovement: z.number(),
  initialLogLoss: z.number(),
  enrichedLogLoss: z.number(),
  logLossImprovement: z.number(),
  initialActionAccuracy: z.number().min(0).max(1),
  enrichedActionAccuracy: z.number().min(0).max(1),
  actionAccuracyDelta: z.number(),
  meanAbsoluteProbabilityDelta: z.number().nonnegative(),
  casesWithEnrichmentSignal: z.number().int().nonnegative(),
  enrichmentHelpsCalibration: z.boolean(),
  cases: z.array(EnrichmentAbCaseResultSchema),
});
export type EnrichmentAbReport = z.infer<typeof EnrichmentAbReportSchema>;
