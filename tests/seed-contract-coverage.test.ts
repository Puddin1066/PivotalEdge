import { describe, expect, it } from "vitest";

import {
  assessProgramContractCoverage,
  worstContractCoverageForSeed,
} from "@pivotaledge/kg";
import { defaultFixturesRoot, loadProgramFixture } from "@pivotaledge/schemas";

describe("seed contract coverage", () => {
  it("approved synalphimab fixture is not contract-blocked", async () => {
    const fixture = await loadProgramFixture("approved/synalphimab-nsclc.json");
    const assessment = assessProgramContractCoverage(fixture, "FDA_APPROVAL_BY_DATE");
    expect(assessment.contractCoverage).not.toBe("blocked");
    expect(assessment.calibrationBlocked).toBe(false);
  });

  it("worst coverage across event types matches single-type assessment", async () => {
    const fixture = await loadProgramFixture("approved/synalphimab-nsclc.json");
    const worst = worstContractCoverageForSeed(fixture, ["FDA_APPROVAL_BY_DATE"]);
    const single = assessProgramContractCoverage(fixture, "FDA_APPROVAL_BY_DATE");
    expect(worst).toBe(single.contractCoverage);
  });

  it("pre-filing live intismeran approval is partial (review_clock_inferred)", async () => {
    const root = defaultFixturesRoot();
    const fixture = await loadProgramFixture("corpus/live/intismeran-melanoma.json", root);
    const assessment = assessProgramContractCoverage(fixture, "FDA_APPROVAL_BY_DATE");
    expect(assessment.contractCoverage).toBe("partial");
    expect(assessment.requiredPresent).toContain("review_clock_inferred");
    expect(assessment.requiredMissing).toContain("review_clock");
    expect(assessment.calibrationBlocked).toBe(false);
  });

  it("pre-filing live intismeran submission remains blocked without filing guidance", async () => {
    const root = defaultFixturesRoot();
    const fixture = await loadProgramFixture("corpus/live/intismeran-melanoma.json", root);
    const assessment = assessProgramContractCoverage(fixture, "NDA_BLA_SUBMISSION");
    expect(assessment.contractCoverage).toBe("blocked");
    expect(assessment.requiredMissing).toContain("expectedFilingAt");
  });
});
