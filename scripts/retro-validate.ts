#!/usr/bin/env tsx
/**
 * Retrospective Track B gate:
 * 1) Clinical chrono calibration (S8b) — hard
 * 2) Resolved Polymarket FDA markets vs clinical P — hard on Brier, edge informational
 * 3) Synthetic S8 edge smoke — hard
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildRetrospectiveGateReport,
  runChronologicalBacktest,
  runClinicalChronoCalibration,
  runResolvedMarketRetrospective,
} from "@pivotaledge/evals";
import {
  loadBacktestCorpus,
  loadClinicalCalibrationCorpus,
  loadResolvedMarketBacktestCorpus,
} from "@pivotaledge/schemas";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

async function main() {
  const clinicalCorpus = await loadClinicalCalibrationCorpus();
  const resolvedMarkets = await loadResolvedMarketBacktestCorpus();
  const syntheticCorpus = await loadBacktestCorpus();

  const clinical = runClinicalChronoCalibration(clinicalCorpus, { minTrainCases: 8 });
  const resolved = runResolvedMarketRetrospective(clinicalCorpus, resolvedMarkets, {
    minTrainCases: 8,
    askProvenance: "curated_pre_resolution_mid_plus_spread_proxy",
  });
  const synthetic = runChronologicalBacktest(syntheticCorpus);

  const gate = buildRetrospectiveGateReport({ clinical, resolved, synthetic });

  const outDir = path.join(repoRoot, "fixtures/evals");
  const reportPath = path.join(outDir, "retrospective-report.json");
  await writeFile(
    reportPath,
    `${JSON.stringify({ gate, clinical, resolved, synthetic }, null, 2)}\n`,
    "utf8",
  );

  console.log(
    JSON.stringify(
      {
        passed: gate.passed,
        clinical: gate.clinical,
        resolvedMarkets: gate.resolvedMarkets,
        syntheticEdgeSmoke: gate.syntheticEdgeSmoke,
        blockers: gate.blockers,
        reportPath: "fixtures/evals/retrospective-report.json",
      },
      null,
      2,
    ),
  );

  if (!gate.passed) {
    console.error("\nRetro gate FAIL:", gate.blockers.join("; ") || "unknown");
    process.exit(1);
  }
  console.log("\nRetro gate PASS (clinical + resolved-market skill + synthetic edge smoke).");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
