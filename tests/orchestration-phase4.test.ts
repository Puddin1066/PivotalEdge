import { describe, expect, it } from "vitest";

import { EvidenceRecordSchema } from "@pivotaledge/schemas";
import { compileQueryPlan } from "@pivotaledge/kg";
import type { MarketQuestion } from "@pivotaledge/schemas";
import {
  createFixtureResearchAdapter,
  dedupeWithContradictions,
  evaluateInformationGaps,
  inferResearchDomain,
  planTargetedResearch,
  loadOrchestrationConfig,
} from "@pivotaledge/orchestration";
import { ForecastSchema } from "@pivotaledge/schemas";

const submissionQuestion: MarketQuestion = {
  marketId: "pm_intismeran_sub",
  eventType: "NDA_BLA_SUBMISSION",
  drugAssetId: "drug_intismeran",
  drugAliases: ["Intismeran"],
  sponsorId: "sp_merck",
  indicationId: "ind_rsv",
  population: null,
  applicationId: null,
  linkedTrialIds: ["nct_intismeran"],
  endpointIds: [],
  eventDeadline: "2027-06-30T00:00:00.000Z",
  resolutionSource: "FDA",
  resolutionDefinition: "BLA submitted by deadline",
  conditionalApprovalCounts: null,
  ambiguityFlags: [],
  parserConfidence: 0.9,
};

describe("Phase 4: contract-aware query plans", () => {
  it("uses filing-lag cohorts for NDA_BLA_SUBMISSION", () => {
    const plan = compileQueryPlan(submissionQuestion, {
      forecastCutoff: "2026-01-01T00:00:00.000Z",
      therapeuticArea: "infectious_disease",
    });
    expect(plan.analogueCohorts.some((c) => c.cohortId === "cohort_filing_lag")).toBe(true);
    expect(plan.currentEvidenceQueries[0]?.queryId).toBe("evidence_filing_guidance");
  });

  it("uses review-duration cohorts for FDA_APPROVAL_BY_DATE", async () => {
    const { loadMarketFixture } = await import("@pivotaledge/schemas");
    const market = await loadMarketFixture("market-cases/synalphimab-approval-by-date.json");
    const plan = compileQueryPlan(market.marketQuestion, {
      forecastCutoff: "2024-06-01T00:00:00.000Z",
    });
    expect(plan.analogueCohorts.some((c) => c.cohortId === "cohort_review_duration")).toBe(true);
  });
});

describe("Phase 4: submission gap + fail-closed research", () => {
  it("surfaces expectedFilingAt gap for NDA_BLA_SUBMISSION without filing guidance", async () => {
    const bundle = {
      marketQuestionId: submissionQuestion.marketId,
      currentProgram: {
        programId: "prog_int",
        drugAssetId: "drug_intismeran",
        drugName: "Intismeran",
        sponsorId: "sp_merck",
        sponsorName: "Merck",
        indicationId: "ind_rsv",
        indicationName: "RSV",
        therapeuticArea: "infectious_disease",
        status: "active",
        trialIds: ["nct_intismeran"],
        applicationId: null,
        primaryEndpointMet: true,
        applicationFiled: false,
        expectedFilingAt: null,
      },
      cohorts: [],
      exactAnalogues: [],
      supportingEvidenceIds: [],
      contradictoryEvidenceIds: [],
      missingHighValueEvidence: [],
      cutoffCompliance: {
        forecastCutoff: "2026-01-01T00:00:00.000Z",
        checkedAt: "2026-01-01T00:00:00.000Z",
        includedAssertionIds: [],
        excludedAssertionIds: [],
        leakageDetected: false,
        notes: [],
      },
    };
    const forecast = ForecastSchema.parse({
      id: "fc_sub",
      marketQuestionId: submissionQuestion.marketId,
      programId: "prog_int",
      generatedAt: "2026-01-01T00:00:00.000Z",
      forecastCutoff: "2026-01-01T00:00:00.000Z",
      modelProbability: 0.4,
      conservativeProbability: 0.3,
      intervalLow: 0.2,
      intervalHigh: 0.5,
      modelVersion: "test",
      calibrationStatus: "held_out",
      components: [],
      supportingEvidenceIds: [],
      cutoffAudit: bundle.cutoffCompliance,
    });

    const gaps = evaluateInformationGaps(submissionQuestion, bundle, forecast);
    expect(gaps.map((g) => g.featureName)).toContain("expectedFilingAt");

    const tasks = planTargetedResearch(gaps, loadOrchestrationConfig());
    const filingTask = tasks.find((t) => t.gapFeature === "expectedFilingAt");
    expect(filingTask?.domain).toBe("company");

    const research = createFixtureResearchAdapter();
    const records = filingTask
      ? await research.executeTask({
          task: filingTask,
          marketQuestion: submissionQuestion,
          forecastCutoff: "2026-01-01T00:00:00.000Z",
        })
      : [];
    expect(records).toHaveLength(0);
  });
});

describe("Phase 4: contradiction preservation", () => {
  it("flags contradictory assertions without overwriting", () => {
    const base = EvidenceRecordSchema.parse({
      id: "ev_a",
      subjectId: "prog_1",
      predicate: "acceptedAt",
      objectValue: "2024-01-01T00:00:00.000Z",
      evidenceType: "regulatory",
      sourceType: "openfda",
      sourceUrl: "fixture://a",
      sourceId: null,
      firstPublicAt: "2024-01-01T00:00:00.000Z",
      retrievedAt: "2024-02-01T00:00:00.000Z",
      forecastCutoff: "2024-06-01T00:00:00.000Z",
      supportDirection: "supports",
      evidenceStrength: 0.8,
      extractionConfidence: 0.9,
      exactPassage: "Accepted Jan 2024",
      locator: null,
      extractorVersion: "test/1",
      checksum: "checksum_a",
    });
    const conflict = { ...base, id: "ev_b", objectValue: "2024-03-01T00:00:00.000Z", checksum: "checksum_b" };

    const result = dedupeWithContradictions([base, conflict], []);
    expect(result.novel).toHaveLength(1);
    expect(result.contradictory).toHaveLength(1);
    expect(result.contradictoryIds).toContain("ev_b");
    expect(result.contradictoryIds).toContain("ev_a");
  });
});

describe("Phase 4: research domain routing", () => {
  it("routes openfda gaps to regulatory domain", () => {
    const domain = inferResearchDomain({
      featureName: "pdufaDate",
      currentValue: null,
      missing: true,
      featureImportance: 0.85,
      localSensitivity: null,
      uncertainty: 1,
      potentiallyDecisionChanging: true,
      researchQuestion: "PDUFA date?",
      sourcePriority: ["openfda", "fda"],
    });
    expect(domain).toBe("regulatory");
  });
});
