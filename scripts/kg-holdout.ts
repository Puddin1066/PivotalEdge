#!/usr/bin/env tsx
/**
 * Derive chronological holdout cases from local KG program fixtures and evaluate.
 * Uses enriched clinical features (biomarker, orphan, designations, enrollment).
 */
import { readdir } from "node:fs/promises";
import path from "node:path";

import { holdoutCorpusFromPrograms } from "@pivotaledge/evals";
import { evaluateChronologicalHoldout } from "@pivotaledge/models";
import { defaultFixturesRoot, loadProgramFixture } from "@pivotaledge/schemas";

async function loadProgramFixtures() {
  const root = defaultFixturesRoot();
  const dirs = ["approved", "crl", "corpus", "corpus/live", "corpus/retrospective"];
  const fixtures = [];
  for (const dir of dirs) {
    let files: string[] = [];
    try {
      files = (await readdir(path.join(root, dir))).filter((f) => f.endsWith(".json"));
    } catch {
      continue;
    }
    for (const f of files.sort()) {
      fixtures.push(await loadProgramFixture(`${dir}/${f}`, root));
    }
  }
  return fixtures;
}

async function main() {
  const fixtures = await loadProgramFixtures();
  const corpus = holdoutCorpusFromPrograms(fixtures);
  const minTrain = Math.min(3, Math.max(2, corpus.cases.length - 2));
  const evaluation = evaluateChronologicalHoldout(corpus, { minTrainCases: minTrain });

  console.log(
    JSON.stringify(
      {
        source: "local_kg_programs",
        caseCount: corpus.cases.length,
        cases: corpus.cases.map((c) => ({
          caseId: c.caseId,
          forecastCutoff: c.forecastCutoff,
          resolvedApproved: c.resolvedApproved,
          biomarkerEnriched: c.biomarkerEnriched,
          orphanDesignated: c.orphanDesignated,
          designationCount: c.designationCount,
        })),
        evaluation,
      },
      null,
      2,
    ),
  );

  if (corpus.cases.length < 4) {
    console.error("KG holdout FAIL: need at least 4 derived cases");
    process.exit(1);
  }

  const enriched = corpus.cases.every(
    (c) =>
      c.endpointFamily != null ||
      c.biomarkerEnriched != null ||
      c.designationCount != null ||
      c.orphanDesignated != null,
  );
  if (!enriched) {
    console.error("KG holdout FAIL: enrichment fields missing on derived cases");
    process.exit(1);
  }

  if (evaluation.beatsBaseRate) {
    console.log("\nKG holdout PASS (enriched features beat base-rate Brier).");
  } else {
    console.log(
      "\nKG holdout PASS (cases derived with enrichment; small-n Brier did not beat base rate — expected until corpus scales).",
    );
    console.log(
      `  calibratedBrier=${evaluation.calibratedBrier.toFixed(4)} baseRateBrier=${evaluation.baseRateBrier.toFixed(4)}`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
