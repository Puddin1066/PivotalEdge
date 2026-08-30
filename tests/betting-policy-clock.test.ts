import { describe, expect, it } from "vitest";

import { decideBetAction, shouldBlockNoFade } from "@pivotaledge/scoring";
import { DEFAULT_BETTING_POLICY } from "@pivotaledge/scoring";

function baseEdge(overrides: Partial<{
  netEdgeYes: number;
  netEdgeNo: number | null;
  executableYesPrice: number;
  executableNoPrice: number | null;
}> = {}) {
  return {
    conservativeProbability: 0.52,
    marketAdjustedProbability: 0.99,
    netEdgeYes: -0.45,
    netEdgeNo: 0.29,
    executableYesPrice: 0.999,
    executableNoPrice: 0.004,
    ...overrides,
  };
}

function baseRisks() {
  return {
    evidenceConfidence: "moderate" as const,
    resolutionRisk: "moderate" as const,
    latentInformationRisk: "low" as const,
  };
}

describe("betting-policy@2 adverse-selection gates", () => {
  it("blocks NO fade when YES ask ≥95¢ and NDA accepted under CNPV", () => {
    expect(
      shouldBlockNoFade({
        yesBestAsk: 0.999,
        eventDeadline: "2026-12-31T00:00:00.000Z",
        applicationAccepted: true,
        acceptedAt: "2026-07-22T16:05:00.000Z",
        pdufaDate: null,
        expectedFilingAt: null,
        reviewProgram: "cnpv",
        decisionByDeadlineP: 0.95,
      }),
    ).toBe(true);
  });

  it("returns NO_BET instead of BET_NO when gate triggers (Daraxonrasib shape)", () => {
    const decision = decideBetAction(
      baseEdge(),
      baseRisks(),
      DEFAULT_BETTING_POLICY,
      {
        yesBestAsk: 0.999,
        eventDeadline: "2026-12-31T00:00:00.000Z",
        applicationAccepted: true,
        acceptedAt: "2026-07-22T16:05:00.000Z",
        pdufaDate: null,
        expectedFilingAt: null,
        reviewProgram: "cnpv",
        decisionByDeadlineP: 0.95,
      },
    );
    expect(decision.action).toBe("NO_BET");
    expect(decision.primaryThesis).toContain("blocks fading");
  });

  it("allows BET_NO when YES ask is not near-certain", () => {
    const decision = decideBetAction(
      baseEdge({ executableYesPrice: 0.7, netEdgeYes: 0.02 }),
      baseRisks(),
      DEFAULT_BETTING_POLICY,
      {
        yesBestAsk: 0.7,
        eventDeadline: "2026-12-31T00:00:00.000Z",
        applicationAccepted: true,
        acceptedAt: "2026-07-22T16:05:00.000Z",
        pdufaDate: null,
        expectedFilingAt: null,
        reviewProgram: "cnpv",
        decisionByDeadlineP: 0.95,
      },
    );
    expect(decision.action).toBe("BET_NO");
  });
});
