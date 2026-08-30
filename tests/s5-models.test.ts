import { describe, expect, it } from "vitest";

import {
  compileQueryPlan,
  InMemoryKnowledgeGraphRepository,
  loadGraphFromProgramFixtures,
} from "@pivotaledge/kg";
import {
  buildForecast,
  evaluateChronologicalHoldout,
  lookupBaseRate,
  predictBaseRateOnly,
  predictHoldoutCase,
} from "@pivotaledge/models";
import {
  ForecastSchema,
  loadHoldoutCorpus,
  loadMarketFixture,
  loadProgramFixture,
} from "@pivotaledge/schemas";

describe("S5: base-rate lookup", () => {
  it("returns phase × therapeutic-area prior", () => {
    const row = lookupBaseRate("III", "oncology");
    expect(row.approvalRate).toBeGreaterThan(0);
    expect(row.approvalRate).toBeLessThan(1);
    expect(row.matched).toBe(true);
  });

  it("falls back when therapeutic area unknown", () => {
    const row = lookupBaseRate("III", "dermatology");
    expect(row.matched).toBe(false);
    expect(row.approvalRate).toBeGreaterThan(0);
  });
});

describe("S5: forecast from precedent bundle", () => {
  it("produces valid Forecast with components and intervals for approval-by-date market", async () => {
    const approved = await loadProgramFixture("approved/synalphimab-nsclc.json");
    const crl = await loadProgramFixture("crl/synbetalib-ra.json");
    const market = await loadMarketFixture("market-cases/synalphimab-approval-by-date.json");

    const graph = loadGraphFromProgramFixtures([approved, crl]);
    const repo = new InMemoryKnowledgeGraphRepository(graph);
    const cutoff = "2024-06-01T00:00:00.000Z";

    const plan = compileQueryPlan(market.marketQuestion, {
      forecastCutoff: cutoff,
      therapeuticArea: "oncology",
    });
    const bundle = repo.executePlan(plan);

    const forecast = buildForecast({
      marketQuestion: market.marketQuestion,
      precedentBundle: bundle,
      forecastCutoff: cutoff,
      forecastId: "fc_test_synalpha",
    });

    expect(ForecastSchema.safeParse(forecast).success).toBe(true);
    expect(forecast.modelVersion).toBe("base-rate-calibrated@3");
    expect(forecast.components.length).toBeGreaterThanOrEqual(4);
    expect(forecast.intervalLow).toBeLessThanOrEqual(forecast.modelProbability + 1e-12);
    expect(forecast.intervalHigh + 1e-12).toBeGreaterThanOrEqual(forecast.modelProbability);
    expect(forecast.conservativeProbability).toBe(forecast.intervalLow);
    // Already approved program → terminal probability 1
    expect(forecast.modelProbability).toBe(1);
  });
});

describe("S5: chronological holdout gate", () => {
  it("calibrated model beats base-rate-only Brier on synthetic corpus", async () => {
    const corpus = await loadHoldoutCorpus();
    const evaluation = evaluateChronologicalHoldout(corpus, { minTrainCases: 4 });

    expect(evaluation.testSize).toBeGreaterThan(0);
    expect(evaluation.calibratedBrier).toBeLessThan(evaluation.baseRateBrier);
    expect(evaluation.beatsBaseRate).toBe(true);
  });

  it("feature adjustments separate filing/endpoint signal from base rate alone", () => {
    const filed = predictHoldoutCase({
      phase: "III",
      therapeuticArea: "oncology",
      primaryEndpointMet: true,
      applicationFiled: true,
    });
    const baseOnly = predictBaseRateOnly({
      phase: "III",
      therapeuticArea: "oncology",
      primaryEndpointMet: true,
      applicationFiled: true,
    });
    expect(filed).toBeGreaterThan(baseOnly);
  });
});
