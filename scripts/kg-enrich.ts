#!/usr/bin/env tsx
/**
 * Enrich local clinical KG from Polymarket-prioritized seed programs.
 * Sources: CT.gov (required), Open Targets competition (best-effort),
 * Orange Book + retrospective KG competitor approvals, openFDA (best-effort).
 *
 * Usage: pnpm kg:enrich
 */
import { config } from "dotenv";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  DocumentVault,
  buildEnrichedProgramFixture,
  fetchCtStudyByNctId,
  fetchDrugsFdaByApplicationNumber,
  fetchKnownDrugsForDisease,
  resolveCompetitorApprovals,
  resolveOrangeBookCsvPath,
  searchDrugsFdaByDrugName,
  searchOpenTargetsDisease,
  type EnrichSeedProgram,
} from "@pivotaledge/adapters";
import { eventTypesFromSeed, worstContractCoverageForSeed } from "@pivotaledge/kg";
import { ProgramFixtureSchema, defaultFixturesRoot } from "@pivotaledge/schemas";

config();

type SeedFile = {
  kind: string;
  programs: EnrichSeedProgram[];
};

async function resolveOpenFda(seed: EnrichSeedProgram) {
  try {
    if (seed.applicationNumber) {
      return await fetchDrugsFdaByApplicationNumber(seed.applicationNumber);
    }
    if (seed.programStatus === "approved" || seed.applicationType !== "unknown") {
      const names = [seed.preferredName, ...(seed.openFdaSearchNames ?? [])];
      for (const name of names) {
        const hits = await searchDrugsFdaByDrugName(name, { limit: 5 });
        const hit = hits.find((h) => h.approvalDate) ?? hits[0];
        if (hit) return hit;
      }
    }
    return null;
  } catch (err) {
    console.warn(`  openFDA skip (${seed.slug}):`, err instanceof Error ? err.message : err);
    return null;
  }
}

async function resolveCompetitors(seed: EnrichSeedProgram) {
  try {
    let diseaseId = seed.diseaseOntologyId;
    if (!diseaseId) {
      const hits = await searchOpenTargetsDisease(seed.indicationName, { size: 3 });
      diseaseId = hits[0]?.id ?? null;
    }
    if (!diseaseId) {
      return {
        diseaseId: null,
        drugs: [] as Awaited<ReturnType<typeof fetchKnownDrugsForDisease>> extends infer R
          ? NonNullable<R>["drugs"]
          : never[],
      };
    }
    const bundle = await fetchKnownDrugsForDisease(diseaseId, { limit: 10 });
    return { diseaseId: bundle?.diseaseId ?? diseaseId, drugs: bundle?.drugs ?? [] };
  } catch (err) {
    console.warn(`  Open Targets skip (${seed.slug}):`, err instanceof Error ? err.message : err);
    return { diseaseId: seed.diseaseOntologyId, drugs: [] };
  }
}

async function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const fixturesRoot = defaultFixturesRoot();
  const seedPath = path.join(fixturesRoot, "enrichment/seed-programs.json");
  const outDir = path.join(fixturesRoot, "corpus/live");
  const vault = new DocumentVault(path.join(root, "data/vault"));

  const seedFile = JSON.parse(await readFile(seedPath, "utf8")) as SeedFile;
  await mkdir(outDir, { recursive: true });

  const orangeBookCsvPath = await resolveOrangeBookCsvPath();
  if (orangeBookCsvPath) {
    console.log(`Orange Book CSV: ${orangeBookCsvPath}`);
  } else {
    console.warn("Orange Book CSV not found — small-molecule competitor dates rely on retrospective KG");
  }

  const summary: Record<string, unknown>[] = [];

  for (const seed of seedFile.programs) {
    console.log(`\nEnrich ${seed.slug} (${seed.nctId})…`);
    const study = await fetchCtStudyByNctId(seed.nctId);
    if (!study) {
      console.error(`  FAIL: CT.gov miss for ${seed.nctId}`);
      process.exitCode = 1;
      continue;
    }

    await vault.store({
      sourceSystem: "clinicaltrials.gov",
      sourceUrl: `https://clinicaltrials.gov/study/${seed.nctId}`,
      payload: study.raw,
      firstPublicAt: study.startDate ? `${study.startDate}T00:00:00.000Z` : null,
    });

    const ot = await resolveCompetitors(seed);
    if (ot.diseaseId && ot.diseaseId !== seed.diseaseOntologyId) {
      seed.diseaseOntologyId = ot.diseaseId;
    }
    if (ot.drugs.length) {
      await vault.store({
        sourceSystem: "opentargets",
        sourceUrl: `https://platform.opentargets.org/disease/${ot.diseaseId}`,
        payload: { diseaseId: ot.diseaseId, drugs: ot.drugs },
        firstPublicAt: null,
      });
    }

    const otNames = ot.drugs.slice(0, 10).map((c) => c.drugName);
    const competitorNames = [
      ...seed.fallbackCompetitors,
      ...otNames.filter(
        (n) =>
          !seed.fallbackCompetitors.some(
            (f) => f.toLowerCase() === n.toLowerCase(),
          ),
      ),
    ].slice(0, 12);
    const competitorApprovals = await resolveCompetitorApprovals(competitorNames, {
      orangeBookCsvPath,
      fixturesRoot,
    });
    const fromOrangeBook = Object.values(competitorApprovals).filter(
      (h) => h.sourceSystem === "fda.orange_book_local",
    ).length;
    const fromRetrospective = Object.values(competitorApprovals).filter(
      (h) => h.sourceSystem === "kg.retrospective",
    ).length;
    const fromOverrides = Object.values(competitorApprovals).filter(
      (h) => h.sourceSystem === "enrichment_override",
    ).length;

    const fda = await resolveOpenFda(seed);
    if (fda) {
      await vault.store({
        sourceSystem: "openfda.drugsfda",
        sourceUrl: `https://api.fda.gov/drug/drugsfda.json?search=application_number:"${fda.applicationNumber}"`,
        payload: fda.raw,
        firstPublicAt: fda.approvalDate ? `${fda.approvalDate}T12:00:00.000Z` : null,
      });
      if (!seed.applicationNumber) seed.applicationNumber = fda.applicationNumber;
    }

    const fixture = buildEnrichedProgramFixture({
      seed,
      study,
      fda,
      competitors: ot.drugs,
      competitorApprovals,
    });
    ProgramFixtureSchema.parse(fixture);

    const outPath = path.join(outDir, `${seed.slug}.json`);
    await writeFile(outPath, `${JSON.stringify(fixture, null, 2)}\n`, "utf8");

    const row = {
      slug: seed.slug,
      path: `corpus/live/${seed.slug}.json`,
      nctId: study.nctId,
      phase: fixture.trials[0]?.phase,
      trialStatus: fixture.trials[0]?.status,
      enrollment: fixture.trials[0]?.actualEnrollment,
      primaryEndpointMet: fixture.trialResults[0]?.primaryEndpointMet ?? null,
      designations: fixture.designations.map((d) => d.designationType),
      competitors: fixture.approvedTherapiesInIndication.length,
      competitorsWithApprovalDate: fixture.approvedTherapiesInIndication.filter((t) => t.approvedAt)
        .length,
      polymarketMarketIds: seed.polymarketMarketIds,
      openTargetsDiseaseId: ot.diseaseId,
      openTargetsHits: ot.drugs.length,
      orangeBookHits: fromOrangeBook,
      retrospectiveCompetitorHits: fromRetrospective,
      overrideCompetitorHits: fromOverrides,
      fdaApplicationNumber: fda?.applicationNumber ?? seed.applicationNumber ?? null,
      fdaApprovalDate: fda?.approvalDate ?? null,
      trialRegisteredAt: fixture.trials[0]?.registeredAt ?? null,
      trialPrimaryCompletionAt: fixture.trials[0]?.primaryCompletionAt ?? null,
      acceptedAt: fixture.application?.acceptedAt ?? null,
      expectedFilingAt: fixture.application?.expectedFilingAt ?? null,
      reviewProgram: fixture.application?.reviewProgram ?? null,
      contractCoverage: worstContractCoverageForSeed(
        fixture,
        eventTypesFromSeed(seed),
      ),
    };
    summary.push(row);
    console.log(
      `  wrote ${row.path} (competitors=${row.competitors}, dated=${row.competitorsWithApprovalDate}, OB=${fromOrangeBook}, retro=${fromRetrospective}, FDA=${row.fdaApplicationNumber ?? "—"}, status=${row.trialStatus})`,
    );
  }

  const manifestPath = path.join(fixturesRoot, "enrichment/last-enrich-run.json");
  const manifest = { kind: "kg_enrich_run", at: new Date().toISOString(), programs: summary };
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  const historyPath = path.join(fixturesRoot, "enrichment/enrich-history.json");
  let history: { kind: string; runs: typeof manifest[] } = { kind: "kg_enrich_history", runs: [] };
  try {
    history = JSON.parse(await readFile(historyPath, "utf8")) as typeof history;
    if (!Array.isArray(history.runs)) history.runs = [];
  } catch {
    history = { kind: "kg_enrich_history", runs: [] };
  }
  history.runs = [manifest, ...history.runs.filter((r) => r.at !== manifest.at)].slice(0, 50);
  await writeFile(historyPath, `${JSON.stringify(history, null, 2)}\n`);

  console.log(`\nKG enrich done: ${summary.length} programs → fixtures/corpus/live/`);
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
