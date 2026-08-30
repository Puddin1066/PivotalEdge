import { describe, expect, it } from "vitest";

import {
  loadMarketFixture,
  loadProgramFixture,
  PrecedentBundleSchema,
  isAvailableAtCutoff,
} from "@pivotaledge/schemas";
import {
  compileQueryPlan,
  executeQueryPlan,
  InMemoryKnowledgeGraphRepository,
  loadGraphFromProgramFixtures,
  validateQueryPlan,
} from "@pivotaledge/kg";

describe("S4: query plan compilation", () => {
  it("compiles MarketQuestion to validated KnowledgeGraphQueryPlan", async () => {
    const market = await loadMarketFixture("market-cases/synalphimab-approval-by-date.json");
    const plan = compileQueryPlan(market.marketQuestion, {
      forecastCutoff: "2024-06-01T00:00:00.000Z",
      therapeuticArea: "oncology",
    });
    expect(validateQueryPlan(plan)).toHaveLength(0);
    expect(plan.analogueCohorts.length).toBeGreaterThan(0);
    expect(plan.negativeControlQueries.length).toBeGreaterThan(0);
  });
});

describe("S4: precedent bundle gate", () => {
  it("market → plan → PrecedentBundle with zero leakage at valid cutoff", async () => {
    const approved = await loadProgramFixture("approved/synalphimab-nsclc.json");
    const crl = await loadProgramFixture("crl/synbetalib-ra.json");
    const analogue = await loadProgramFixture("corpus/retrospective/nivolumab-nsclc.json");
    const market = await loadMarketFixture("market-cases/synalphimab-approval-by-date.json");

    const graph = loadGraphFromProgramFixtures([approved, crl, analogue]);
    const repo = new InMemoryKnowledgeGraphRepository(graph);

    const cutoff = "2024-06-01T00:00:00.000Z";
    const plan = compileQueryPlan(market.marketQuestion, {
      forecastCutoff: cutoff,
      therapeuticArea: "oncology",
    });
    const bundle = repo.executePlan(plan);

    expect(PrecedentBundleSchema.safeParse(bundle).success).toBe(true);
    expect(bundle.currentProgram?.drugName).toBe("Synalphimab");
    expect(bundle.cutoffCompliance.leakageDetected).toBe(false);
    expect(bundle.cohorts.length).toBeGreaterThan(0);

    for (const id of bundle.supportingEvidenceIds) {
      const result = approved.trialResults.find((r) => r.id === id);
      const action = approved.regulatoryAction?.id === id ? approved.regulatoryAction : null;
      const doc = approved.documents.find((d) => d.id === id);
      const designation = approved.designations.find((d) => d.id === id);
      const fp =
        result?.provenance.firstPublicAt ??
        action?.provenance.firstPublicAt ??
        doc?.provenance.firstPublicAt ??
        designation?.provenance.firstPublicAt ??
        null;
      expect(isAvailableAtCutoff(fp, cutoff)).toBe(true);
    }

    expect(bundle.exactAnalogues.length).toBeGreaterThan(0);
    // CRL program is different therapeutic area; still included as cross-area negative analogue
    expect(bundle.cohorts.some((c) => c.crls > 0 || c.approvals > 0)).toBe(true);
  });

  it("excludes post-cutoff regulatory outcomes from supporting evidence", async () => {
    const approved = await loadProgramFixture("approved/synalphimab-nsclc.json");
    const market = await loadMarketFixture("market-cases/synalphimab-approval-by-date.json");
    const graph = loadGraphFromProgramFixtures([approved]);
    const cutoff = "2022-06-01T00:00:00.000Z";

    const plan = compileQueryPlan(market.marketQuestion, {
      forecastCutoff: cutoff,
      therapeuticArea: "oncology",
    });
    const bundle = executeQueryPlan(plan, { graph });

    expect(bundle.supportingEvidenceIds).not.toContain(approved.regulatoryAction?.id);
    expect(bundle.cutoffCompliance.excludedAssertionIds).toContain(approved.regulatoryAction?.id);
    expect(bundle.cutoffCompliance.leakageDetected).toBe(false);
  });
});
