#!/usr/bin/env tsx
/** S8b gate CLI: clinical chronological calibration (Brier + reliability by stratum, no market PnL). */
import { runClinicalChronoCalibration } from "@pivotaledge/evals";
import { loadClinicalCalibrationCorpus } from "@pivotaledge/schemas";

async function main() {
  const corpus = await loadClinicalCalibrationCorpus();
  const report = runClinicalChronoCalibration(corpus, { minTrainCases: 8 });

  console.log(
    JSON.stringify(
      {
        totalCases: report.totalCases,
        testCases: report.testCases,
        baseRateBrier: report.baseRateBrier,
        calibratedBrier: report.calibratedBrier,
        beatsBaseRate: report.beatsBaseRate,
        weights: report.weights,
        globalReliability: report.globalReliability,
        strata: report.strata.map((s) => ({
          stratumKey: s.stratumKey,
          n: s.n,
          baseRateBrier: s.baseRateBrier,
          calibratedBrier: s.calibratedBrier,
        })),
      },
      null,
      2,
    ),
  );

  if (report.totalCases < 20) {
    console.error("S8b gate FAIL: corpus must have at least 20 cases");
    process.exit(1);
  }
  if (report.testCases < 8) {
    console.error("S8b gate FAIL: need at least 8 out-of-sample test cases");
    process.exit(1);
  }
  if (!report.beatsBaseRate) {
    console.error("S8b gate FAIL: calibrated Brier did not beat base-rate-only");
    process.exit(1);
  }

  console.log("\nS8b gate PASS (clinical calibration beats base-rate Brier on FDA corpus).");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
