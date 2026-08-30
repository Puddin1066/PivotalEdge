import { describe, expect, it } from "vitest";

import type { MarketQuestion, PrecedentBundle } from "@pivotaledge/schemas";
import { ForecastSchema } from "@pivotaledge/schemas";
import {
  evaluateInformationGaps,
  hasMaterialGaps,
  planTargetedResearch,
  topGapScore,
  loadOrchestrationConfig,
} from "@pivotaledge/orchestration";

const baseQuestion: MarketQuestion = {
  marketId: "pm_test",
  eventType: "FDA_APPROVAL_BY_DATE",
  drugAssetId: "drug_1",
  drugAliases: [],
  sponsorId: "sp_1",
  indicationId: "ind_1",
  population: null,
  applicationId: null,
  linkedTrialIds: [],
  endpointIds: [],
  eventDeadline: "2025-12-31T00:00:00.000Z",
  resolutionSource: "FDA",
  resolutionDefinition: "Approved by deadline",
  conditionalApprovalCounts: null,
  ambiguityFlags: [],
  parserConfidence: 0.9,
};

const baseBundle: PrecedentBundle = {
  marketQuestionId: "pm_test",
  currentProgram: {
    programId: "prog_1",
    drugAssetId: "drug_1",
    drugName: "TestDrug",
    sponsorId: "sp_1",
    sponsorName: "Sponsor",
    indicationId: "ind_1",
    indicationName: "Indication",
    therapeuticArea: "oncology",
    status: "active",
    trialIds: [],
    applicationId: null,
    primaryEndpointMet: null,
    applicationFiled: false,
    applicationAccepted: false,
    filedAt: null,
    acceptedAt: null,
    pdufaDate: null,
    expectedFilingAt: null,
    reviewProgram: "unknown",
    plannedEnrollment: null,
    actualEnrollment: null,
    trialResults: [],
  },
  cohorts: [],
  exactAnalogues: [],
  supportingEvidenceIds: [],
  contradictoryEvidenceIds: [],
  missingHighValueEvidence: ["pdufa_or_target_action_date", "trial_results"],
  cutoffCompliance: {
    forecastCutoff: "2024-06-01T00:00:00.000Z",
    checkedAt: "2024-06-01T00:00:00.000Z",
    includedAssertionIds: [],
    excludedAssertionIds: [],
    leakageDetected: false,
    notes: [],
  },
};

const forecast = ForecastSchema.parse({
  id: "fc_test",
  marketQuestionId: "pm_test",
  programId: "prog_1",
  generatedAt: "2024-06-01T00:00:00.000Z",
  forecastCutoff: "2024-06-01T00:00:00.000Z",
  modelProbability: 0.5,
  conservativeProbability: 0.4,
  intervalLow: 0.3,
  intervalHigh: 0.6,
  modelVersion: "test",
  calibrationStatus: "held_out",
  components: [],
  supportingEvidenceIds: [],
  cutoffAudit: baseBundle.cutoffCompliance,
});

describe("orchestration: gap evaluation (pure)", () => {
  it("surfaces contract-required missing fields", () => {
    const gaps = evaluateInformationGaps(baseQuestion, baseBundle, forecast);
    const fields = gaps.map((g) => g.featureName);

    expect(fields).toContain("primaryEndpointMet");
    expect(fields).toContain("review_clock");
    expect(topGapScore(gaps)).toBeGreaterThan(0);
  });

  it("plans research only for gaps above threshold", () => {
    const config = loadOrchestrationConfig({ minHighValueGapScore: 0.25 });
    const gaps = evaluateInformationGaps(baseQuestion, baseBundle, forecast);
    const tasks = planTargetedResearch(gaps, config);

    expect(tasks.length).toBeGreaterThan(0);
    expect(tasks.every((t) => t.priorityScore >= config.minHighValueGapScore)).toBe(true);
    expect(hasMaterialGaps(gaps, config)).toBe(true);
  });

  it("returns no tasks when all requirements satisfied", () => {
    const filledBundle: PrecedentBundle = {
      ...baseBundle,
      missingHighValueEvidence: [],
      currentProgram: {
        ...baseBundle.currentProgram!,
        primaryEndpointMet: true,
        applicationAccepted: true,
        acceptedAt: "2024-01-01T00:00:00.000Z",
        pdufaDate: "2024-09-01T00:00:00.000Z",
      },
    };
    const gaps = evaluateInformationGaps(baseQuestion, filledBundle, forecast);
    const config = loadOrchestrationConfig();
    expect(planTargetedResearch(gaps, config)).toHaveLength(0);
  });
});
