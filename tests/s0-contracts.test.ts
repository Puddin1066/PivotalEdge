import { describe, expect, it } from "vitest";

import {
  BetRecommendationSchema,
  ClinicalProgramSchema,
  ModelCallSchema,
  JobSchema,
  MarketQuestionSchema,
  PredictionMarketSchema,
  RegulatoryActionSchema,
  TemporalProvenanceSchema,
  isAvailableAtCutoff,
  loadMarketFixture,
  loadProgramFixture,
  parseEnv,
  safeParseEnv,
} from "@pivotaledge/schemas";

describe("S0 gate: representative fixtures validate", () => {
  it("loads approved clinical program with FDA approval action", async () => {
    const fixture = await loadProgramFixture("approved/synalphimab-nsclc.json");
    expect(fixture.program.status).toBe("approved");
    expect(ClinicalProgramSchema.parse(fixture.program).id).toBe("prog_syn_alpha_nsclc");
    expect(fixture.regulatoryAction).not.toBeNull();
    expect(RegulatoryActionSchema.parse(fixture.regulatoryAction!).actionType).toBe("approval");
  });

  it("loads CRL clinical program", async () => {
    const fixture = await loadProgramFixture("crl/synbetalib-ra.json");
    expect(fixture.program.status).toBe("crl");
    expect(fixture.regulatoryAction?.actionType).toBe("crl");
  });

  it("loads Polymarket market + MarketQuestion", async () => {
    const fixture = await loadMarketFixture("market-cases/synalphimab-approval-by-date.json");
    expect(PredictionMarketSchema.parse(fixture.market).platform).toBe("polymarket");
    expect(MarketQuestionSchema.parse(fixture.marketQuestion).eventType).toBe(
      "FDA_APPROVAL_BY_DATE",
    );
  });
});

describe("temporal cutoff contract", () => {
  it("allows evidence published at or before cutoff", () => {
    expect(isAvailableAtCutoff("2022-03-15T14:00:00.000Z", "2022-06-01T00:00:00.000Z")).toBe(true);
    expect(isAvailableAtCutoff("2022-03-15T14:00:00.000Z", "2022-03-15T14:00:00.000Z")).toBe(true);
  });

  it("rejects future evidence and unknown firstPublicAt (fail closed)", () => {
    expect(isAvailableAtCutoff("2023-01-10T16:00:00.000Z", "2022-06-01T00:00:00.000Z")).toBe(false);
    expect(isAvailableAtCutoff(null, "2022-06-01T00:00:00.000Z")).toBe(false);
  });

  it("parses TemporalProvenance", () => {
    const p = TemporalProvenanceSchema.parse({
      sourceUrl: "fixture://x",
      sourceSystem: "fixture",
      retrievedAt: "2024-01-01T00:00:00.000Z",
      firstPublicAt: "2023-01-01T00:00:00.000Z",
      effectiveAt: null,
      versionId: "v1",
      checksum: "abc",
      exactPassage: "passage",
      locator: "p1",
      accessClass: "open",
    });
    expect(p.checksum).toBe("abc");
  });
});

describe("model-call and job records", () => {
  it("validates ModelCall", () => {
    const call = ModelCallSchema.parse({
      id: "mc_1",
      purpose: "market_parse",
      modelName: "gpt-4.1",
      promptVersion: "market-parse@1",
      schemaVersion: "MarketQuestion@1",
      startedAt: "2024-01-01T00:00:00.000Z",
      completedAt: "2024-01-01T00:00:01.000Z",
      inputTokens: 100,
      outputTokens: 50,
      costUsd: 0.01,
      sourceIds: ["pm_poly_syn_001"],
      forecastCutoff: null,
      status: "succeeded",
      errorMessage: null,
    });
    expect(call.purpose).toBe("market_parse");
  });

  it("validates Job", () => {
    const job = JobSchema.parse({
      id: "job_1",
      jobType: "forecast",
      status: "succeeded",
      createdAt: "2024-01-01T00:00:00.000Z",
      startedAt: "2024-01-01T00:00:01.000Z",
      completedAt: "2024-01-01T00:00:05.000Z",
      attempts: 1,
      relatedEntityIds: ["prog_syn_alpha_nsclc"],
      errorMessage: null,
      costUsd: 0.02,
    });
    expect(job.jobType).toBe("forecast");
  });
});

describe("BetRecommendation contract", () => {
  it("accepts a NO_BET recommendation shape", () => {
    const rec = BetRecommendationSchema.parse({
      action: "NO_BET",
      marketId: "pm_poly_syn_001",
      generatedAt: "2024-06-01T12:00:00.000Z",
      expiresAt: "2024-06-02T12:00:00.000Z",
      modelProbability: 0.55,
      marketAdjustedProbability: 0.52,
      conservativeProbability: 0.4,
      executablePrice: 0.48,
      maximumEntryPrice: null,
      netEdge: -0.08,
      recommendedStake: 0,
      maximumStake: 0,
      bankrollFraction: 0,
      evidenceConfidence: "moderate",
      resolutionRisk: "low",
      latentInformationRisk: "low",
      primaryThesis: "Insufficient edge after penalties.",
      strongestCounterargument: "Base-rate may be optimistic for this class.",
      invalidators: ["new CRL for class competitor"],
      supportingEvidenceIds: [],
      forecastId: "fc_1",
      orderBookSnapshotId: "ob_1",
      policyVersion: "betting-policy@0",
    });
    expect(rec.action).toBe("NO_BET");
  });
});

describe("env validation", () => {
  it("parses defaults", () => {
    const env = parseEnv({ NODE_ENV: "test" });
    expect(env.NODE_ENV).toBe("test");
  });

  it("safeParse succeeds with empty optional secrets", () => {
    expect(safeParseEnv({ NODE_ENV: "development" }).success).toBe(true);
  });
});
