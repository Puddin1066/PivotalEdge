import { describe, expect, it } from "vitest";

import {
  auditRegulatoryAssessment,
  auditTrialAssessment,
  passageSupportedBySource,
  numericValueInPassage,
  TrialAssessmentSchema,
} from "@pivotaledge/schemas";
import {
  auditTrialExtraction,
  heuristicExtractTrial,
  heuristicExtractRegulatory,
  runGoldEval,
  ExtractionReviewQueue,
} from "@pivotaledge/agents";

const SOURCE =
  "Primary endpoint of overall survival was met (HR 0.72, 95% CI 0.61-0.85, p=0.0001).";

describe("S3: citation primitives", () => {
  it("passageSupportedBySource matches substrings", () => {
    expect(passageSupportedBySource("HR 0.72", SOURCE)).toBe(true);
    expect(passageSupportedBySource("not in text", SOURCE)).toBe(false);
  });

  it("numericValueInPassage requires value in passage", () => {
    expect(numericValueInPassage(0.72, SOURCE)).toBe(true);
    expect(numericValueInPassage(0.99, SOURCE)).toBe(false);
  });
});

describe("S3: trial extraction", () => {
  it("heuristic extractor cites critical numerics from source", () => {
    const assessment = heuristicExtractTrial({
      trialId: "trial_1",
      documentId: "doc_1",
      sourceText: SOURCE,
    });
    expect(TrialAssessmentSchema.safeParse(assessment).success).toBe(true);
    expect(assessment.primaryEndpointMet).toBe(true);
    expect(assessment.effectEstimate).toBe(0.72);
    const audit = auditTrialAssessment(assessment, SOURCE);
    expect(audit.valid).toBe(true);
    expect(audit.fabricatedNumerics).toHaveLength(0);
  });

  it("flags missing citations when values present without passage", () => {
    const bad = TrialAssessmentSchema.parse({
      trialId: "t1",
      documentId: "d1",
      phase: null,
      population: null,
      intervention: null,
      control: null,
      primaryEndpoints: [],
      enrollmentPlanned: null,
      enrollmentActual: null,
      primaryEndpointMet: true,
      effectEstimate: 0.5,
      confidenceInterval: null,
      pValue: null,
      multiplicityControlled: null,
      discontinuationImbalance: null,
      safetySignals: [],
      protocolChanges: [],
      citations: {},
      unresolvedFields: [],
    });
    const audit = auditTrialExtraction(bad, SOURCE);
    expect(audit.citationAudit.valid).toBe(false);
    expect(audit.citationAudit.missingCitations.length).toBeGreaterThan(0);
  });
});

describe("S3: regulatory extraction", () => {
  it("heuristic CRL extractor does not invent CRL scientific details", () => {
    const text =
      "FDA issued a Complete Response Letter citing manufacturing inspection deficiencies. CRL contents are not inferred beyond this public statement.";
    const assessment = heuristicExtractRegulatory({
      applicationId: "app_1",
      documentId: "doc_1",
      sourceText: text,
    });
    expect(assessment.actionType).toBe("crl");
    expect(assessment.statisticalConcerns).toHaveLength(0);
    const audit = auditRegulatoryAssessment(assessment, text);
    expect(audit.valid).toBe(true);
  });
});

describe("S3: gold set gate", () => {
  it("meets >=95% schema and citation validity on gold fixtures", async () => {
    const summary = await runGoldEval();
    expect(summary.total).toBeGreaterThanOrEqual(3);
    expect(summary.schemaValidityRate).toBeGreaterThanOrEqual(0.95);
    expect(summary.citationValidityRate).toBeGreaterThanOrEqual(0.95);
    expect(summary.passed).toBe(true);
  });
});

describe("S3: extraction review queue", () => {
  it("queues failed audits for human review", () => {
    const queue = new ExtractionReviewQueue();
    const item = queue.enqueue({
      extractionKind: "trial",
      entityId: "trial_x",
      documentId: "doc_x",
      reason: "missing_citations",
      issues: ["primaryEndpointMet"],
    });
    expect(item.status).toBe("pending");
    expect(queue.list("pending")).toHaveLength(1);
  });
});
