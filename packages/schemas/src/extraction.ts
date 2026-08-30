import { z } from "zod";

import { IdSchema } from "./common.js";

/** Every non-null critical extraction must cite an exact passage in a source document. */
export const ExtractionCitationSchema = z.object({
  documentId: IdSchema,
  exactPassage: z.string().min(1),
  locator: z.string().nullable(),
});
export type ExtractionCitation = z.infer<typeof ExtractionCitationSchema>;

export const EndpointAssessmentSchema = z.object({
  endpointId: IdSchema.nullable(),
  name: z.string().min(1),
  isPrimary: z.boolean(),
  met: z.boolean().nullable(),
  effectEstimate: z.number().nullable(),
  confidenceInterval: z.tuple([z.number(), z.number()]).nullable(),
  pValue: z.number().nullable(),
  citation: ExtractionCitationSchema.nullable(),
});
export type EndpointAssessment = z.infer<typeof EndpointAssessmentSchema>;

export const SafetySignalSchema = z.object({
  term: z.string().min(1),
  severity: z.enum(["mild", "moderate", "severe", "life_threatening", "unknown"]).nullable(),
  frequency: z.number().nullable(),
  citation: ExtractionCitationSchema.nullable(),
});
export type SafetySignal = z.infer<typeof SafetySignalSchema>;

export const ProtocolChangeSchema = z.object({
  description: z.string().min(1),
  changeDate: z.string().nullable(),
  citation: ExtractionCitationSchema.nullable(),
});
export type ProtocolChange = z.infer<typeof ProtocolChangeSchema>;

export const TrialAssessmentSchema = z.object({
  trialId: IdSchema,
  documentId: IdSchema,
  phase: z.string().nullable(),
  population: z.string().nullable(),
  intervention: z.string().nullable(),
  control: z.string().nullable(),
  primaryEndpoints: z.array(EndpointAssessmentSchema).default([]),
  enrollmentPlanned: z.number().nullable(),
  enrollmentActual: z.number().nullable(),
  primaryEndpointMet: z.boolean().nullable(),
  effectEstimate: z.number().nullable(),
  confidenceInterval: z.tuple([z.number(), z.number()]).nullable(),
  pValue: z.number().nullable(),
  multiplicityControlled: z.boolean().nullable(),
  discontinuationImbalance: z.number().nullable(),
  safetySignals: z.array(SafetySignalSchema).default([]),
  protocolChanges: z.array(ProtocolChangeSchema).default([]),
  supportingAssertionIds: z.array(IdSchema).default([]),
  contradictoryAssertionIds: z.array(IdSchema).default([]),
  unresolvedFields: z.array(z.string()).default([]),
  citations: z.record(ExtractionCitationSchema).default({}),
});
export type TrialAssessment = z.infer<typeof TrialAssessmentSchema>;

export const RegulatoryAssessmentSchema = z.object({
  applicationId: IdSchema,
  documentId: IdSchema,
  actionType: z
    .enum(["approval", "crl", "withdrawal", "refuse_to_file", "complete_response", "other"])
    .nullable(),
  statisticalConcerns: z.array(z.string()).default([]),
  safetyConcerns: z.array(z.string()).default([]),
  benefitRiskSummary: z.string().nullable(),
  manufacturingConcerns: z.array(z.string()).default([]),
  citations: z.record(ExtractionCitationSchema).default({}),
  unresolvedFields: z.array(z.string()).default([]),
  supportingAssertionIds: z.array(IdSchema).default([]),
  contradictoryAssertionIds: z.array(IdSchema).default([]),
});
export type RegulatoryAssessment = z.infer<typeof RegulatoryAssessmentSchema>;

export const TRIAL_CRITICAL_FIELDS = [
  "primaryEndpointMet",
  "effectEstimate",
  "confidenceInterval",
  "pValue",
  "enrollmentPlanned",
  "enrollmentActual",
] as const;

export type TrialCriticalField = (typeof TRIAL_CRITICAL_FIELDS)[number];

export const REGULATORY_CRITICAL_FIELDS = ["actionType", "benefitRiskSummary"] as const;

export type RegulatoryCriticalField = (typeof REGULATORY_CRITICAL_FIELDS)[number];

/** Returns true when passage is a substring of source (case-insensitive, whitespace-normalized). */
export function passageSupportedBySource(passage: string, sourceText: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  const p = norm(passage);
  const src = norm(sourceText);
  return p.length > 0 && src.includes(p);
}

/** Numeric value must appear in its cited passage (prevents fabricated numerics). */
export function numericValueInPassage(value: number, passage: string): boolean {
  const variants = [String(value), value.toFixed(2), value.toFixed(3), value.toFixed(4)];
  const p = passage.toLowerCase();
  return variants.some((v) => p.includes(v.toLowerCase()));
}

export type CitationAuditResult = {
  valid: boolean;
  schemaValid: boolean;
  missingCitations: string[];
  unsupportedPassages: string[];
  fabricatedNumerics: string[];
  unresolvedCriticalFields: string[];
};

export function auditTrialAssessment(
  assessment: TrialAssessment,
  sourceText: string,
  criticalFields: readonly TrialCriticalField[] = TRIAL_CRITICAL_FIELDS,
): CitationAuditResult {
  const missingCitations: string[] = [];
  const unsupportedPassages: string[] = [];
  const fabricatedNumerics: string[] = [];
  const unresolvedCriticalFields: string[] = [];

  for (const field of criticalFields) {
    const value = assessment[field];
    if (value === null || value === undefined) continue;

    const citation = assessment.citations[field];
    if (!citation) {
      missingCitations.push(field);
      continue;
    }
    if (!passageSupportedBySource(citation.exactPassage, sourceText)) {
      unsupportedPassages.push(field);
    }
    if (typeof value === "number" && !numericValueInPassage(value, citation.exactPassage)) {
      fabricatedNumerics.push(field);
    }
    if (Array.isArray(value)) {
      for (const n of value) {
        if (typeof n === "number" && !numericValueInPassage(n, citation.exactPassage)) {
          fabricatedNumerics.push(field);
          break;
        }
      }
    }
  }

  for (const ep of assessment.primaryEndpoints) {
    if (ep.met != null || ep.effectEstimate != null || ep.pValue != null) {
      if (!ep.citation) missingCitations.push(`endpoint:${ep.name}`);
      else if (!passageSupportedBySource(ep.citation.exactPassage, sourceText)) {
        unsupportedPassages.push(`endpoint:${ep.name}`);
      }
    }
  }

  return {
    valid:
      missingCitations.length === 0 &&
      unsupportedPassages.length === 0 &&
      fabricatedNumerics.length === 0 &&
      unresolvedCriticalFields.length === 0,
    schemaValid: true,
    missingCitations,
    unsupportedPassages,
    fabricatedNumerics,
    unresolvedCriticalFields,
  };
}

export function auditRegulatoryAssessment(
  assessment: RegulatoryAssessment,
  sourceText: string,
  criticalFields: readonly RegulatoryCriticalField[] = REGULATORY_CRITICAL_FIELDS,
): CitationAuditResult {
  const missingCitations: string[] = [];
  const unsupportedPassages: string[] = [];

  for (const field of criticalFields) {
    const value = assessment[field];
    if (value === null || value === undefined || value === "") continue;
    const citation = assessment.citations[field];
    if (!citation) {
      missingCitations.push(field);
      continue;
    }
    if (!passageSupportedBySource(citation.exactPassage, sourceText)) {
      unsupportedPassages.push(field);
    }
  }

  return {
    valid: missingCitations.length === 0 && unsupportedPassages.length === 0,
    schemaValid: true,
    missingCitations,
    unsupportedPassages,
    fabricatedNumerics: [],
    unresolvedCriticalFields: [],
  };
}
