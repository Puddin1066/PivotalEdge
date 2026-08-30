#!/usr/bin/env tsx
/**
 * S8b corpus builder: merge curated clinical manifest with openFDA approval metadata.
 * Clinical features (endpoint, filing status) remain hand-curated; openFDA validates approval dates.
 *
 * Usage:
 *   pnpm s8b:ingest              # write fixtures/calibration/fda-chrono-corpus.json
 *   pnpm s8b:ingest --verify     # also fetch openFDA and log mismatches (no auto-fix)
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

import { fetchDrugsFdaByApplicationNumber } from "@pivotaledge/adapters";
import {
  ClinicalCalibrationCorpusSchema,
  defaultFixturesRoot,
  loadJsonFixture,
} from "@pivotaledge/schemas";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const ManifestSchema = ClinicalCalibrationCorpusSchema.omit({ kind: true });
type Manifest = z.infer<typeof ManifestSchema>;

async function loadManifest(): Promise<Manifest> {
  return loadJsonFixture(
    path.join(defaultFixturesRoot(), "calibration/fda-application-manifest.json"),
    ManifestSchema,
  );
}

async function main() {
  const verify = process.argv.includes("--verify");
  const manifest = await loadManifest();

  if (verify) {
    let mismatches = 0;
    for (const row of manifest.cases) {
      if (!row.applicationNumber.startsWith("BLA") && !row.applicationNumber.startsWith("NDA")) {
        continue;
      }
      try {
        const summary = await fetchDrugsFdaByApplicationNumber(row.applicationNumber);
        if (!summary) {
          console.warn(`openFDA: no record for ${row.applicationNumber} (${row.caseId})`);
          mismatches++;
          continue;
        }
        const fdaApproved = summary.approvalDate != null;
        if (fdaApproved !== row.resolvedApproved) {
          console.warn(
            `openFDA mismatch ${row.caseId}: corpus resolvedApproved=${row.resolvedApproved} vs FDA has approvalDate=${summary.approvalDate}`,
          );
          mismatches++;
        }
      } catch (err) {
        console.warn(`openFDA fetch failed for ${row.applicationNumber}:`, err);
        mismatches++;
      }
    }
    console.log(`openFDA verify complete: ${mismatches} mismatch(es) / warnings`);
  }

  const corpus = ClinicalCalibrationCorpusSchema.parse({
    kind: "clinical_calibration_corpus",
    description: manifest.description,
    dataSource: manifest.dataSource,
    cases: manifest.cases.map((c) => ({
      ...c,
      dataProvenance: c.dataProvenance ?? "curated_public_drugsfda",
    })),
  });

  const outPath = path.join(repoRoot, "fixtures/calibration/fda-chrono-corpus.json");
  await writeFile(outPath, `${JSON.stringify(corpus, null, 2)}\n`, "utf8");
  console.log(`Wrote ${corpus.cases.length} cases to ${outPath}`);
  console.log(
    "Note: run `pnpm kg:ingest-retrospective` after this to merge KG trial enrich features into the chrono corpus.",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
