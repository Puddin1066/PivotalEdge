import { describe, expect, it } from "vitest";

import { decisionByDeadlineProbability } from "@pivotaledge/models";
import type { ModelFeatures } from "@pivotaledge/models";

function baseFeatures(overrides: Partial<ModelFeatures> = {}): ModelFeatures {
  return {
    phase: "III",
    therapeuticArea: "oncology",
    primaryEndpointMet: true,
    applicationFiled: false,
    applicationAccepted: false,
    filedAt: null,
    acceptedAt: null,
    pdufaDate: null,
    expectedFilingAt: null,
    reviewProgram: "unknown",
    forecastCutoff: "2026-08-28T00:00:00.000Z",
    eventDeadline: "2027-12-31T23:59:00.000Z",
    daysRegistrationToPrimaryCompletion: null,
    daysPrimaryCompletionToAcceptance: null,
    daysAcceptanceToPdufa: null,
    daysAcceptanceToAction: null,
    daysCutoffToPdufa: null,
    daysCutoffToDeadline: 490,
    daysPdufaToDeadline: null,
    daysExpectedFilingToDeadline: null,
    inferredReviewWindowDays: 240,
    cohortEmpiricalRate: null,
    cohortSize: 5,
    supportingEvidenceCount: 3,
    programStatus: "active",
    endpointFamily: "EFS",
    biomarkerEnriched: true,
    orphanDesignated: false,
    designationCount: 1,
    priorApprovalCount: 0,
    approvedTherapyCount: 8,
    trialStatus: "active",
    enrollmentRatio: 1,
    primaryResultPublicAt: "2026-08-19T12:00:00.000Z",
    peToFilingLagPriorDays: 540,
    ...overrides,
  };
}

describe("decisionByDeadline with PE→filing→review prior", () => {
  it("low P(decision by T) when inferred filing+review exceeds deadline", () => {
    const p = decisionByDeadlineProbability(
      baseFeatures(),
      "2027-12-31T23:59:00.000Z",
    );
    expect(p).toBeLessThan(0.15);
  });

  it("uses sponsor expectedFilingAt when present (over prior)", () => {
    const withGuidance = decisionByDeadlineProbability(
      baseFeatures({ expectedFilingAt: "2026-06-01T00:00:00.000Z" }),
      "2027-12-31T23:59:00.000Z",
    );
    const priorOnly = decisionByDeadlineProbability(baseFeatures(), "2027-12-31T23:59:00.000Z");
    expect(withGuidance).toBeGreaterThan(priorOnly);
  });
});
