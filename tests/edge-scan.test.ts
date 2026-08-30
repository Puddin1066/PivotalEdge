import { describe, expect, it } from "vitest";

import { isSignificantEdge, isWatchlistEdge, opportunityRankScore } from "@pivotaledge/workflows";
import type { LiveScoredOpportunity } from "@pivotaledge/workflows";

function opp(overrides: Partial<LiveScoredOpportunity>): LiveScoredOpportunity {
  return {
    slug: "test",
    polymarketId: "1",
    url: "https://polymarket.com/market/test",
    question: "Test?",
    eventType: "FDA_APPROVAL_BY_DATE",
    dataLane: "live_polymarket",
    tradability: "purchasable_now",
    clinicalNote: "test",
    modelP: 0.6,
    conservativeP: 0.5,
    yesBestAsk: 0.4,
    noBestAsk: 0.62,
    action: "BET_YES",
    netEdge: 0.08,
    stake: 100,
    evidenceConfidence: "moderate",
    fingerprint: "abc",
    snapshot: "opportunities/live/test.json",
    thesis: "edge",
    eventDeadline: null,
    closesAt: null,
    contractCoverage: "complete",
    calibrationBlocked: false,
    ...overrides,
  };
}

describe("significant edge detection", () => {
  it("flags actionable BET with complete contract", () => {
    expect(isSignificantEdge(opp({}))).toBe(true);
  });

  it("rejects contract-blocked bets", () => {
    expect(isSignificantEdge(opp({ calibrationBlocked: true, action: "BET_YES" }))).toBe(false);
  });

  it("rejects sub-threshold edge", () => {
    expect(isSignificantEdge(opp({ netEdge: 0.02 }))).toBe(false);
  });

  it("watchlist captures contract-blocked latent edge after NO_BET gate", () => {
    const row = opp({
      action: "NO_BET",
      netEdge: 0.08,
      calibrationBlocked: true,
      contractCoverage: "blocked",
    });
    expect(isSignificantEdge(row)).toBe(false);
    expect(isWatchlistEdge(row)).toBe(true);
  });

  it("watchlist rejects sub-threshold blocked edge", () => {
    expect(
      isWatchlistEdge(
        opp({ calibrationBlocked: true, contractCoverage: "blocked", netEdge: 0.02, action: "NO_BET" }),
      ),
    ).toBe(false);
  });

  it("ranks complete contract edges higher", () => {
    const complete = opportunityRankScore(opp({ contractCoverage: "complete" }));
    const blocked = opportunityRankScore(
      opp({ contractCoverage: "blocked", calibrationBlocked: true, action: "NO_BET" }),
    );
    expect(complete).toBeGreaterThan(blocked);
  });
});
