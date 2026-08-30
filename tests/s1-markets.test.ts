import { describe, expect, it } from "vitest";

import {
  classifyBiotechMarket,
  filterBiotechMarkets,
  normalizeGammaMarket,
  type GammaMarket,
} from "@pivotaledge/adapters";
import {
  heuristicParseMarketQuestion,
  requiresHumanReview,
  buildAmbiguityQueue,
  biotechDiscoveryPoolStats,
  type DiscoveredMarket,
} from "@pivotaledge/agents";

const FDA_MARKET_RAW = {
  id: "1162139",
  question: "FDA approves Retatrutide this year?",
  slug: "fda-approves-retatrutide-this-year",
  description:
    "Resolves YES if FDA approves Retatrutide for any indication on or before Dec 31, 2026 ET per Drugs@FDA.",
  endDate: "2026-12-31T00:00:00Z",
  active: true,
  closed: false,
  acceptingOrders: true,
  clobTokenIds: '["yes-token", "no-token"]',
  outcomes: '["Yes", "No"]',
  events: [{ id: "158107" }],
  tags: '["FDA", "Biotech"]',
};

const POLITICS_RAW = {
  id: "559651",
  question: "Xi Jinping out before 2027?",
  description: "Political market",
  slug: "xi-jinping",
  active: true,
  closed: false,
  acceptingOrders: true,
  clobTokenIds: "[]",
  outcomes: "[]",
};

describe("S1: gamma normalize + bio classifier", () => {
  it("normalizes Gamma market JSON strings", () => {
    const m = normalizeGammaMarket(FDA_MARKET_RAW);
    expect(m.id).toBe("1162139");
    expect(m.clobTokenIds).toEqual(["yes-token", "no-token"]);
    expect(m.eventId).toBe("158107");
  });

  it("classifies FDA approval markets as biotech", () => {
    const m = normalizeGammaMarket(FDA_MARKET_RAW);
    const c = classifyBiotechMarket(m);
    expect(c.isBiotech).toBe(true);
    expect(c.matchedKeywords).toContain("fda");
  });

  it("excludes political markets", () => {
    const m = normalizeGammaMarket(POLITICS_RAW);
    expect(classifyBiotechMarket(m).isBiotech).toBe(false);
    const batch = filterBiotechMarkets([
      normalizeGammaMarket(FDA_MARKET_RAW),
      normalizeGammaMarket(POLITICS_RAW),
    ]);
    expect(batch).toHaveLength(1);
  });

  it("discovery pool stats separate open/tradable from closed inventory", () => {
    const open = normalizeGammaMarket(FDA_MARKET_RAW);
    const closed = {
      ...open,
      id: "2253151",
      closed: true,
      acceptingOrders: false,
    };
    const stats = biotechDiscoveryPoolStats([open, closed]);
    expect(stats.totalMatched).toBe(2);
    expect(stats.openActive).toBe(1);
    expect(stats.tradable).toBe(1);
  });
});

describe("S1: market question parser", () => {
  it("heuristic parser extracts drug alias and flags missing entities", () => {
    const gamma = normalizeGammaMarket(FDA_MARKET_RAW);
    const q = heuristicParseMarketQuestion(gamma);
    expect(q.eventType).toBe("FDA_APPROVAL_BY_DATE");
    expect(q.drugAliases).toContain("Retatrutide");
    expect(q.marketId).toBe("1162139");
    expect(q.ambiguityFlags).not.toContain("drug_name_unresolved");
  });

  it("routes low-confidence parses to ambiguity queue (no silent ambiguity)", () => {
    const gamma: GammaMarket = {
      ...normalizeGammaMarket(POLITICS_RAW),
      question: "Will the drug work?",
      description: "Ambiguous biotech question without drug name.",
      tags: ["biotech"],
    };
    const q = heuristicParseMarketQuestion(gamma);
    expect(requiresHumanReview(q)).toBe(true);
    expect(q.ambiguityFlags.length).toBeGreaterThan(0);

    const discovered: DiscoveredMarket = {
      gamma,
      predictionMarket: {
        id: "pm_x",
        platform: "polymarket",
        eventId: null,
        question: gamma.question,
        resolutionRules: gamma.description,
        closesAt: null,
        tokenYesId: null,
        tokenNoId: null,
        active: true,
      },
      marketQuestion: q,
      usedLlm: false,
      needsReview: true,
    };
    const queue = buildAmbiguityQueue([discovered]);
    expect(queue.list("pending").length).toBe(1);
    expect(queue.list("pending")[0]?.ambiguityFlags.length).toBeGreaterThan(0);
  });
});
