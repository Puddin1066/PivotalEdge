import { describe, expect, it } from "vitest";

import { assessContractEvidence } from "@pivotaledge/kg";
import { applyContractCalibrationGate } from "@pivotaledge/scoring";
import type { MarketQuestion, PrecedentBundle } from "@pivotaledge/schemas";

function minimalBundle(overrides: Partial<PrecedentBundle["currentProgram"]> = {}): PrecedentBundle {
  return {
    marketQuestionId: "pm_test",
    currentProgram: {
      programId: "prog_test",
      drugAssetId: "drug_test",
      drugName: "TestDrug",
      sponsorId: "sponsor_test",
      sponsorName: "Test Sponsor",
      indicationId: "ind_test",
      indicationName: "Test Indication",
      therapeuticArea: "oncology",
      status: "active",
      trialIds: ["trial_1"],
      applicationId: null,
      primaryEndpointMet: true,
      ...overrides,
    },
    cohorts: [],
    exactAnalogues: [],
    supportingEvidenceIds: [],
    contradictoryEvidenceIds: [],
    missingHighValueEvidence: [],
    cutoffCompliance: {
      forecastCutoff: "2026-01-01T00:00:00.000Z",
      includedAssertionIds: [],
      excludedAssertionIds: [],
      leakageDetected: false,
      notes: [],
    },
  };
}

function question(eventType: MarketQuestion["eventType"]): MarketQuestion {
  return {
    marketId: "pm_test",
    eventType,
    drugAssetId: "drug_test",
    drugAliases: ["TestDrug"],
    sponsorId: "sponsor_test",
    indicationId: "ind_test",
    population: null,
    applicationId: null,
    linkedTrialIds: ["trial_1"],
    endpointIds: [],
    eventDeadline: "2027-12-31T23:59:00.000Z",
    resolutionSource: "fda",
    resolutionDefinition: "Test resolution",
    conditionalApprovalCounts: true,
    ambiguityFlags: [],
    parserConfidence: 0.9,
  };
}

describe("contract checklist (edge identification P0)", () => {
  it("blocks FDA_APPROVAL_BY_DATE when review clock group missing", () => {
    const assessment = assessContractEvidence(
      question("FDA_APPROVAL_BY_DATE"),
      minimalBundle({ acceptedAt: null, pdufaDate: null, expectedFilingAt: null }),
    );

    expect(assessment.contractCoverage).toBe("blocked");
    expect(assessment.calibrationBlocked).toBe(true);
    expect(assessment.requiredMissing).toContain("review_clock");
  });

  it("passes FDA_APPROVAL_BY_DATE when acceptance present", () => {
    const assessment = assessContractEvidence(
      question("FDA_APPROVAL_BY_DATE"),
      minimalBundle({ acceptedAt: "2026-07-01T00:00:00.000Z" }),
    );

    expect(assessment.requiredPresent).toContain("review_clock");
    expect(assessment.contractCoverage).not.toBe("blocked");
  });

  it("partial review_clock_inferred when PE public and filing lag prior (no sponsor clock)", () => {
    const assessment = assessContractEvidence(
      question("FDA_APPROVAL_BY_DATE"),
      {
        ...minimalBundle({
          acceptedAt: null,
          pdufaDate: null,
          expectedFilingAt: null,
          primaryResultPublicAt: "2026-08-19T12:00:00.000Z",
        }),
        cohorts: [
          {
            cohortId: "cohort_filing_lag",
            cohortDefinition: "PE public → historical filing lag",
            programs: [],
            empiricalRate: null,
            peToFilingLagDaysMedian: 540,
            peToFilingLagSampleSize: 0,
          },
        ],
      },
    );

    expect(assessment.requiredPresent).toContain("review_clock_inferred");
    expect(assessment.requiredMissing).toContain("review_clock");
    expect(assessment.contractCoverage).toBe("partial");
    expect(assessment.calibrationBlocked).toBe(false);
  });

  it("applyContractCalibrationGate allows BET_NO on partial review_clock_inferred", () => {
    const gated = applyContractCalibrationGate(
      {
        action: "BET_NO",
        executablePrice: 0.33,
        netEdge: 0.08,
        maximumEntryPrice: 0.38,
        primaryThesis: "edge",
        strongestCounterargument: "risk",
        invalidators: [],
      },
      {
        eventType: "FDA_APPROVAL_BY_DATE",
        requiredPresent: ["primaryEndpointMet", "review_clock_inferred"],
        requiredMissing: ["review_clock"],
        contractCoverage: "partial",
        calibrationBlocked: false,
        notes: [],
      },
    );

    expect(gated.action).toBe("BET_NO");
  });

  it("applyContractCalibrationGate blocks BET_YES on partial review_clock_inferred", () => {
    const gated = applyContractCalibrationGate(
      {
        action: "BET_YES",
        executablePrice: 0.4,
        netEdge: 0.08,
        maximumEntryPrice: 0.45,
        primaryThesis: "edge",
        strongestCounterargument: "risk",
        invalidators: [],
      },
      {
        eventType: "FDA_APPROVAL_BY_DATE",
        requiredPresent: ["primaryEndpointMet", "review_clock_inferred"],
        requiredMissing: ["review_clock"],
        contractCoverage: "partial",
        calibrationBlocked: false,
        notes: [],
      },
    );

    expect(gated.action).toBe("NO_BET");
    expect(gated.primaryThesis).toContain("cannot BET_YES");
  });

  it("blocks NDA_BLA_SUBMISSION without expectedFilingAt", () => {
    const assessment = assessContractEvidence(
      question("NDA_BLA_SUBMISSION"),
      minimalBundle({ expectedFilingAt: null }),
    );

    expect(assessment.requiredMissing).toContain("expectedFilingAt");
    expect(assessment.calibrationBlocked).toBe(true);
    expect(assessment.notes.some((n) => n.includes("do not invent"))).toBe(true);
  });

  it("applyContractCalibrationGate downgrades BET_* when blocked", () => {
    const gated = applyContractCalibrationGate(
      {
        action: "BET_YES",
        executablePrice: 0.4,
        netEdge: 0.08,
        maximumEntryPrice: 0.45,
        primaryThesis: "edge",
        strongestCounterargument: "risk",
        invalidators: [],
      },
      {
        eventType: "FDA_APPROVAL_BY_DATE",
        requiredPresent: ["primaryEndpointMet"],
        requiredMissing: ["review_clock"],
        contractCoverage: "blocked",
        calibrationBlocked: true,
        notes: [],
      },
    );

    expect(gated.action).toBe("NO_BET");
    expect(gated.primaryThesis).toContain("Contract checklist blocked");
  });
});
