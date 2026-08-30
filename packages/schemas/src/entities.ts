import { z } from "zod";

import { IdSchema, IsoDateTimeSchema } from "./common.js";
import { TemporalProvenanceSchema } from "./provenance.js";

export const DrugAssetSchema = z.object({
  id: IdSchema,
  preferredName: z.string().min(1),
  modality: z.string().nullable(),
  mechanismIds: z.array(IdSchema).default([]),
});
export type DrugAsset = z.infer<typeof DrugAssetSchema>;

export const DrugAliasSchema = z.object({
  id: IdSchema,
  drugAssetId: IdSchema,
  alias: z.string().min(1),
  aliasType: z.enum(["brand", "inn", "code", "other"]),
});
export type DrugAlias = z.infer<typeof DrugAliasSchema>;

export const SponsorSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  cik: z.string().nullable(),
});
export type Sponsor = z.infer<typeof SponsorSchema>;

export const PersonSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  orcid: z.string().nullable(),
});
export type Person = z.infer<typeof PersonSchema>;

export const IndicationSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  therapeuticArea: z.string().nullable(),
  /** Open Targets / EFO disease id when linked. */
  efoId: z.string().nullable().default(null),
});
export type Indication = z.infer<typeof IndicationSchema>;

export const MechanismSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  target: z.string().nullable(),
  firstInClass: z.boolean().nullable().default(null),
});
export type Mechanism = z.infer<typeof MechanismSchema>;

export const DesignationTypeSchema = z.enum([
  "orphan",
  "fast_track",
  "breakthrough",
  "accelerated_approval",
  "priority_review",
]);
export type DesignationType = z.infer<typeof DesignationTypeSchema>;

/** FDA regulatory designation attached to a program or application. */
export const DesignationSchema = z.object({
  id: IdSchema,
  programId: IdSchema,
  applicationId: IdSchema.nullable().default(null),
  designationType: DesignationTypeSchema,
  grantedAt: IsoDateTimeSchema.nullable(),
  provenance: TemporalProvenanceSchema,
});
export type Designation = z.infer<typeof DesignationSchema>;

/** Approved therapy already serving an indication (competition context). */
export const ApprovedTherapyLinkSchema = z.object({
  id: IdSchema,
  indicationId: IdSchema,
  drugAssetId: IdSchema,
  drugName: z.string().min(1),
  approvedAt: IsoDateTimeSchema.nullable(),
  provenance: TemporalProvenanceSchema,
});
export type ApprovedTherapyLink = z.infer<typeof ApprovedTherapyLinkSchema>;

/** Prior approval of the same asset in another indication (Lo et al. feature). */
export const PriorApprovalLinkSchema = z.object({
  id: IdSchema,
  drugAssetId: IdSchema,
  indicationId: IdSchema,
  indicationName: z.string().min(1),
  approvedAt: IsoDateTimeSchema.nullable(),
  provenance: TemporalProvenanceSchema,
});
export type PriorApprovalLink = z.infer<typeof PriorApprovalLinkSchema>;

export const ClinicalProgramSchema = z.object({
  id: IdSchema,
  drugAssetId: IdSchema,
  indicationId: IdSchema,
  sponsorId: IdSchema,
  name: z.string().min(1),
  status: z.enum(["active", "approved", "crl", "withdrawn", "discontinued", "unknown"]),
});
export type ClinicalProgram = z.infer<typeof ClinicalProgramSchema>;

export const TrialStatusSchema = z.enum([
  "planned",
  "recruiting",
  "active",
  "completed",
  "terminated",
  "withdrawn",
  "unknown",
]);
export type TrialStatus = z.infer<typeof TrialStatusSchema>;

export const ClinicalTrialSchema = z.object({
  id: IdSchema,
  nctId: z
    .string()
    .regex(/^NCT\d{8}$/)
    .nullable(),
  programId: IdSchema,
  phase: z.enum(["I", "I/II", "II", "II/III", "III", "IV", "other", "unknown"]),
  title: z.string().min(1),
  status: TrialStatusSchema.default("unknown"),
  terminationReason: z.string().nullable().default(null),
  plannedEnrollment: z.number().int().nonnegative().nullable().default(null),
  actualEnrollment: z.number().int().nonnegative().nullable().default(null),
  masking: z
    .enum(["open", "single", "double", "triple", "quadruple", "unknown"])
    .default("unknown"),
  allocation: z.enum(["randomized", "non_randomized", "unknown"]).default("unknown"),
  biomarkerEnriched: z.boolean().default(false),
  /** CT.gov first posted / registry date when known. */
  registeredAt: IsoDateTimeSchema.nullable().default(null),
  studyStartAt: IsoDateTimeSchema.nullable().default(null),
  primaryCompletionAt: IsoDateTimeSchema.nullable().default(null),
  completionAt: IsoDateTimeSchema.nullable().default(null),
});
export type ClinicalTrial = z.infer<typeof ClinicalTrialSchema>;

export const TrialVersionSchema = z.object({
  id: IdSchema,
  trialId: IdSchema,
  versionLabel: z.string().min(1),
  provenance: TemporalProvenanceSchema,
});
export type TrialVersion = z.infer<typeof TrialVersionSchema>;

export const EndpointFamilySchema = z.enum([
  "OS",
  "PFS",
  "ORR",
  "EFS",
  "DFS",
  "safety",
  "other",
  "unknown",
]);
export type EndpointFamily = z.infer<typeof EndpointFamilySchema>;

export const EndpointSchema = z.object({
  id: IdSchema,
  trialId: IdSchema,
  name: z.string().min(1),
  endpointFamily: EndpointFamilySchema.nullable().default(null),
  isPrimary: z.boolean(),
});
export type Endpoint = z.infer<typeof EndpointSchema>;

export const TrialResultSchema = z.object({
  id: IdSchema,
  trialId: IdSchema,
  endpointId: IdSchema.nullable(),
  primaryEndpointMet: z.boolean().nullable(),
  effectEstimate: z.number().nullable(),
  confidenceInterval: z.tuple([z.number(), z.number()]).nullable(),
  pValue: z.number().nullable(),
  /** Outcome fields are labels — must not enter features before firstPublicAt. */
  provenance: TemporalProvenanceSchema,
});
export type TrialResult = z.infer<typeof TrialResultSchema>;

export const ReviewProgramSchema = z.enum([
  "standard",
  "priority",
  "accelerated",
  "cnpv",
  "unknown",
]);
export type ReviewProgram = z.infer<typeof ReviewProgramSchema>;

export const RegulatoryApplicationSchema = z.object({
  id: IdSchema,
  programId: IdSchema,
  applicationNumber: z.string().nullable(),
  applicationType: z.enum(["NDA", "BLA", "sNDA", "sBLA", "IND", "other", "unknown"]),
  indicationId: IdSchema,
  /** NDA/BLA submission date when publicly known. */
  filedAt: IsoDateTimeSchema.nullable().default(null),
  /** FDA filing acceptance date. */
  acceptedAt: IsoDateTimeSchema.nullable().default(null),
  /** PDUFA / target action date when published (often null under CNPV). */
  pdufaDate: IsoDateTimeSchema.nullable().default(null),
  /** Sponsor-stated expected filing window end (guidance — not a firm commitment). */
  expectedFilingAt: IsoDateTimeSchema.nullable().default(null),
  reviewProgram: ReviewProgramSchema.default("unknown"),
  /** Provenance for acceptance / PDUFA / expected-filing clock facts. */
  clockProvenance: TemporalProvenanceSchema.nullable().default(null),
});
export type RegulatoryApplication = z.infer<typeof RegulatoryApplicationSchema>;

export const RegulatoryActionSchema = z.object({
  id: IdSchema,
  applicationId: IdSchema,
  actionType: z.enum([
    "approval",
    "crl",
    "withdrawal",
    "refuse_to_file",
    "complete_response",
    "other",
  ]),
  actionDate: IsoDateTimeSchema.nullable(),
  provenance: TemporalProvenanceSchema,
});
export type RegulatoryAction = z.infer<typeof RegulatoryActionSchema>;

export const DocumentSchema = z.object({
  id: IdSchema,
  title: z.string().min(1),
  documentType: z.enum([
    "protocol",
    "results",
    "label",
    "review",
    "press_release",
    "sec_filing",
    "publication",
    "market_rules",
    "other",
  ]),
  provenance: TemporalProvenanceSchema,
});
export type Document = z.infer<typeof DocumentSchema>;

export const EvidenceAssertionSchema = z.object({
  id: IdSchema,
  claim: z.string().min(1),
  layer: z.enum([
    "sourced_fact",
    "extracted_observation",
    "calculated_metric",
    "model_inference",
    "user_judgment",
  ]),
  polarity: z.enum(["supports", "contradicts", "neutral", "unknown"]),
  relatedEntityIds: z.array(IdSchema).default([]),
  documentId: IdSchema.nullable(),
  provenance: TemporalProvenanceSchema,
});
export type EvidenceAssertion = z.infer<typeof EvidenceAssertionSchema>;
