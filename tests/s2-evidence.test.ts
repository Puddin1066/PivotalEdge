import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  DocumentVault,
  ingestProgramEvidence,
  normalizeCtStudy,
  normalizeDrugsFdaResult,
} from "@pivotaledge/adapters";

const MOCK_STUDY = {
  protocolSection: {
    identificationModule: { nctId: "NCT01295827", officialTitle: "KEYNOTE-001" },
    statusModule: {
      overallStatus: "COMPLETED",
      startDateStruct: { date: "2011-12-01" },
      completionDateStruct: { date: "2014-06-01" },
    },
    descriptionModule: { briefTitle: "Pembrolizumab study" },
    conditionsModule: { conditions: ["Melanoma"] },
    armsInterventionsModule: {
      interventions: [{ name: "Pembrolizumab" }],
    },
    sponsorCollaboratorsModule: {
      leadSponsor: { name: "Merck Sharp & Dohme LLC" },
    },
    designModule: { phases: ["PHASE1"] },
  },
};

const MOCK_FDA = {
  application_number: "BLA125514",
  sponsor_name: "MERCK SHARP DOHME",
  openfda: { brand_name: ["KEYTRUDA"], generic_name: ["PEMBROLIZUMAB"] },
  products: [{ brand_name: "KEYTRUDA", dosage_form: "INJECTION", route: "INTRAVENOUS" }],
  submissions: [
    { submission_type: "ORIG", submission_status: "AP", submission_status_date: "20140904" },
  ],
};

let tmpDir: string;

afterEach(async () => {
  if (tmpDir) await rm(tmpDir, { recursive: true, force: true });
});

describe("S2: document vault", () => {
  it("dedupes by checksum", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "pe-vault-"));
    const vault = new DocumentVault(tmpDir);
    const e1 = await vault.store({
      sourceSystem: "test",
      sourceUrl: "fixture://a",
      payload: { x: 1 },
    });
    const e2 = await vault.store({
      sourceSystem: "test",
      sourceUrl: "fixture://b",
      payload: { x: 1 },
    });
    expect(e1.checksum).toBe(e2.checksum);
    const manifest = await vault.loadManifest();
    expect(manifest.entries).toHaveLength(1);
  });
});

describe("S2: adapters normalize", () => {
  it("normalizes CT.gov study", () => {
    const s = normalizeCtStudy(MOCK_STUDY);
    expect(s?.nctId).toBe("NCT01295827");
    expect(s?.interventions).toContain("Pembrolizumab");
  });

  it("normalizes openFDA drugsfda result", () => {
    const a = normalizeDrugsFdaResult(MOCK_FDA);
    expect(a?.applicationNumber).toBe("BLA125514");
    expect(a?.approvalDate).toBe("2014-09-04");
  });
});

describe("S2: ingest with cutoff", () => {
  it("stores vault entries and respects forecast cutoff", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "pe-vault-"));
    const vault = new DocumentVault(tmpDir);

    const fetchImpl = async (input: RequestInfo | URL): Promise<Response> => {
      const url = String(input);
      if (url.includes("clinicaltrials.gov")) {
        return new Response(JSON.stringify(MOCK_STUDY), { status: 200 });
      }
      if (url.includes("api.fda.gov")) {
        return new Response(JSON.stringify({ results: [MOCK_FDA] }), { status: 200 });
      }
      return new Response("not found", { status: 404 });
    };

    const bundle = await ingestProgramEvidence({
      nctIds: ["NCT01295827"],
      applicationNumber: "BLA125514",
      forecastCutoff: "2020-01-01T00:00:00.000Z",
      vault,
      fetchImpl,
    });

    expect(bundle.studies).toHaveLength(1);
    expect(bundle.fdaApplications).toHaveLength(1);
    expect(bundle.vaultEntryIds.length).toBeGreaterThanOrEqual(2);

    const postCutoff = await ingestProgramEvidence({
      nctIds: ["NCT01295827"],
      applicationNumber: "BLA125514",
      forecastCutoff: "2010-01-01T00:00:00.000Z",
      vault,
      fetchImpl,
    });
    expect(postCutoff.studies).toHaveLength(0);
    expect(postCutoff.excludedAfterCutoff.length).toBeGreaterThan(0);
  });
});
