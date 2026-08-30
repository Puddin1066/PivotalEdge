import { describe, expect, it } from "vitest";

import {
  computeRegulatoryClockMetrics,
  loadGraphFromProgramFixtures,
} from "@pivotaledge/kg";
import {
  decisionByDeadlineProbability,
  extractFeatures,
  submissionByDeadlineProbability,
} from "@pivotaledge/models";
import type { MarketQuestion, PrecedentBundle } from "@pivotaledge/schemas";
import { loadProgramFixture } from "@pivotaledge/schemas";

function audit(cutoff: string) {
  return {
    forecastCutoff: cutoff,
    checkedAt: cutoff,
    includedAssertionIds: [] as string[],
    excludedAssertionIds: [] as string[],
    leakageDetected: false,
    notes: [] as string[],
  };
}

describe("regulatory clock metrics", () => {
  it("computes milestone deltas between registration, completion, acceptance", () => {
    const m = computeRegulatoryClockMetrics({
      forecastCutoff: "2026-08-01T00:00:00.000Z",
      eventDeadline: "2026-12-31T00:00:00.000Z",
      registeredAt: "2024-10-02T00:00:00.000Z",
      primaryCompletionAt: "2026-05-31T00:00:00.000Z",
      acceptedAt: "2026-07-22T00:00:00.000Z",
      pdufaDate: null,
      reviewProgram: "cnpv",
    });
    expect(m.daysRegistrationToPrimaryCompletion).toBeGreaterThan(500);
    expect(m.daysPrimaryCompletionToAcceptance).toBeGreaterThan(40);
    expect(m.daysPrimaryCompletionToAcceptance).toBeLessThan(60);
    expect(m.inferredReviewWindowDays).toBe(45);
    expect(m.daysCutoffToDeadline).toBeGreaterThan(140);
  });

  it("raises decision_by_T when CNPV acceptance leaves months of slack before deadline", async () => {
    const fixture = await loadProgramFixture("corpus/live/daraxonrasib-pdac.json");
    const graph = loadGraphFromProgramFixtures([fixture]);
    const prog = graph.getProgram("prog_daraxonrasib_pdac")!;
    const cutoff = "2026-08-01T00:00:00.000Z";
    const snap = graph.clinicalFeaturesAtCutoff(prog, cutoff);
    expect(snap.applicationAccepted).toBe(true);
    expect(snap.acceptedAt).toBe("2026-07-22T16:05:00.000Z");
    expect(snap.reviewProgram).toBe("cnpv");
    expect(snap.daysPrimaryCompletionToAcceptance).not.toBeNull();
    expect(snap.resolvedApproved).toBeNull();

    const marketQuestion = {
      marketId: "pm_test",
      eventType: "FDA_APPROVAL_BY_DATE",
      drugAssetId: prog.drug.id,
      drugAliases: [],
      sponsorId: prog.sponsor.id,
      indicationId: prog.indication.id,
      population: null,
      applicationId: prog.application?.id ?? null,
      linkedTrialIds: [],
      endpointIds: [],
      eventDeadline: "2026-12-31T00:00:00.000Z",
      resolutionSource: "test",
      resolutionDefinition: "test",
      conditionalApprovalCounts: true,
      ambiguityFlags: [],
      parserConfidence: 1,
    } satisfies MarketQuestion;

    const bundle = {
      marketQuestionId: "pm_test",
      currentProgram: {
        programId: prog.program.id,
        drugAssetId: prog.drug.id,
        drugName: prog.drug.preferredName,
        sponsorId: prog.sponsor.id,
        sponsorName: prog.sponsor.name,
        indicationId: prog.indication.id,
        indicationName: prog.indication.name,
        therapeuticArea: prog.indication.therapeuticArea,
        status: "active",
        trialIds: prog.trials.map((t) => t.id),
        applicationId: prog.application?.id ?? null,
        primaryEndpointMet: true,
        applicationFiled: snap.applicationFiled,
        applicationAccepted: snap.applicationAccepted,
        acceptedAt: snap.acceptedAt,
        reviewProgram: snap.reviewProgram,
        primaryCompletionAt: snap.primaryCompletionAt,
        daysPrimaryCompletionToAcceptance: snap.daysPrimaryCompletionToAcceptance,
        inferredReviewWindowDays: snap.inferredReviewWindowDays,
      },
      cohorts: [],
      exactAnalogues: [],
      supportingEvidenceIds: [],
      contradictoryEvidenceIds: [],
      missingHighValueEvidence: [],
      cutoffCompliance: audit(cutoff),
    } satisfies PrecedentBundle;

    const features = extractFeatures(bundle, marketQuestion, { forecastCutoff: cutoff });
    expect(decisionByDeadlineProbability(features, marketQuestion.eventDeadline)).toBeGreaterThan(
      0.9,
    );
  });

  it("crushes submission_by_T when sponsor filing guidance is after market deadline", async () => {
    const fixture = await loadProgramFixture("corpus/live/retatrutide-obesity.json");
    const graph = loadGraphFromProgramFixtures([fixture]);
    const prog = graph.getProgram("prog_retatrutide_obesity")!;
    const cutoff = "2026-08-01T00:00:00.000Z";
    const snap = graph.clinicalFeaturesAtCutoff(prog, cutoff);
    expect(snap.applicationFiled).toBe(false);
    expect(snap.expectedFilingAt).toBe("2027-03-31T23:59:00.000Z");

    const marketQuestion = {
      marketId: "pm_reta",
      eventType: "FDA_APPROVAL_BY_DATE",
      drugAssetId: prog.drug.id,
      drugAliases: [],
      sponsorId: prog.sponsor.id,
      indicationId: prog.indication.id,
      population: null,
      applicationId: null,
      linkedTrialIds: [],
      endpointIds: [],
      eventDeadline: "2026-12-31T00:00:00.000Z",
      resolutionSource: "test",
      resolutionDefinition: "test",
      conditionalApprovalCounts: true,
      ambiguityFlags: [],
      parserConfidence: 1,
    } satisfies MarketQuestion;

    const bundle = {
      marketQuestionId: "pm_reta",
      currentProgram: {
        programId: prog.program.id,
        drugAssetId: prog.drug.id,
        drugName: prog.drug.preferredName,
        sponsorId: prog.sponsor.id,
        sponsorName: prog.sponsor.name,
        indicationId: prog.indication.id,
        indicationName: prog.indication.name,
        therapeuticArea: prog.indication.therapeuticArea,
        status: "active",
        trialIds: prog.trials.map((t) => t.id),
        applicationId: prog.application?.id ?? null,
        primaryEndpointMet: true,
        applicationFiled: false,
        applicationAccepted: false,
        expectedFilingAt: snap.expectedFilingAt,
        reviewProgram: "unknown",
      },
      cohorts: [],
      exactAnalogues: [],
      supportingEvidenceIds: [],
      contradictoryEvidenceIds: [],
      missingHighValueEvidence: [],
      cutoffCompliance: audit(cutoff),
    } satisfies PrecedentBundle;

    const features = extractFeatures(bundle, marketQuestion, { forecastCutoff: cutoff });
    expect(submissionByDeadlineProbability(features, marketQuestion.eventDeadline)).toBeLessThan(
      0.15,
    );
  });
});
