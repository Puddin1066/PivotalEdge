#!/usr/bin/env tsx
/**
 * S2 CLI: ingest CT.gov + openFDA evidence into document vault.
 * Usage: pnpm s2:ingest --drug Keytruda --nct NCT01295827 --cutoff 2020-01-01
 */
import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { DocumentVault, ingestProgramEvidence } from "@pivotaledge/adapters";

config();

const args = process.argv.slice(2);
function arg(name: string): string | undefined {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

const drug = arg("--drug");
const nct = arg("--nct");
const app = arg("--app");
const cutoff = arg("--cutoff") ?? "2020-01-01T00:00:00.000Z";

async function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../data/vault");
  const vault = new DocumentVault(root);

  const bundle = await ingestProgramEvidence({
    drugName: drug,
    nctIds: nct ? [nct] : undefined,
    applicationNumber: app,
    forecastCutoff: cutoff,
    vault,
  });

  console.log("Ingested program evidence:");
  console.log(`  cutoff: ${bundle.cutoff}`);
  console.log(
    `  studies: ${bundle.studies.length} (${bundle.studies.map((s) => s.nctId).join(", ")})`,
  );
  console.log(
    `  FDA apps: ${bundle.fdaApplications.length} (${bundle.fdaApplications.map((a) => a.applicationNumber).join(", ")})`,
  );
  console.log(`  vault entries: ${bundle.vaultEntryIds.length}`);
  if (bundle.excludedAfterCutoff.length) {
    console.log(`  excluded (post-cutoff): ${bundle.excludedAfterCutoff.join(", ")}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
