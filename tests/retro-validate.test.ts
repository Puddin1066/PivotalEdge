import { describe, expect, it } from "vitest";

import {
  buildRetrospectiveGateReport,
  runChronologicalBacktest,
  runClinicalChronoCalibration,
  runResolvedMarketRetrospective,
} from "@pivotaledge/evals";
import {
  ResolvedMarketRetroReportSchema,
  RetrospectiveGateReportSchema,
  loadBacktestCorpus,
  loadClinicalCalibrationCorpus,
  loadResolvedMarketBacktestCorpus,
} from "@pivotaledge/schemas";

describe("Retrospective Track B", () => {
  it("loads resolved Jul-2025 Polymarket corpus", async () => {
    const corpus = await loadResolvedMarketBacktestCorpus();
    expect(corpus.kind).toBe("backtest_chrono_corpus");
    expect(corpus.cases.length).toBeGreaterThanOrEqual(6);
  });

  it("scores resolved markets with clinical train cutoff < market cutoff", async () => {
    const clinical = await loadClinicalCalibrationCorpus();
    const markets = await loadResolvedMarketBacktestCorpus();
    const report = runResolvedMarketRetrospective(clinical, markets, { minTrainCases: 8 });

    expect(ResolvedMarketRetroReportSchema.safeParse(report).success).toBe(true);
    expect(report.scoredCases).toBe(markets.cases.length);
    expect(report.cases.every((c) => c.trainCasesUsed >= 8)).toBe(true);
  });

  it("builds a unified gate report", async () => {
    const clinicalCorpus = await loadClinicalCalibrationCorpus();
    const markets = await loadResolvedMarketBacktestCorpus();
    const syntheticCorpus = await loadBacktestCorpus();

    const clinical = runClinicalChronoCalibration(clinicalCorpus, { minTrainCases: 8 });
    const resolved = runResolvedMarketRetrospective(clinicalCorpus, markets);
    const synthetic = runChronologicalBacktest(syntheticCorpus);
    const gate = buildRetrospectiveGateReport({ clinical, resolved, synthetic });

    expect(RetrospectiveGateReportSchema.safeParse(gate).success).toBe(true);
    expect(gate.clinical.beatsBaseRate).toBe(true);
    expect(gate.resolvedMarkets.edgeInformational).toBe(true);
  });
});
