import { z } from "zod";

import { IdSchema, IsoDateTimeSchema } from "./common.js";
import { CutoffAuditSchema } from "./provenance.js";
import { MarketQuestionSchema } from "./market.js";

export const GraphTraversalSchema = z.object({
  fromNodeType: z.string(),
  fromNodeId: IdSchema.nullable(),
  relationship: z.string(),
  toNodeType: z.string(),
  filters: z.record(z.string()).default({}),
});
export type GraphTraversal = z.infer<typeof GraphTraversalSchema>;

export const AnalogueCohortQuerySchema = z.object({
  cohortId: IdSchema,
  label: z.string(),
  filters: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])),
  includeNegativeOutcomes: z.boolean().default(true),
  maxPrograms: z.number().int().positive().default(25),
});
export type AnalogueCohortQuery = z.infer<typeof AnalogueCohortQuerySchema>;

export const EvidenceQuerySchema = z.object({
  queryId: IdSchema,
  entityIds: z.array(IdSchema),
  documentTypes: z.array(z.string()).default([]),
});
export type EvidenceQuery = z.infer<typeof EvidenceQuerySchema>;

export const KnowledgeGraphQueryPlanSchema = z.object({
  targetQuestion: MarketQuestionSchema,
  exactEntityTraversal: z.array(GraphTraversalSchema),
  analogueCohorts: z.array(AnalogueCohortQuerySchema),
  currentEvidenceQueries: z.array(EvidenceQuerySchema).default([]),
  negativeControlQueries: z.array(AnalogueCohortQuerySchema).default([]),
  forecastCutoff: IsoDateTimeSchema,
  maximumHops: z.number().int().positive().default(4),
  minimumEvidenceGrade: z.enum(["low", "moderate", "high"]).default("moderate"),
  generatedByModelCallId: z.string().nullable(),
  reviewed: z.boolean().default(false),
});
export type KnowledgeGraphQueryPlan = z.infer<typeof KnowledgeGraphQueryPlanSchema>;

export const ProgramSnapshotSchema = z.object({
  programId: IdSchema,
  drugAssetId: IdSchema,
  drugName: z.string(),
  sponsorId: IdSchema,
  sponsorName: z.string(),
  indicationId: IdSchema,
  indicationName: z.string(),
  therapeuticArea: z.string().nullable(),
  status: z.string(),
  trialIds: z.array(IdSchema),
  applicationId: IdSchema.nullable(),
  /** Populated from KG clinicalFeaturesAtCutoff when available. */
  primaryEndpointMet: z.boolean().nullable().optional(),
  endpointFamily: z.string().nullable().optional(),
  trialStatus: z.string().nullable().optional(),
  plannedEnrollment: z.number().nullable().optional(),
  actualEnrollment: z.number().nullable().optional(),
  biomarkerEnriched: z.boolean().optional(),
  designationTypes: z.array(z.string()).optional(),
  orphanDesignated: z.boolean().optional(),
  approvedTherapyCount: z.number().int().nonnegative().optional(),
  priorApprovalCount: z.number().int().nonnegative().optional(),
  applicationFiled: z.boolean().optional(),
  applicationAccepted: z.boolean().optional(),
  filedAt: IsoDateTimeSchema.nullable().optional(),
  acceptedAt: IsoDateTimeSchema.nullable().optional(),
  pdufaDate: IsoDateTimeSchema.nullable().optional(),
  expectedFilingAt: IsoDateTimeSchema.nullable().optional(),
  reviewProgram: z.string().optional(),
  registeredAt: IsoDateTimeSchema.nullable().optional(),
  studyStartAt: IsoDateTimeSchema.nullable().optional(),
  primaryCompletionAt: IsoDateTimeSchema.nullable().optional(),
  completionAt: IsoDateTimeSchema.nullable().optional(),
  actionDate: IsoDateTimeSchema.nullable().optional(),
  daysRegistrationToPrimaryCompletion: z.number().nullable().optional(),
  daysPrimaryCompletionToAcceptance: z.number().nullable().optional(),
  daysAcceptanceToPdufa: z.number().nullable().optional(),
  daysAcceptanceToAction: z.number().nullable().optional(),
  inferredReviewWindowDays: z.number().int().positive().optional(),
  /** Earliest public primary-endpoint result at forecast cutoff. */
  primaryResultPublicAt: IsoDateTimeSchema.nullable().optional(),
});
export type ProgramSnapshot = z.infer<typeof ProgramSnapshotSchema>;

export const PrecedentProgramSchema = z.object({
  programId: IdSchema,
  drugName: z.string(),
  indicationName: z.string(),
  therapeuticArea: z.string().nullable(),
  phase: z.string().nullable(),
  outcome: z.enum(["approval", "crl", "withdrawn", "trial_failure", "unresolved"]),
  primaryEndpointMet: z.boolean().nullable(),
  sponsorName: z.string(),
  evidenceIds: z.array(IdSchema).default([]),
});
export type PrecedentProgram = z.infer<typeof PrecedentProgramSchema>;

export const AnalogueComparisonSchema = z.object({
  programId: IdSchema,
  similarities: z.array(z.string()),
  differences: z.array(z.string()),
  outcome: z.enum(["approval", "crl", "withdrawn", "trial_failure", "unresolved"]),
  cutoffCompliant: z.boolean(),
});
export type AnalogueComparison = z.infer<typeof AnalogueComparisonSchema>;

export const CohortSummarySchema = z.object({
  cohortDefinition: z.string(),
  programs: z.array(PrecedentProgramSchema),
  approvals: z.number().int().nonnegative(),
  crls: z.number().int().nonnegative(),
  withdrawals: z.number().int().nonnegative(),
  unresolved: z.number().int().nonnegative(),
  empiricalRate: z.number().min(0).max(1).nullable(),
  /** Populated for PE→filing lag cohorts when measurable spans exist. */
  peToFilingLagDaysMedian: z.number().nullable().optional(),
  peToFilingLagSampleSize: z.number().int().nonnegative().optional(),
});
export type CohortSummary = z.infer<typeof CohortSummarySchema>;

export const PrecedentBundleSchema = z.object({
  marketQuestionId: IdSchema,
  currentProgram: ProgramSnapshotSchema.nullable(),
  cohorts: z.array(CohortSummarySchema),
  exactAnalogues: z.array(AnalogueComparisonSchema),
  supportingEvidenceIds: z.array(IdSchema).default([]),
  contradictoryEvidenceIds: z.array(IdSchema).default([]),
  missingHighValueEvidence: z.array(z.string()).default([]),
  cutoffCompliance: CutoffAuditSchema,
});
export type PrecedentBundle = z.infer<typeof PrecedentBundleSchema>;

export const ContractCoverageSchema = z.enum(["complete", "partial", "blocked"]);
export type ContractCoverage = z.infer<typeof ContractCoverageSchema>;

/** P0 contract checklist — required evidence for calibrated edge (ENRICHMENT_PRIORITY). */
export const ContractEvidenceAssessmentSchema = z.object({
  eventType: z.string().min(1),
  requiredPresent: z.array(z.string()).default([]),
  requiredMissing: z.array(z.string()).default([]),
  contractCoverage: ContractCoverageSchema,
  calibrationBlocked: z.boolean(),
  notes: z.array(z.string()).default([]),
});
export type ContractEvidenceAssessment = z.infer<typeof ContractEvidenceAssessmentSchema>;
