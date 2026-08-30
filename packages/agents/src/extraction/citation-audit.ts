import {
  RegulatoryAssessmentSchema,
  TrialAssessmentSchema,
  auditRegulatoryAssessment,
  auditTrialAssessment,
  type CitationAuditResult,
} from "@pivotaledge/schemas";

export type ExtractionAuditReport = {
  kind: "trial" | "regulatory";
  id: string;
  schemaValid: boolean;
  citationAudit: CitationAuditResult;
  zodErrors: string[];
};

export function auditTrialExtraction(raw: unknown, sourceText: string): ExtractionAuditReport {
  const parsed = TrialAssessmentSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      kind: "trial",
      id: "unknown",
      schemaValid: false,
      citationAudit: {
        valid: false,
        schemaValid: false,
        missingCitations: [],
        unsupportedPassages: [],
        fabricatedNumerics: [],
        unresolvedCriticalFields: [],
      },
      zodErrors: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
    };
  }
  const citationAudit = auditTrialAssessment(parsed.data, sourceText);
  return {
    kind: "trial",
    id: parsed.data.trialId,
    schemaValid: true,
    citationAudit,
    zodErrors: [],
  };
}

export function auditRegulatoryExtraction(raw: unknown, sourceText: string): ExtractionAuditReport {
  const parsed = RegulatoryAssessmentSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      kind: "regulatory",
      id: "unknown",
      schemaValid: false,
      citationAudit: {
        valid: false,
        schemaValid: false,
        missingCitations: [],
        unsupportedPassages: [],
        fabricatedNumerics: [],
        unresolvedCriticalFields: [],
      },
      zodErrors: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
    };
  }
  const citationAudit = auditRegulatoryAssessment(parsed.data, sourceText);
  return {
    kind: "regulatory",
    id: parsed.data.applicationId,
    schemaValid: true,
    citationAudit,
    zodErrors: [],
  };
}
