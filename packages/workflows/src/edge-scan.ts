/**
 * Discover trial-related Polymarket markets, score vs clinical KG, rank significant edges.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { discoverBiotechMarketsDetailed, type DiscoveredMarket } from "@pivotaledge/agents";
import {
  appendQuoteRows,
  fetchGammaMarketById,
  yesNoTokenIds,
  type EnrichSeedProgram,
  type GammaMarket,
} from "@pivotaledge/adapters";
import {
  InMemoryKnowledgeGraphRepository,
  loadGraphFromProgramFixtures,
} from "@pivotaledge/kg";
import { defaultFixturesRoot, loadProgramFixture, type ProgramFixture } from "@pivotaledge/schemas";

import type { LiveScoredOpportunity } from "./platform-dashboard.js";
import {
  isSignificantEdge,
  isWatchlistEdge,
  opportunityRankScore,
  scoreLiveMarket,
  type SeedLike,
} from "./live-market-scoring.js";

export type EdgeScanUnmappedMarket = {
  polymarketId: string;
  question: string;
  url: string;
  eventType: string;
  active: boolean;
  reason: string;
};

export type EdgeScanDiscoveredMarket = {
  polymarketId: string;
  question: string;
  url: string;
  eventType: string;
  closed: boolean;
  active: boolean;
  acceptingOrders: boolean;
  tradable: boolean;
  mapped: boolean;
  scored: boolean;
};

export type EdgeScanReport = {
  kind: "edge_scan_report";
  generatedAt: string;
  cutoff: string;
  /** Open + accepting orders (actionable universe headline). */
  discoveredCount: number;
  /** Keyword matches including closed/historical inventory. */
  discoveredTotal: number;
  /** Open and active (may not accept orders). */
  discoveredOpen: number;
  /** Open, active, accepting CLOB orders. */
  discoveredTradable: number;
  scoredCount: number;
  significantCount: number;
  watchlistCount: number;
  minNetEdge: number;
  clinicalConviction: "demo" | "calibrated";
  discoveredMarkets: EdgeScanDiscoveredMarket[];
  significantEdges: LiveScoredOpportunity[];
  allScored: LiveScoredOpportunity[];
  unmapped: EdgeScanUnmappedMarket[];
  watchlist: LiveScoredOpportunity[];
};

export type RunEdgeScanOptions = {
  fixturesRoot?: string;
  discoverLimit?: number;
  /** Skip Polymarket discovery (seed markets only). */
  seedsOnly?: boolean;
  writeLiveScoreReport?: boolean;
};

async function loadAllPrograms(root: string): Promise<ProgramFixture[]> {
  const dirs = ["approved", "crl", "corpus", "corpus/live", "corpus/retrospective"];
  const out: ProgramFixture[] = [];
  const { readdir } = await import("node:fs/promises");
  for (const dir of dirs) {
    let files: string[] = [];
    try {
      files = (await readdir(path.join(root, dir))).filter((f) => f.endsWith(".json"));
    } catch {
      continue;
    }
    for (const f of files.sort()) {
      out.push(await loadProgramFixture(`${dir}/${f}`, root));
    }
  }
  return out;
}

function fixtureForSeed(
  programs: ProgramFixture[],
  seed: EnrichSeedProgram,
): ProgramFixture | null {
  return (
    programs.find((p) => p.program.id === `prog_${seed.slug.replace(/-/g, "_")}`) ??
    programs.find(
      (p) => p.drugAsset.preferredName.toLowerCase() === seed.preferredName.toLowerCase(),
    ) ??
    null
  );
}

function matchDiscoveredToFixture(
  discovered: DiscoveredMarket,
  programs: ProgramFixture[],
): { fixture: ProgramFixture; seed: SeedLike } | null {
  const q = discovered.gamma.question.toLowerCase();
  const aliases = [
    ...discovered.marketQuestion.drugAliases,
    discovered.marketQuestion.drugAssetId,
  ].filter(Boolean);

  for (const p of programs) {
    const name = p.drugAsset.preferredName.toLowerCase();
    if (q.includes(name) || aliases.some((a) => a.toLowerCase() === name)) {
      return {
        fixture: p,
        seed: {
          slug: p.program.id.replace(/^prog_/, "").replace(/_/g, "-"),
          preferredName: p.drugAsset.preferredName,
        },
      };
    }
  }
  return null;
}

async function clinicalNote(root: string): Promise<string> {
  try {
    const ready = JSON.parse(
      await readFile(path.join(root, "evals/trading-readiness-report.json"), "utf8"),
    ) as { clinicalConviction?: string };
    if (ready.clinicalConviction === "calibrated") {
      return "P from enriched KG + clinical chrono. Executable asks from live CLOB. Not live-traded.";
    }
  } catch {
    /* demo */
  }
  return "P from enriched KG; DEMO conviction until trading readiness Bar A.";
}

async function clinicalConviction(root: string): Promise<"demo" | "calibrated"> {
  try {
    const ready = JSON.parse(
      await readFile(path.join(root, "evals/trading-readiness-report.json"), "utf8"),
    ) as { clinicalConviction?: string };
    return ready.clinicalConviction === "calibrated" ? "calibrated" : "demo";
  } catch {
    return "demo";
  }
}

export async function runEdgeScan(options: RunEdgeScanOptions = {}): Promise<EdgeScanReport> {
  const root = options.fixturesRoot ?? defaultFixturesRoot();
  const cutoff = new Date().toISOString();
  const seedRaw = JSON.parse(
    await readFile(path.join(root, "enrichment/seed-programs.json"), "utf8"),
  ) as { programs: EnrichSeedProgram[] };

  const programs = await loadAllPrograms(root);
  const graph = loadGraphFromProgramFixtures(programs);
  const repo = new InMemoryKnowledgeGraphRepository(graph);
  const note = await clinicalNote(root);
  const conviction = await clinicalConviction(root);

  const marketTargets = new Map<
    string,
    { seed: SeedLike; fixture: ProgramFixture; gamma?: GammaMarket; discovered?: DiscoveredMarket }
  >();

  for (const s of seedRaw.programs) {
    const fixture = fixtureForSeed(programs, s);
    if (!fixture) continue;
    for (const marketId of s.polymarketMarketIds) {
      marketTargets.set(marketId, { seed: s, fixture });
    }
  }

  let discovered: DiscoveredMarket[] = [];
  let discoveryStats = { totalMatched: 0, openActive: 0, tradable: 0 };
  if (!options.seedsOnly) {
    const discovery = await discoverBiotechMarketsDetailed({
      limit: options.discoverLimit ?? 60,
      useLlm: false,
      includeClosed: false,
      maxPages: 6,
    });
    discovered = discovery.markets;
    discoveryStats = discovery.stats;
    for (const d of discovered) {
      if (marketTargets.has(d.gamma.id)) continue;
      if (d.gamma.closed || !d.gamma.active) continue;
      const matched = matchDiscoveredToFixture(d, programs);
      if (matched) {
        marketTargets.set(d.gamma.id, {
          seed: matched.seed,
          fixture: matched.fixture,
          gamma: d.gamma,
          discovered: d,
        });
      }
    }
  }

  const allScored: LiveScoredOpportunity[] = [];
  const unmapped: EdgeScanUnmappedMarket[] = [];
  const vaultRows: Parameters<typeof appendQuoteRows>[0] = [];

  for (const [marketId, target] of marketTargets) {
    const gamma = target.gamma ?? (await fetchGammaMarketById(marketId));
    if (!gamma || gamma.closed) continue;

    const scored = await scoreLiveMarket({
      marketId,
      seed: target.seed,
      fixture: target.fixture,
      gamma,
      repo,
      cutoff,
      fixturesRoot: root,
      clinicalNote: note,
    });
    if (!scored) continue;

    allScored.push(scored);

    const tokens = yesNoTokenIds(gamma);
    if (tokens && scored.yesBestAsk != null && scored.noBestAsk != null) {
      vaultRows.push({
        kind: "archived_clob_quote",
        capturedAt: cutoff,
        marketId,
        tokenYesId: tokens.yes,
        tokenNoId: tokens.no,
        bestAskYes: scored.yesBestAsk,
        bestAskNo: scored.noBestAsk,
        bestAskYesSize: 0,
        bestAskNoSize: 0,
        source: "kg_score_live",
        slug: scored.slug,
        question: scored.question,
      });
    }
  }

  allScored.sort((a, b) => opportunityRankScore(b) - opportunityRankScore(a));
  const significantEdges = allScored.filter(isSignificantEdge);
  const watchlist = allScored.filter(isWatchlistEdge);

  const scoredIds = new Set(allScored.map((o) => o.polymarketId));

  const discoveredMarkets: EdgeScanDiscoveredMarket[] = discovered.map((d) => {
    const tradable = !d.gamma.closed && d.gamma.active && d.gamma.acceptingOrders;
    return {
      polymarketId: d.gamma.id,
      question: d.gamma.question,
      url: `https://polymarket.com/market/${d.gamma.slug}`,
      eventType: d.marketQuestion.eventType,
      closed: d.gamma.closed,
      active: d.gamma.active,
      acceptingOrders: d.gamma.acceptingOrders,
      tradable,
      mapped: marketTargets.has(d.gamma.id),
      scored: scoredIds.has(d.gamma.id),
    };
  });

  for (const d of discovered) {
    if (d.gamma.closed || !d.gamma.active) continue;
    if (scoredIds.has(d.gamma.id)) continue;
    unmapped.push({
      polymarketId: d.gamma.id,
      question: d.gamma.question,
      url: `https://polymarket.com/market/${d.gamma.slug}`,
      eventType: d.marketQuestion.eventType,
      active: d.gamma.active,
      reason: marketTargets.has(d.gamma.id)
        ? "score_failed_or_thin_book"
        : "needs_program_fixture",
    });
  }

  if (vaultRows.length) {
    await appendQuoteRows(vaultRows, root);
  }

  const tradableScored = allScored.filter((o) => o.tradability === "purchasable_now").length;
  const tradableCount = options.seedsOnly ? tradableScored : discoveryStats.tradable;

  const report: EdgeScanReport = {
    kind: "edge_scan_report",
    generatedAt: cutoff,
    cutoff,
    discoveredCount: tradableCount,
    discoveredTotal: options.seedsOnly ? tradableScored : discoveryStats.totalMatched,
    discoveredOpen: options.seedsOnly ? allScored.length : discoveryStats.openActive,
    discoveredTradable: tradableCount,
    scoredCount: allScored.length,
    significantCount: significantEdges.length,
    watchlistCount: watchlist.length,
    minNetEdge: 0.05,
    clinicalConviction: conviction,
    discoveredMarkets,
    significantEdges,
    allScored,
    unmapped: unmapped.slice(0, 40),
    watchlist,
  };

  if (options.writeLiveScoreReport !== false) {
    await writeFile(
      path.join(root, "enrichment/live-score-report.json"),
      `${JSON.stringify(
        {
          kind: "live_kg_score_report",
          at: cutoff,
          cutoff,
          disclaimer: note,
          opportunities: allScored,
        },
        null,
        2,
      )}\n`,
    );
  }

  await writeFile(
    path.join(root, "enrichment/edge-scan-report.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );

  return report;
}

export async function loadEdgeScanReport(
  fixturesRoot = defaultFixturesRoot(),
): Promise<EdgeScanReport | null> {
  try {
    const raw = JSON.parse(
      await readFile(path.join(fixturesRoot, "enrichment/edge-scan-report.json"), "utf8"),
    ) as EdgeScanReport;
    if (raw.kind !== "edge_scan_report") return null;
    return {
      ...raw,
      discoveredTotal: raw.discoveredTotal ?? raw.discoveredCount ?? 0,
      discoveredOpen: raw.discoveredOpen ?? raw.discoveredCount ?? 0,
      discoveredTradable: raw.discoveredTradable ?? raw.discoveredCount ?? 0,
      discoveredMarkets: raw.discoveredMarkets ?? [],
      watchlistCount: raw.watchlistCount ?? raw.watchlist?.length ?? 0,
      watchlist: raw.watchlist ?? [],
    };
  } catch {
    return null;
  }
}
