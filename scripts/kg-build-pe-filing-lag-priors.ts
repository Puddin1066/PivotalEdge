#!/usr/bin/env tsx
/**
 * Measure PE→filing lag spans from local KG fixtures and write calibration priors.
 *
 * Usage: pnpm kg:build-pe-filing-lag-priors
 */
import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { buildPeToFilingLagPriors, loadGraphFromProgramFixtures } from "@pivotaledge/kg";
import { defaultFixturesRoot, loadProgramFixture } from "@pivotaledge/schemas";

async function loadAllProgramFixtures(root: string) {
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
  const root = defaultFixturesRoot();
  const cutoff = process.argv[2] ?? new Date().toISOString();
  const fixtures = await loadAllProgramFixtures(root);
  const graph = loadGraphFromProgramFixtures(fixtures);
  const priors = buildPeToFilingLagPriors(graph, cutoff);

  const outPath = path.join(root, "calibration/pe-to-filing-lag-priors.json");
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, `${JSON.stringify(priors, null, 2)}\n`, "utf8");

  console.log(
    JSON.stringify(
      {
        out: "fixtures/calibration/pe-to-filing-lag-priors.json",
        measuredPrograms: priors.measuredPrograms.length,
        strata: Object.fromEntries(
          Object.entries(priors.strata).map(([k, v]) => [k, { medianDays: v.medianDays, n: v.sampleSize, source: v.source }]),
        ),
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
