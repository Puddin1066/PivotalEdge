import { describe, expect, it } from "vitest";

import { loadGraphFromProgramFixtures } from "@pivotaledge/kg";
import { DesignationSchema, loadProgramFixture, ProgramFixtureSchema } from "@pivotaledge/schemas";

describe("KG schema populate (local fixtures)", () => {
  it("loads enriched Synalphimab program with designations and competition", async () => {
    const fixture = await loadProgramFixture("approved/synalphimab-nsclc.json");
    expect(ProgramFixtureSchema.safeParse(fixture).success).toBe(true);
    expect(fixture.trials[0]?.status).toBe("completed");
    expect(fixture.trials[0]?.biomarkerEnriched).toBe(true);
    expect(fixture.endpoints[0]?.endpointFamily).toBe("OS");
    expect(fixture.designations.length).toBeGreaterThanOrEqual(1);
    expect(DesignationSchema.safeParse(fixture.designations[0]!).success).toBe(true);
    expect(fixture.approvedTherapiesInIndication.length).toBeGreaterThanOrEqual(1);
    expect(fixture.priorApprovals.length).toBeGreaterThanOrEqual(1);
  });

  it("exposes clinical feature snapshot at cutoff from in-memory KG", async () => {
    const approved = await loadProgramFixture("approved/synalphimab-nsclc.json");
    const crl = await loadProgramFixture("crl/synbetalib-ra.json");
    const graph = loadGraphFromProgramFixtures([approved, crl]);
    const prog = graph.getProgram("prog_syn_alpha_nsclc")!;
    const snap = graph.clinicalFeaturesAtCutoff(prog, "2024-06-01T00:00:00.000Z");

    expect(snap.phase).toBe("III");
    expect(snap.therapeuticArea).toBe("oncology");
    expect(snap.primaryEndpointMet).toBe(true);
    expect(snap.endpointFamily).toBe("OS");
    expect(snap.applicationFiled).toBe(true);
    expect(snap.biomarkerEnriched).toBe(true);
    expect(snap.orphanDesignated).toBe(false);
    expect(snap.designationTypes).toContain("breakthrough");
    expect(snap.approvedTherapyCount).toBeGreaterThanOrEqual(1);
    expect(snap.priorApprovalCount).toBeGreaterThanOrEqual(1);
  });

  it("loads all corpus programs with Wave 1–3 fields", async () => {
    const paths = [
      "corpus/oncolix-her2.json",
      "corpus/cardionex-hf.json",
      "corpus/neurovex-alz.json",
      "corpus/rarezyme-lsd.json",
    ];
    for (const p of paths) {
      const fixture = await loadProgramFixture(p);
      expect(ProgramFixtureSchema.safeParse(fixture).success).toBe(true);
      expect(fixture.trials[0]?.status).not.toBe("unknown");
      expect(fixture.endpoints.length).toBeGreaterThan(0);
    }
    const rare = await loadProgramFixture("corpus/rarezyme-lsd.json");
    expect(rare.designations.some((d) => d.designationType === "orphan")).toBe(true);
  });
});
