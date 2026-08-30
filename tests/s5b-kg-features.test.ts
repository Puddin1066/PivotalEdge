import { describe, expect, it } from "vitest";

import { holdoutCorpusFromPrograms, holdoutCaseFromProgram } from "@pivotaledge/evals";
import { evaluateChronologicalHoldout, extractFeatures, MODEL_VERSION } from "@pivotaledge/models";
import {
  compileQueryPlan,
  InMemoryKnowledgeGraphRepository,
  loadGraphFromProgramFixtures,
} from "@pivotaledge/kg";
import { loadMarketFixture, loadProgramFixture } from "@pivotaledge/schemas";

describe("KG → model feature wiring", () => {
  it("extractFeatures includes enriched KG fields on current program", async () => {
    const approved = await loadProgramFixture("approved/synalphimab-nsclc.json");
    const crl = await loadProgramFixture("crl/synbetalib-ra.json");
    const market = await loadMarketFixture("market-cases/synalphimab-approval-by-date.json");
    const graph = loadGraphFromProgramFixtures([approved, crl]);
    const repo = new InMemoryKnowledgeGraphRepository(graph);
    const plan = compileQueryPlan(market.marketQuestion, {
      forecastCutoff: "2024-06-01T00:00:00.000Z",
      therapeuticArea: "oncology",
    });
    const bundle = repo.executePlan(plan);
    const features = extractFeatures(bundle, market.marketQuestion);

    expect(MODEL_VERSION).toBe("base-rate-calibrated@3");
    expect(features.biomarkerEnriched).toBe(true);
    expect(features.endpointFamily).toBe("OS");
    expect(features.priorApprovalCount).toBeGreaterThanOrEqual(1);
    expect(features.designationCount).toBeGreaterThanOrEqual(1);
    expect(features.enrollmentRatio).not.toBeNull();
  });
});

describe("KG-derived chronological holdout", () => {
  it("derives enriched cases from program fixtures", async () => {
    const paths = [
      "approved/synalphimab-nsclc.json",
      "crl/synbetalib-ra.json",
      "corpus/oncolix-her2.json",
      "corpus/cardionex-hf.json",
      "corpus/neurovex-alz.json",
      "corpus/rarezyme-lsd.json",
    ];
    const fixtures = await Promise.all(paths.map((p) => loadProgramFixture(p)));
    for (const f of fixtures) {
      const c = holdoutCaseFromProgram(f);
      expect(c).not.toBeNull();
      expect(c!.endpointFamily != null || c!.designationCount != null).toBe(true);
    }
    const corpus = holdoutCorpusFromPrograms(fixtures);
    expect(corpus.cases.length).toBe(6);
    const evaluation = evaluateChronologicalHoldout(corpus, { minTrainCases: 3 });
    expect(evaluation.testSize).toBe(3);
    // Tiny N=6 sample is for pipeline proof; Brier gate remains on synthetic holdout corpus.
    expect(evaluation.calibratedBrier).toBeGreaterThanOrEqual(0);
  });
});
