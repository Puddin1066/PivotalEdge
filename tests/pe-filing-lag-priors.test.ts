import { describe, expect, it } from "vitest";

import { buildPeToFilingLagPriors, loadGraphFromProgramFixtures } from "@pivotaledge/kg";
import { inferredPeToFilingLagDays, submissionByDeadlineProbability } from "@pivotaledge/models";
import type { ModelFeatures } from "@pivotaledge/models";
import { defaultFixturesRoot, loadProgramFixture } from "@pivotaledge/schemas";

describe("PE→filing lag priors", () => {
  it("builds priors from corpus with measured retatrutide stratum", async () => {
    const root = defaultFixturesRoot();
    const reta = await loadProgramFixture("corpus/live/retatrutide-obesity.json", root);
    const graph = loadGraphFromProgramFixtures([reta]);
    const priors = buildPeToFilingLagPriors(graph, "2026-08-01T00:00:00.000Z");
    expect(priors.measuredPrograms.length).toBeGreaterThan(0);
    expect(priors.strata["metabolic:III"]?.sampleSize).toBeGreaterThan(0);
    expect(priors.strata["metabolic:III"]?.source).toBe("measured");
  });

  it("loads inferred lag from calibration file when present", () => {
    const lag = inferredPeToFilingLagDays("oncology", "III");
    expect(lag).toBeGreaterThan(0);
    // Measured retrospective cohort may be faster than the 540d default prior.
    expect(lag).toBeLessThan(600);
  });

  it("lowers submission_by_T when PE + prior lag implies filing after deadline", () => {
    const features = {
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
      eventDeadline: "2027-06-30T00:00:00.000Z",
      daysRegistrationToPrimaryCompletion: null,
      daysPrimaryCompletionToAcceptance: null,
      daysAcceptanceToPdufa: null,
      daysAcceptanceToAction: null,
      daysCutoffToPdufa: null,
      daysCutoffToDeadline: 300,
      daysPdufaToDeadline: null,
      daysExpectedFilingToDeadline: null,
      inferredReviewWindowDays: 240,
      cohortEmpiricalRate: null,
      cohortSize: 0,
      supportingEvidenceCount: 1,
      programStatus: "active",
      endpointFamily: "EFS",
      biomarkerEnriched: true,
      orphanDesignated: false,
      designationCount: 1,
      priorApprovalCount: 0,
      approvedTherapyCount: 3,
      trialStatus: "active",
      enrollmentRatio: 1,
      primaryResultPublicAt: "2026-08-19T12:00:00.000Z",
      peToFilingLagPriorDays: 540,
    } satisfies ModelFeatures;

    const p = submissionByDeadlineProbability(features, features.eventDeadline);
    expect(p).toBeLessThan(0.2);
  });
});
