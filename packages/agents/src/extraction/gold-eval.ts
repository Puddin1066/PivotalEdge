import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

import {
  RegulatoryAssessmentSchema,
  TrialAssessmentSchema,
  auditRegulatoryAssessment,
  auditTrialAssessment,
} from "@pivotaledge/schemas";

import { auditRegulatoryExtraction, auditTrialExtraction } from "./citation-audit.js";
import { heuristicExtractRegulatory } from "./regulatory-extractor.js";
import { heuristicExtractTrial } from "./trial-extractor.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const GoldTrialCaseSchema = z.object({
  id: z.string(),
  kind: z.literal("trial"),
  trialId: z.string(),
  documentId: z.string(),
  sourceText: z.string().min(1),
});
export const GoldRegulatoryCaseSchema = z.object({
  id: z.string(),
  kind: z.literal("regulatory"),
  applicationId: z.string(),
  documentId: z.string(),
  sourceText: z.string().min(1),
});
export const GoldCaseSchema = z.discriminatedUnion("kind", [
  GoldTrialCaseSchema,
  GoldRegulatoryCaseSchema,
]);
export type GoldCase = z.infer<typeof GoldCaseSchema>;

export type GoldEvalResult = {
  caseId: string;
  kind: "trial" | "regulatory";
  schemaValid: boolean;
  citationValid: boolean;
  issues: string[];
};

export type GoldEvalSummary = {
  total: number;
  schemaValidityRate: number;
  citationValidityRate: number;
  results: GoldEvalResult[];
  passed: boolean;
};

export function defaultGoldDir(): string {
  return path.resolve(__dirname, "../../../../fixtures/extraction-gold");
}

export async function loadGoldCases(dir = defaultGoldDir()): Promise<GoldCase[]> {
  const { readdir } = await import("node:fs/promises");
  const files = (await readdir(dir)).filter((f) => f.endsWith(".json"));
  const cases: GoldCase[] = [];
  for (const file of files) {
    const raw = JSON.parse(await readFile(path.join(dir, file), "utf8")) as unknown;
    cases.push(GoldCaseSchema.parse(raw));
  }
  return cases;
}

export function evaluateGoldCase(case_: GoldCase): GoldEvalResult {
  const issues: string[] = [];

  if (case_.kind === "trial") {
    const assessment = heuristicExtractTrial({
      trialId: case_.trialId,
      documentId: case_.documentId,
      sourceText: case_.sourceText,
    });
    const schemaValid = TrialAssessmentSchema.safeParse(assessment).success;
    const audit = auditTrialExtraction(assessment, case_.sourceText);
    const citationValid = audit.schemaValid && audit.citationAudit.valid;
    if (!schemaValid) issues.push("schema_invalid");
    if (audit.citationAudit.missingCitations.length)
      issues.push(`missing_citations:${audit.citationAudit.missingCitations.join(",")}`);
    if (audit.citationAudit.fabricatedNumerics.length)
      issues.push(`fabricated:${audit.citationAudit.fabricatedNumerics.join(",")}`);
    if (audit.citationAudit.unsupportedPassages.length)
      issues.push(`unsupported:${audit.citationAudit.unsupportedPassages.join(",")}`);
    return {
      caseId: case_.id,
      kind: "trial",
      schemaValid,
      citationValid,
      issues,
    };
  }

  const assessment = heuristicExtractRegulatory({
    applicationId: case_.applicationId,
    documentId: case_.documentId,
    sourceText: case_.sourceText,
  });
  const schemaValid = RegulatoryAssessmentSchema.safeParse(assessment).success;
  const audit = auditRegulatoryExtraction(assessment, case_.sourceText);
  const citationValid = audit.schemaValid && audit.citationAudit.valid;
  if (!schemaValid) issues.push("schema_invalid");
  if (audit.citationAudit.missingCitations.length)
    issues.push(`missing_citations:${audit.citationAudit.missingCitations.join(",")}`);
  return {
    caseId: case_.id,
    kind: "regulatory",
    schemaValid,
    citationValid,
    issues,
  };
}

export function summarizeGoldEval(results: GoldEvalResult[]): GoldEvalSummary {
  const total = results.length;
  const schemaValid = results.filter((r) => r.schemaValid).length;
  const citationValid = results.filter((r) => r.citationValid).length;
  const schemaValidityRate = total ? schemaValid / total : 0;
  const citationValidityRate = total ? citationValid / total : 0;
  return {
    total,
    schemaValidityRate,
    citationValidityRate,
    results,
    passed: schemaValidityRate >= 0.95 && citationValidityRate >= 0.95,
  };
}

export async function runGoldEval(dir = defaultGoldDir()): Promise<GoldEvalSummary> {
  const cases = await loadGoldCases(dir);
  const results = cases.map(evaluateGoldCase);
  return summarizeGoldEval(results);
}

// re-export audit helpers used in tests
export { auditTrialAssessment, auditRegulatoryAssessment };
