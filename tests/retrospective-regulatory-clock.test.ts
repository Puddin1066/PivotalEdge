import { describe, expect, it } from "vitest";

import {
  extractOrigRegulatoryClockFromRaw,
  mergeRetrospectiveRegulatoryClock,
} from "@pivotaledge/adapters";

describe("retrospective regulatory clock merge", () => {
  it("extracts ORIG approval and review priority from openFDA raw", () => {
    const raw = {
      application_number: "BLA125514",
      submissions: [
        {
          submission_type: "ORIG",
          submission_number: "1",
          submission_status: "AP",
          submission_status_date: "20140904",
          review_priority: "PRIORITY",
        },
      ],
    };
    const clock = extractOrigRegulatoryClockFromRaw(raw, "BLA125514");
    expect(clock.pdufaDate).toBe("2014-09-04T00:00:00.000Z");
    expect(clock.reviewProgram).toBe("priority");
  });

  it("prefers curated overlay filedAt over openFDA-only pdufa", () => {
    const merged = mergeRetrospectiveRegulatoryClock({
      seed: {
        slug: "pembrolizumab-melanoma",
        preferredName: "Pembrolizumab",
        modality: null,
        mechanismName: "PD-1",
        mechanismTarget: null,
        firstInClass: false,
        sponsorName: "Merck",
        indicationName: "Melanoma",
        therapeuticArea: "oncology",
        diseaseOntologyId: null,
        nctId: "NCT01295827",
        applicationNumber: "BLA125514",
        applicationType: "BLA",
        programStatus: "approved",
        biomarkerEnriched: true,
        primaryEndpointMet: true,
        primaryEndpointFamily: "OS",
        primaryResultPublicAt: "2014-06-01T00:00:00.000Z",
        primaryResultSourceUrl: "https://clinicaltrials.gov/study/NCT01295827",
        primaryResultPassage: "PE met",
        regulatoryActionDate: "2014-09-04T00:00:00.000Z",
        designations: [],
        fallbackCompetitors: [],
        polymarketMarketIds: [],
      },
      overlay: {
        filedAt: "2014-02-27T00:00:00.000Z",
        acceptedAt: "2014-05-06T00:00:00.000Z",
        clockSourceUrl: "https://www.merck.com/news/",
        clockFirstPublicAt: "2014-02-27T00:00:00.000Z",
        clockPassage: "Rolling BLA final portion submitted Feb 27 2014.",
      },
      fda: {
        applicationNumber: "BLA125514",
        pdufaDate: "2014-09-04T00:00:00.000Z",
        reviewProgram: "priority",
        originalApprovalDate: "2014-09-04T00:00:00.000Z",
        openFdaSourceUrl: "https://api.fda.gov/",
      },
    });
    expect(merged?.filedAt).toBe("2014-02-27T00:00:00.000Z");
    expect(merged?.acceptedAt).toBe("2014-05-06T00:00:00.000Z");
    expect(merged?.pdufaDate).toBe("2014-09-04T00:00:00.000Z");
  });
});
