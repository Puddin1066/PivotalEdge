#!/usr/bin/env tsx
/**
 * Populate local clinical KG with retrospective trial programs (approvals + CRLs + failures).
 * Offline by default (seed.trialOps). Optional --fetch refreshes CT.gov study fields.
 * Optional --fetch-fda merges openFDA pdufa/reviewProgram with curated regulatory clocks.
 *
 * Also merges KG-derived enrich features into fixtures/calibration/fda-chrono-corpus.json
 * so S8b validates the same algorithm on trial-history features.
 *
 * Usage:
 *   pnpm kg:ingest-retrospective
 *   pnpm kg:ingest-retrospective --fetch
 *   pnpm kg:ingest-retrospective --fetch-fda
 */
import { config } from "dotenv";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildRetrospectiveProgramFixture,
  extractOrigRegulatoryClock,
  fetchCtStudyByNctId,
  fetchDrugsFdaByApplicationNumber,
  mergeRetrospectiveRegulatoryClock,
  type EnrichSeedProgram,
  type RetrospectiveClockOverlay,
} from "@pivotaledge/adapters";
import {
  clinicalCalibrationCaseFromProgram,
  holdoutCaseFromProgram,
} from "@pivotaledge/evals";
import {
  ClinicalCalibrationCorpusSchema,
  ProgramFixtureSchema,
  defaultFixturesRoot,
  loadJsonFixture,
} from "@pivotaledge/schemas";

config();

type SeedFile = {
  kind: string;
  description?: string;
  programs: EnrichSeedProgram[];
};

async function loadClockOverlay(fixturesRoot: string): Promise<RetrospectiveClockOverlay["clocks"]> {
  const overlayPath = path.join(fixturesRoot, "enrichment/retrospective-regulatory-clocks.json");
  try {
    const raw = JSON.parse(await readFile(overlayPath, "utf8")) as RetrospectiveClockOverlay;
    return raw.clocks ?? {};
  } catch {
    return {};
  }
}

async function main() {
  const fetchLive = process.argv.includes("--fetch");
  const fetchFda = process.argv.includes("--fetch-fda");
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const fixturesRoot = defaultFixturesRoot();
  const seedPath = path.join(fixturesRoot, "enrichment/retrospective-seeds.json");
  const outDir = path.join(fixturesRoot, "corpus/retrospective");
  await mkdir(outDir, { recursive: true });

  const seedFile = JSON.parse(await readFile(seedPath, "utf8")) as SeedFile;
  const clockOverlay = await loadClockOverlay(fixturesRoot);
  const written: {
    slug: string;
    path: string;
    holdoutOk: boolean;
    hasRegulatoryClock: boolean;
  }[] = [];
  const kgCalibrationCases = [];

  for (const seed of seedFile.programs) {
    console.log(`\nRetrospective ${seed.slug} (${seed.nctId})…`);
    let study = null;
    if (fetchLive) {
      study = await fetchCtStudyByNctId(seed.nctId);
      if (!study) {
        console.warn(`  CT.gov miss — falling back to trialOps`);
      }
    }

    let fdaExtract = null;
    if (fetchFda && seed.applicationNumber) {
      try {
        const fda = await fetchDrugsFdaByApplicationNumber(seed.applicationNumber);
        if (fda) {
          fdaExtract = extractOrigRegulatoryClock(fda);
          console.log(
            `  openFDA ${seed.applicationNumber}: pdufa=${fdaExtract.pdufaDate?.slice(0, 10) ?? "—"} review=${fdaExtract.reviewProgram}`,
          );
        }
      } catch (err) {
        console.warn(`  openFDA miss for ${seed.applicationNumber}: ${String(err)}`);
      }
    }

    const regulatoryClock = mergeRetrospectiveRegulatoryClock({
      seed,
      overlay: clockOverlay[seed.slug] ?? null,
      fda: fdaExtract,
    });

    const fixture = buildRetrospectiveProgramFixture({
      seed,
      study,
      regulatoryClock,
    });
    ProgramFixtureSchema.parse(fixture);

    const outPath = path.join(outDir, `${seed.slug}.json`);
    await writeFile(outPath, `${JSON.stringify(fixture, null, 2)}\n`, "utf8");

    const holdout = holdoutCaseFromProgram(fixture);
    const calib = clinicalCalibrationCaseFromProgram(fixture, {
      calibrationCaseId: seed.calibrationCaseId ?? undefined,
      dataProvenance: "kg_retrospective_trial",
    });
    if (calib) kgCalibrationCases.push(calib);

    const hasRegulatoryClock = Boolean(
      fixture.application?.filedAt ||
        fixture.application?.acceptedAt ||
        fixture.application?.pdufaDate ||
        fixture.application?.expectedFilingAt,
    );

    written.push({
      slug: seed.slug,
      path: `corpus/retrospective/${seed.slug}.json`,
      holdoutOk: holdout != null,
      hasRegulatoryClock,
    });
    console.log(
      `  wrote ${outPath} · status=${fixture.program.status} · holdout=${holdout ? "yes" : "NO"} · clock=${hasRegulatoryClock ? "yes" : "no"}`,
    );
  }

  // Merge into S8b clinical corpus: KG enrich rows override matching caseIds; append new kg_* cases.
  const manifest = await loadJsonFixture(
    path.join(fixturesRoot, "calibration/fda-application-manifest.json"),
    ClinicalCalibrationCorpusSchema.omit({ kind: true }),
  );

  const byId = new Map(manifest.cases.map((c) => [c.caseId, { ...c }]));
  for (const row of kgCalibrationCases) {
    const existing = byId.get(row.caseId);
    if (existing) {
      byId.set(row.caseId, {
        ...existing,
        ...row,
        applicationNumber: row.applicationNumber ?? existing.applicationNumber,
        brandName: row.brandName ?? existing.brandName,
        sponsorName: row.sponsorName ?? existing.sponsorName,
        dataProvenance: "kg_retrospective_trial",
      });
    } else {
      byId.set(row.caseId, row);
    }
  }

  const merged = ClinicalCalibrationCorpusSchema.parse({
    kind: "clinical_calibration_corpus",
    description:
      "FDA chrono calibration corpus merged with KG retrospective trial features (biomarker, orphan, designations, enrollment).",
    dataSource: "curated_public_drugsfda+kg_retrospective",
    cases: [...byId.values()].sort(
      (a, b) =>
        a.forecastCutoff.localeCompare(b.forecastCutoff) || a.caseId.localeCompare(b.caseId),
    ),
  });

  const corpusOut = path.join(root, "fixtures/calibration/fda-chrono-corpus.json");
  await writeFile(corpusOut, `${JSON.stringify(merged, null, 2)}\n`, "utf8");

  const runMeta = {
    at: new Date().toISOString(),
    fetchLive,
    fetchFda,
    programsWritten: written.length,
    holdoutEligible: written.filter((w) => w.holdoutOk).length,
    withRegulatoryClock: written.filter((w) => w.hasRegulatoryClock).length,
    calibrationCases: merged.cases.length,
    kgEnrichedCases: kgCalibrationCases.length,
    files: written,
  };
  await writeFile(
    path.join(fixturesRoot, "enrichment/last-retrospective-ingest.json"),
    `${JSON.stringify(runMeta, null, 2)}\n`,
    "utf8",
  );

  console.log(
    `\nDone: ${written.length} KG fixtures · ${written.filter((w) => w.holdoutOk).length} holdout-eligible · ${written.filter((w) => w.hasRegulatoryClock).length} with regulatory clock · calibration n=${merged.cases.length}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
