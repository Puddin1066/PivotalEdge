import { describe, expect, it } from "vitest";

import { buildRetrospectiveProgramFixture, type EnrichSeedProgram } from "@pivotaledge/adapters";
import {
  clinicalCalibrationCaseFromProgram,
  holdoutCaseFromProgram,
} from "@pivotaledge/evals";

const sampleSeed: EnrichSeedProgram = {
  slug: "test-crl-onc",
  preferredName: "Testimab",
  modality: "monoclonal_antibody",
  mechanismName: "Test target",
  mechanismTarget: null,
  firstInClass: false,
  sponsorName: "TestCo",
  indicationName: "Melanoma",
  therapeuticArea: "oncology",
  diseaseOntologyId: null,
  nctId: "NCT99990001",
  applicationNumber: "BLA999999",
  applicationType: "BLA",
  programStatus: "crl",
  biomarkerEnriched: true,
  primaryEndpointMet: true,
  primaryEndpointFamily: "ORR",
  primaryResultPublicAt: "2024-01-01T00:00:00.000Z",
  primaryResultSourceUrl: "fixture://test",
  primaryResultPassage: "ORR met",
  regulatoryActionDate: "2024-06-01T00:00:00.000Z",
  regulatoryActionType: "crl",
  calibrationCaseId: "test_crl",
  trialOps: {
    phase: "III",
    title: "Testimab Phase III",
    status: "completed",
    plannedEnrollment: 200,
    actualEnrollment: 190,
    masking: "open",
    allocation: "randomized",
  },
  designations: [
    {
      designationType: "breakthrough",
      grantedAt: "2023-01-01T00:00:00.000Z",
      sourceUrl: "fixture://des",
    },
  ],
  fallbackCompetitors: ["Pembrolizumab"],
  polymarketMarketIds: [],
  notes: "unit test",
};

describe("retrospective clinical KG", () => {
  it("builds holdout-eligible fixture with enrich fields", () => {
    const fixture = buildRetrospectiveProgramFixture({ seed: sampleSeed });
    expect(fixture.program.status).toBe("crl");
    expect(fixture.regulatoryAction?.actionType).toBe("crl");
    expect(fixture.trialResults[0]?.primaryEndpointMet).toBe(true);

    const holdout = holdoutCaseFromProgram(fixture);
    expect(holdout).not.toBeNull();
    expect(holdout!.resolvedApproved).toBe(false);
    expect(holdout!.biomarkerEnriched).toBe(true);
    expect(holdout!.designationCount).toBeGreaterThan(0);
    expect(holdout!.primaryEndpointMet).toBe(true);
    expect(holdout!.forecastCutoff < sampleSeed.regulatoryActionDate!).toBe(true);
  });

  it("maps calibration case id from seed", () => {
    const fixture = buildRetrospectiveProgramFixture({ seed: sampleSeed });
    const row = clinicalCalibrationCaseFromProgram(fixture, {
      calibrationCaseId: "test_crl",
      dataProvenance: "kg_retrospective_trial",
    });
    expect(row?.caseId).toBe("test_crl");
    expect(row?.dataProvenance).toBe("kg_retrospective_trial");
  });

  it("merges curated regulatory clock into application fields", () => {
    const fixture = buildRetrospectiveProgramFixture({
      seed: sampleSeed,
      regulatoryClock: {
        filedAt: "2024-03-01T00:00:00.000Z",
        acceptedAt: "2024-04-01T00:00:00.000Z",
        pdufaDate: "2024-06-01T00:00:00.000Z",
        reviewProgram: "priority",
        clockSourceUrl: "fixture://clock",
        clockFirstPublicAt: "2024-03-01T00:00:00.000Z",
        clockPassage: "Curated filing milestone for unit test.",
      },
    });
    expect(fixture.application?.filedAt).toBe("2024-03-01T00:00:00.000Z");
    expect(fixture.application?.acceptedAt).toBe("2024-04-01T00:00:00.000Z");
    expect(fixture.application?.pdufaDate).toBe("2024-06-01T00:00:00.000Z");
    expect(fixture.application?.reviewProgram).toBe("priority");
  });
});
