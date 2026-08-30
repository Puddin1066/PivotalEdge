import type { CtStudySummary } from "../clinicaltrials/client.js";
import { fetchCtStudyByNctId, searchCtStudies } from "../clinicaltrials/client.js";
import type { FdaApplicationSummary } from "../openfda/drugsfda.js";
import { fetchDrugsFdaByApplicationNumber, searchDrugsFda } from "../openfda/drugsfda.js";
import { DocumentVault } from "../vault/store.js";
import { isAvailableAtCutoff } from "@pivotaledge/schemas";

export type ProgramEvidenceBundle = {
  nctIds: string[];
  studies: CtStudySummary[];
  fdaApplications: FdaApplicationSummary[];
  vaultEntryIds: string[];
  cutoff: string;
  excludedAfterCutoff: string[];
};

export type IngestProgramOptions = {
  nctIds?: string[];
  drugName?: string;
  applicationNumber?: string;
  forecastCutoff: string;
  vault: DocumentVault;
  fetchImpl?: typeof fetch;
};

/**
 * Ingest CT.gov + openFDA (Drugs@FDA-derived) evidence into the vault and
 * return only records valid as-of forecastCutoff.
 */
export async function ingestProgramEvidence(
  options: IngestProgramOptions,
): Promise<ProgramEvidenceBundle> {
  const studies: CtStudySummary[] = [];
  const fdaApplications: FdaApplicationSummary[] = [];
  const vaultEntryIds: string[] = [];
  const excludedAfterCutoff: string[] = [];
  const nctIds = new Set(options.nctIds ?? []);

  const fetchOpts = { fetchImpl: options.fetchImpl };

  if (options.drugName && nctIds.size === 0) {
    const found = await searchCtStudies(options.drugName, { pageSize: 3, ...fetchOpts });
    for (const s of found) nctIds.add(s.nctId);
  }

  for (const nctId of nctIds) {
    const study = await fetchCtStudyByNctId(nctId, fetchOpts);
    if (!study) continue;
    const entry = await options.vault.store({
      sourceSystem: "clinicaltrials.gov",
      sourceUrl: `https://clinicaltrials.gov/study/${nctId}`,
      payload: study.raw,
      firstPublicAt: study.startDate ? `${study.startDate}T00:00:00.000Z` : null,
    });
    vaultEntryIds.push(entry.id);
    if (entry.firstPublicAt && !isAvailableAtCutoff(entry.firstPublicAt, options.forecastCutoff)) {
      excludedAfterCutoff.push(`study:${nctId}`);
      continue;
    }
    studies.push(study);
  }

  if (options.applicationNumber) {
    const app = await fetchDrugsFdaByApplicationNumber(options.applicationNumber, fetchOpts);
    if (app) {
      const firstPublic = app.approvalDate ? `${app.approvalDate}T00:00:00.000Z` : null;
      const entry = await options.vault.store({
        sourceSystem: "openfda.drugsfda",
        sourceUrl: `https://api.fda.gov/drug/drugsfda.json?search=application_number:"${app.applicationNumber}"`,
        payload: app.raw,
        firstPublicAt: firstPublic,
      });
      vaultEntryIds.push(entry.id);
      if (firstPublic && !isAvailableAtCutoff(firstPublic, options.forecastCutoff)) {
        excludedAfterCutoff.push(`fda:${app.applicationNumber}`);
      } else {
        fdaApplications.push(app);
      }
    }
  } else if (options.drugName) {
    const apps = await searchDrugsFda(`products.brand_name:"${options.drugName}"`, {
      limit: 2,
      ...fetchOpts,
    });
    for (const app of apps) {
      const firstPublic = app.approvalDate ? `${app.approvalDate}T00:00:00.000Z` : null;
      const entry = await options.vault.store({
        sourceSystem: "openfda.drugsfda",
        sourceUrl: `https://api.fda.gov/drug/drugsfda.json?search=products.brand_name:"${options.drugName}"`,
        payload: app.raw,
        firstPublicAt: firstPublic,
      });
      vaultEntryIds.push(entry.id);
      if (firstPublic && !isAvailableAtCutoff(firstPublic, options.forecastCutoff)) {
        excludedAfterCutoff.push(`fda:${app.applicationNumber}`);
      } else {
        fdaApplications.push(app);
      }
    }
  }

  return {
    nctIds: [...nctIds],
    studies,
    fdaApplications,
    vaultEntryIds,
    cutoff: options.forecastCutoff,
    excludedAfterCutoff,
  };
}
