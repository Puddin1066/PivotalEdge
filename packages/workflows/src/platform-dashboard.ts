import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import {
  loadGraphFromProgramFixtures,
  type ClinicalFeatureSnapshot,
} from "@pivotaledge/kg";
import {
  defaultFixturesRoot,
  loadProgramFixture,
  type ProgramFixture,
  type RadarDataLane,
  type RadarTradability,
} from "@pivotaledge/schemas";

import { loadEdgeScanReport } from "./edge-scan.js";

export type LiveScoredOpportunity = {
  slug: string;
  polymarketId: string;
  url: string;
  question: string;
  eventType: string;
  dataLane: RadarDataLane;
  tradability: RadarTradability;
  clinicalNote: string;
  modelP: number;
  conservativeP: number;
  yesBestAsk: number | null;
  noBestAsk: number | null;
  action: string;
  netEdge: number;
  stake: number;
  evidenceConfidence: string;
  fingerprint: string;
  snapshot: string;
  thesis: string;
  eventDeadline: string | null;
  closesAt: string | null;
  /** P0 contract checklist (from kg-score-live). */
  requiredPresent?: string[];
  requiredMissing?: string[];
  contractCoverage?: "complete" | "partial" | "blocked";
  calibrationBlocked?: boolean;
  contractNotes?: string[];
};

function toIsoOrNull(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed).toISOString();
}

/** Fill missing deadlines from frozen snapshots so Ops works before the next rescore. */
async function hydrateOpportunityDeadlines(
  opportunities: LiveScoredOpportunity[],
  fixturesRoot: string,
): Promise<LiveScoredOpportunity[]> {
  return Promise.all(
    opportunities.map(async (o) => {
      const existingDeadline = toIsoOrNull(o.eventDeadline);
      const existingClose = toIsoOrNull(o.closesAt);
      if (existingDeadline && existingClose) {
        return { ...o, eventDeadline: existingDeadline, closesAt: existingClose };
      }
      if (!o.snapshot) {
        return {
          ...o,
          eventDeadline: existingDeadline,
          closesAt: existingClose ?? existingDeadline,
        };
      }
      try {
        const raw = JSON.parse(
          await readFile(path.join(fixturesRoot, o.snapshot), "utf8"),
        ) as {
          marketQuestion?: { eventDeadline?: string };
        };
        const fromSnap = toIsoOrNull(raw.marketQuestion?.eventDeadline);
        return {
          ...o,
          eventDeadline: existingDeadline ?? fromSnap,
          closesAt: existingClose ?? existingDeadline ?? fromSnap,
        };
      } catch {
        return {
          ...o,
          eventDeadline: existingDeadline,
          closesAt: existingClose ?? existingDeadline,
        };
      }
    }),
  );
}

export type KgProgramInventoryRow = {
  programId: string;
  drug: string;
  phase: string | null;
  therapeuticArea: string | null;
  status: string;
  trialStatus: string | null;
  enrollment: number | null;
  primaryEndpointMet: boolean | null;
  endpointFamily: string | null;
  designations: string[];
  approvedTherapyCount: number;
  sourcePath: string;
  live: boolean;
};

export type EnrichmentSeedSummary = {
  slug: string;
  preferredName: string;
  nctId: string;
  polymarketMarketIds: string[];
  notes: string;
};

export type PlatformDashboard = {
  kind: "platform_dashboard";
  generatedAt: string;
  logic: { step: string; detail: string }[];
  kg: {
    programCount: number;
    liveProgramCount: number;
    programs: KgProgramInventoryRow[];
  };
  enrichment: {
    seeds: EnrichmentSeedSummary[];
    lastEnrichAt: string | null;
    lastScoreAt: string | null;
  };
  retrospective: RetrospectiveSummary | null;
  trading: TradingReadinessSummary | null;
  opportunities: LiveScoredOpportunity[];
  disclaimer: string;
};

export type TradingReadinessSummary = {
  at: string | null;
  paperReady: boolean;
  clinicalConviction: "demo" | "calibrated";
  liveTradingEnabled: false;
  quoteVaultRows: number;
  quoteVaultMarkets: number;
  quoteVaultDistinctDays: number | null;
  openPaperPositions: number;
  openBetActions: number;
  blockers: string[];
};

export type RetrospectiveSummary = {
  at: string | null;
  passed: boolean;
  clinical: {
    passed: boolean;
    totalCases: number;
    testCases: number;
    calibratedBrier: number;
    baseRateBrier: number;
    beatsBaseRate: boolean;
  };
  resolvedMarkets: {
    passed: boolean;
    scoredCases: number;
    modelBrier: number;
    marketBrier: number;
    beatsMarketBrier: boolean;
    edgeVsMarket: number;
    beatsMarketAfterCosts: boolean;
    askProvenance: string;
    edgeInformational: boolean;
  };
  syntheticEdgeSmoke: {
    passed: boolean;
    beatsMarketAfterCosts: boolean;
    edgeVsMarket: number;
    totalTrades: number;
  };
  blockers: string[];
};

async function loadProgramsWithPaths(
  fixturesRoot: string,
): Promise<{ path: string; fixture: ProgramFixture; live: boolean }[]> {
  const dirs: { dir: string; live: boolean }[] = [
    { dir: "approved", live: false },
    { dir: "crl", live: false },
    { dir: "corpus", live: false },
    { dir: "corpus/live", live: true },
    { dir: "corpus/retrospective", live: false },
  ];
  const out: { path: string; fixture: ProgramFixture; live: boolean }[] = [];
  for (const g of dirs) {
    let files: string[] = [];
    try {
      files = (await readdir(path.join(fixturesRoot, g.dir))).filter((f) => f.endsWith(".json"));
    } catch {
      continue;
    }
    for (const f of files.sort()) {
      const rel = `${g.dir}/${f}`;
      out.push({
        path: rel,
        fixture: await loadProgramFixture(rel, fixturesRoot),
        live: g.live,
      });
    }
  }
  return out;
}

export async function loadLiveScoreReport(
  fixturesRoot = defaultFixturesRoot(),
): Promise<{
  at: string | null;
  disclaimer: string;
  opportunities: LiveScoredOpportunity[];
} | null> {
  try {
    const raw = await readFile(path.join(fixturesRoot, "enrichment/live-score-report.json"), "utf8");
    const data = JSON.parse(raw) as {
      at?: string;
      disclaimer?: string;
      opportunities?: Array<Partial<LiveScoredOpportunity> & LiveScoredOpportunity>;
    };
    const opportunities = await hydrateOpportunityDeadlines(
      (data.opportunities ?? []).map((o) => ({
        ...o,
        eventDeadline: o.eventDeadline ?? null,
        closesAt: o.closesAt ?? null,
      })),
      fixturesRoot,
    );
    return {
      at: data.at ?? null,
      disclaimer:
        data.disclaimer ??
        "LIVE CLOB quotes + enriched-KG probabilities. Not a trade instruction.",
      opportunities,
    };
  } catch {
    return null;
  }
}

export async function loadRetrospectiveSummary(
  fixturesRoot = defaultFixturesRoot(),
): Promise<RetrospectiveSummary | null> {
  try {
    const raw = await readFile(path.join(fixturesRoot, "evals/retrospective-report.json"), "utf8");
    const data = JSON.parse(raw) as {
      gate?: {
        generatedAt?: string;
        passed: boolean;
        clinical: RetrospectiveSummary["clinical"];
        resolvedMarkets: RetrospectiveSummary["resolvedMarkets"];
        syntheticEdgeSmoke: RetrospectiveSummary["syntheticEdgeSmoke"];
        blockers?: string[];
      };
    };
    const gate = data.gate;
    if (!gate) return null;
    return {
      at: gate.generatedAt ?? null,
      passed: gate.passed,
      clinical: gate.clinical,
      resolvedMarkets: gate.resolvedMarkets,
      syntheticEdgeSmoke: gate.syntheticEdgeSmoke,
      blockers: gate.blockers ?? [],
    };
  } catch {
    return null;
  }
}

export async function loadTradingReadinessSummary(
  fixturesRoot = defaultFixturesRoot(),
): Promise<TradingReadinessSummary | null> {
  try {
    const raw = await readFile(
      path.join(fixturesRoot, "evals/trading-readiness-report.json"),
      "utf8",
    );
    const data = JSON.parse(raw) as {
      generatedAt?: string;
      paperReady?: boolean;
      clinicalConviction?: "demo" | "calibrated";
      liveTradingEnabled?: false;
      checks?: {
        quoteVaultRows?: number;
        quoteVaultMarkets?: number;
        quoteVaultDistinctDays?: number;
        openPaperPositions?: number;
        openBetActions?: number;
      };
      blockers?: string[];
    };
    return {
      at: data.generatedAt ?? null,
      paperReady: Boolean(data.paperReady),
      clinicalConviction: data.clinicalConviction ?? "demo",
      liveTradingEnabled: false,
      quoteVaultRows: data.checks?.quoteVaultRows ?? 0,
      quoteVaultMarkets: data.checks?.quoteVaultMarkets ?? 0,
      quoteVaultDistinctDays: data.checks?.quoteVaultDistinctDays ?? null,
      openPaperPositions: data.checks?.openPaperPositions ?? 0,
      openBetActions: data.checks?.openBetActions ?? 0,
      blockers: data.blockers ?? [],
    };
  } catch {
    return null;
  }
}

export async function buildPlatformDashboard(
  fixturesRoot = defaultFixturesRoot(),
): Promise<PlatformDashboard> {
  const loaded = await loadProgramsWithPaths(fixturesRoot);
  const graph = loadGraphFromProgramFixtures(loaded.map((l) => l.fixture));
  const cutoff = new Date().toISOString();

  const programs: KgProgramInventoryRow[] = loaded.map(({ path: sourcePath, fixture, live }) => {
    const gp = graph.getProgram(fixture.program.id);
    const snap: ClinicalFeatureSnapshot | null = gp
      ? graph.clinicalFeaturesAtCutoff(gp, cutoff)
      : null;
    return {
      programId: fixture.program.id,
      drug: fixture.drugAsset.preferredName,
      phase: snap?.phase ?? fixture.trials[0]?.phase ?? null,
      therapeuticArea: snap?.therapeuticArea ?? fixture.indication.therapeuticArea,
      status: fixture.program.status,
      trialStatus: snap?.trialStatus ?? fixture.trials[0]?.status ?? null,
      enrollment: snap?.actualEnrollment ?? fixture.trials[0]?.actualEnrollment ?? null,
      primaryEndpointMet: snap?.primaryEndpointMet ?? null,
      endpointFamily: snap?.endpointFamily ?? null,
      designations: snap?.designationTypes ?? [],
      approvedTherapyCount: snap?.approvedTherapyCount ?? 0,
      sourcePath,
      live,
    };
  });

  let seeds: EnrichmentSeedSummary[] = [];
  let lastEnrichAt: string | null = null;
  try {
    const seedRaw = JSON.parse(
      await readFile(path.join(fixturesRoot, "enrichment/seed-programs.json"), "utf8"),
    ) as { programs?: EnrichmentSeedSummary[]; prioritizedAt?: string };
    seeds = (seedRaw.programs ?? []).map((s) => ({
      slug: s.slug,
      preferredName: s.preferredName,
      nctId: s.nctId,
      polymarketMarketIds: s.polymarketMarketIds,
      notes: s.notes,
    }));
  } catch {
    seeds = [];
  }
  try {
    const enrichRun = JSON.parse(
      await readFile(path.join(fixturesRoot, "enrichment/last-enrich-run.json"), "utf8"),
    ) as { at?: string };
    lastEnrichAt = enrichRun.at ?? null;
  } catch {
    lastEnrichAt = null;
  }

  const score = await loadLiveScoreReport(fixturesRoot);
  const edgeScan = await loadEdgeScanReport(fixturesRoot);
  const opportunities = [...(edgeScan?.allScored ?? score?.opportunities ?? [])].sort(
    (a, b) => Math.abs(b.netEdge) - Math.abs(a.netEdge),
  );
  const retrospective = await loadRetrospectiveSummary(fixturesRoot);
  const trading = await loadTradingReadinessSummary(fixturesRoot);

  return {
    kind: "platform_dashboard",
    generatedAt: new Date().toISOString(),
    logic: [
      {
        step: "1 · Markets",
        detail: "Discover Polymarket FDA/clinical questions; parse resolution rules.",
      },
      {
        step: "2 · Clinical KG",
        detail: "Enrich programs from CT.gov / openFDA / Open Targets with first_public_at.",
      },
      {
        step: "3 · Calibrated P",
        detail: "Deterministic model → P(YES); LLM is evidence analyst only.",
      },
      {
        step: "4 · Executable CLOB",
        detail: "Join YES/NO best asks (never midpoint); archive via pnpm quotes:snapshot.",
      },
      {
        step: "5 · Policy",
        detail: "BET YES / BET NO / WAIT / NO BET from net edge, fees, confidence.",
      },
      {
        step: "6 · Retrospective",
        detail:
          "Track B: clinical chrono Brier + resolved Polymarket Brier/edge (pnpm retro:validate).",
      },
      {
        step: "7 · Paper readiness",
        detail: "Quote vault + open paper positions (pnpm paper:live). Live execution off.",
      },
    ],
    kg: {
      programCount: programs.length,
      liveProgramCount: programs.filter((p) => p.live).length,
      programs,
    },
    enrichment: {
      seeds,
      lastEnrichAt,
      lastScoreAt: edgeScan?.generatedAt ?? score?.at ?? null,
    },
    retrospective,
    trading,
    opportunities,
    disclaimer:
      score?.disclaimer ??
      "Live quotes may be present; clinical conviction remains DEMO until trading readiness Bar A.",
  };
}
