#!/usr/bin/env tsx
/**
 * Backfill contractCoverage on last-enrich-run.json from local corpus fixtures
 * (no CT.gov / network). Run after seed or fixture updates.
 *
 * Usage: pnpm kg:backfill-enrich-contract
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { eventTypesFromSeed, worstContractCoverageForSeed } from "@pivotaledge/kg";
import { defaultFixturesRoot, loadProgramFixture } from "@pivotaledge/schemas";

type SeedRow = {
  slug: string;
  marketEventTypes?: Record<string, string>;
};

type Manifest = {
  kind: string;
  at: string;
  programs: Array<Record<string, unknown> & { slug: string; path?: string }>;
};

async function main() {
  const root = defaultFixturesRoot();
  const manifestPath = path.join(root, "enrichment/last-enrich-run.json");
  const seedRaw = JSON.parse(
    await readFile(path.join(root, "enrichment/seed-programs.json"), "utf8"),
  ) as { programs: SeedRow[] };
  const seedBySlug = new Map(seedRaw.programs.map((s) => [s.slug, s]));

  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Manifest;
  let updated = 0;

  for (const row of manifest.programs) {
    const seed = seedBySlug.get(row.slug);
    if (!seed) continue;
    const relPath = row.path?.replace(/^corpus\//, "corpus/") ?? `corpus/live/${row.slug}.json`;
    const fixture = await loadProgramFixture(relPath, root);
    const coverage = worstContractCoverageForSeed(fixture, eventTypesFromSeed(seed));
    if (row.contractCoverage !== coverage) {
      row.contractCoverage = coverage;
      updated += 1;
    }
  }

  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(
    JSON.stringify(
      {
        manifest: "fixtures/enrichment/last-enrich-run.json",
        programs: manifest.programs.length,
        updated,
        contractCoverage: manifest.programs.map((p) => ({
          slug: p.slug,
          contractCoverage: p.contractCoverage,
        })),
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
