import { describe, expect, it } from "vitest";

import { buildReliabilityBins, runClinicalChronoCalibration } from "@pivotaledge/evals";
import {
  ClinicalCalibrationReportSchema,
  loadClinicalCalibrationCorpus,
} from "@pivotaledge/schemas";

describe("S8b: reliability bins", () => {
  it("groups predictions into equal-width bins", () => {
    const preds = [0.05, 0.15, 0.55, 0.65, 0.95];
    const outcomes: (0 | 1)[] = [0, 0, 1, 1, 1];
    const bins = buildReliabilityBins(preds, outcomes, 10);
    expect(bins.length).toBeGreaterThan(0);
    expect(bins.every((b) => b.count > 0)).toBe(true);
    expect(bins.every((b) => b.binHigh > b.binLow)).toBe(true);
  });
});

describe("S8b: clinical chronological calibration", () => {
  it("loads FDA corpus with at least 20 curated programs", async () => {
    const corpus = await loadClinicalCalibrationCorpus();
    expect(corpus.kind).toBe("clinical_calibration_corpus");
    expect(corpus.cases.length).toBeGreaterThanOrEqual(20);
    expect(corpus.dataSource).toMatch(/curated_public_drugsfda/);
  });

  it("produces valid report with stratum breakdown", async () => {
    const corpus = await loadClinicalCalibrationCorpus();
    const report = runClinicalChronoCalibration(corpus, { minTrainCases: 8 });

    expect(ClinicalCalibrationReportSchema.safeParse(report).success).toBe(true);
    expect(report.testCases).toBeGreaterThanOrEqual(8);
    expect(report.strata.length).toBeGreaterThan(0);
    expect(report.globalReliability.length).toBeGreaterThan(0);

    const phaseStrata = report.strata.filter((s) => s.dimension === "phase");
    expect(phaseStrata.some((s) => s.stratumKey.includes("III"))).toBe(true);
  });

  it("passes S8b gate: calibrated Brier beats base-rate-only on FDA corpus", async () => {
    const corpus = await loadClinicalCalibrationCorpus();
    const report = runClinicalChronoCalibration(corpus, { minTrainCases: 8 });

    expect(report.calibratedBrier).toBeLessThan(report.baseRateBrier);
    expect(report.beatsBaseRate).toBe(true);
  });
});
