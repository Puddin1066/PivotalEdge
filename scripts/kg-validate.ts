#!/usr/bin/env tsx
/**
 * Validate local clinical KG fixtures against ProgramFixture schema and
 * print Wave 1–4 feature coverage (not live APIs).
 */
import { readdir } from "node:fs/promises";
import path from "node:path";

import { loadGraphFromProgramFixtures } from "@pivotaledge/kg";
import {
  defaultFixturesRoot,
  loadProgramFixture,
  ProgramFixtureSchema,
} from "@pivotaledge/schemas";

const PROGRAM_GLOBS = [
  { dir: "approved", label: "approved" },
  { dir: "crl", label: "crl" },
  { dir: "corpus", label: "corpus" },
  { dir: "corpus/live", label: "corpus/live" },
  { dir: "corpus/retrospective", label: "corpus/retrospective" },
];

async function loadAllPrograms() {
  const root = defaultFixturesRoot();
  const fixtures = [];
  for (const g of PROGRAM_GLOBS) {
    const dir = path.join(root, g.dir);
    let files: string[] = [];
    try {
      files = (await readdir(dir)).filter((f) => f.endsWith(".json")).sort();
    } catch {
      continue;
    }
    for (const f of files) {
      const fixture = await loadProgramFixture(`${g.dir}/${f}`, root);
      ProgramFixtureSchema.parse(fixture);
      fixtures.push({ path: `${g.dir}/${f}`, fixture });
    }
  }
  return fixtures;
}

async function main() {
  const loaded = await loadAllPrograms();
  const graph = loadGraphFromProgramFixtures(loaded.map((l) => l.fixture));
  const cutoff = new Date().toISOString();

  const rows = graph.listPrograms().map((p) => {
    const snap = graph.clinicalFeaturesAtCutoff(p, cutoff);
    return {
      programId: snap.programId,
      drug: p.drug.preferredName,
      phase: snap.phase,
      ta: snap.therapeuticArea,
      endpointFamily: snap.endpointFamily,
      primaryEndpointMet: snap.primaryEndpointMet,
      trialStatus: snap.trialStatus,
      enrollment: snap.actualEnrollment,
      biomarkerEnriched: snap.biomarkerEnriched,
      designations: snap.designationTypes,
      approvedTherapyCount: snap.approvedTherapyCount,
      priorApprovalCount: snap.priorApprovalCount,
      endpoints: p.endpoints.length,
      mechanisms: p.mechanisms.length,
    };
  });

  console.log(
    JSON.stringify(
      {
        kind: "local_kg_inventory",
        programCount: rows.length,
        storage: "fixtures/json (in-memory KG)",
        cutoff,
        programs: rows,
      },
      null,
      2,
    ),
  );

  const missingOps = rows.filter((r) => r.trialStatus === "unknown" || r.endpoints === 0);
  if (missingOps.length > 0) {
    console.error("KG populate WARN: missing trial ops or endpoints", missingOps);
    process.exit(1);
  }
  console.log(`\nKG validate PASS (${rows.length} programs populated).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
