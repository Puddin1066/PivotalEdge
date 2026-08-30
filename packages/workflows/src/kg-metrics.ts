/**
 * KG inventory metrics + enrichment history for Ops / Platform UI.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  loadGraphFromProgramFixtures,
  type ClinicalFeatureSnapshot,
} from "@pivotaledge/kg";
import { defaultFixturesRoot, loadProgramFixture, type ProgramFixture } from "@pivotaledge/schemas";

import {
  loadLiveScoreReport,
  type EnrichmentSeedSummary,
} from "./platform-dashboard.js";

export type CountBucket = { key: string; count: number };

export type EnrichRunProgramRow = {
  slug: string;
  nctId?: string;
  phase?: string | null;
  trialStatus?: string | null;
  designations?: string[];
  competitors?: number;
  competitorsWithApprovalDate?: number;
  orangeBookHits?: number;
  retrospectiveCompetitorHits?: number;
  fdaApplicationNumber?: string | null;
  fdaApprovalDate?: string | null;
  acceptedAt?: string | null;
  expectedFilingAt?: string | null;
  reviewProgram?: string | null;
  trialRegisteredAt?: string | null;
  trialPrimaryCompletionAt?: string | null;
  primaryEndpointMet?: boolean | null;
  polymarketMarketIds?: string[];
  contractCoverage?: "complete" | "partial" | "blocked";
};

export type EnrichHistoryEntry = {
  at: string;
  programCount: number;
  competitorsDatedTotal: number;
  orangeBookHitsTotal: number;
  retrospectiveHitsTotal: number;
  programs: EnrichRunProgramRow[];
};

export type KgLiveClockRow = {
  slug: string;
  drug: string;
  applicationType: string | null;
  filedAt: string | null;
  acceptedAt: string | null;
  pdufaDate: string | null;
  expectedFilingAt: string | null;
  reviewProgram: string | null;
  designations: string[];
  competitorsTotal: number;
  competitorsDated: number;
  regulatoryAction: string | null;
  sourcePath: string;
};

export type KgCoverageGaps = {
  enrichAgeHours: number | null;
  enrichStale: boolean;
  liveMissingClock: { slug: string; drug: string; note: string }[];
  liveUndatedCompetitors: { slug: string; drug: string; undated: string[] }[];
  contractBlocked: {
    polymarketId: string;
    slug: string;
    question: string;
    eventType: string;
    requiredMissing: string[];
  }[];
  filingWatch: {
    slug: string;
    preferredName: string;
    sponsorName: string;
    operatorAction: string;
    polymarketMarketIds: string[];
  }[];
};

export type KgMetricsDashboard = {
  kind: "kg_metrics_dashboard";
  generatedAt: string;
  summary: {
    programCount: number;
    liveProgramCount: number;
    retrospectiveProgramCount: number;
    approvedCount: number;
    crlOrFailCount: number;
    activeCount: number;
    withClockFacts: number;
    withDatedCompetitors: number;
    withDesignations: number;
    competitorLinksTotal: number;
    competitorLinksDated: number;
    lastEnrichAt: string | null;
    lastScoreAt: string | null;
    orangeBookCsvPresent: boolean;
  };
  byTherapeuticArea: CountBucket[];
  byPhase: CountBucket[];
  byStatus: CountBucket[];
  bySource: CountBucket[];
  liveClocks: KgLiveClockRow[];
  coverageGaps: KgCoverageGaps;
  seeds: EnrichmentSeedSummary[];
  lastEnrichRun: EnrichHistoryEntry | null;
  enrichHistory: EnrichHistoryEntry[];
  disclaimer: string;
};

function bump(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function toBuckets(map: Map<string, number>): CountBucket[] {
  return [...map.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

async function loadProgramsWithPaths(
  fixturesRoot: string,
): Promise<{ path: string; fixture: ProgramFixture; live: boolean; source: string }[]> {
  const { readdir } = await import("node:fs/promises");
  const dirs: { dir: string; live: boolean; source: string }[] = [
    { dir: "approved", live: false, source: "synthetic" },
    { dir: "crl", live: false, source: "synthetic" },
    { dir: "corpus", live: false, source: "corpus" },
    { dir: "corpus/live", live: true, source: "live" },
    { dir: "corpus/retrospective", live: false, source: "retrospective" },
  ];
  const out: { path: string; fixture: ProgramFixture; live: boolean; source: string }[] = [];
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
        source: g.source,
      });
    }
  }
  return out;
}

function summarizeEnrichPrograms(programs: EnrichRunProgramRow[]): Omit<EnrichHistoryEntry, "at" | "programs"> {
  return {
    programCount: programs.length,
    competitorsDatedTotal: programs.reduce((s, p) => s + (p.competitorsWithApprovalDate ?? 0), 0),
    orangeBookHitsTotal: programs.reduce((s, p) => s + (p.orangeBookHits ?? 0), 0),
    retrospectiveHitsTotal: programs.reduce((s, p) => s + (p.retrospectiveCompetitorHits ?? 0), 0),
  };
}

function normalizeEnrichEntry(raw: {
  at?: string;
  programs?: EnrichRunProgramRow[];
}): EnrichHistoryEntry | null {
  if (!raw.at || !Array.isArray(raw.programs)) return null;
  const programs = raw.programs;
  return {
    at: raw.at,
    programs,
    ...summarizeEnrichPrograms(programs),
  };
}

export async function loadEnrichHistory(
  fixturesRoot = defaultFixturesRoot(),
): Promise<EnrichHistoryEntry[]> {
  try {
    const raw = JSON.parse(
      await readFile(path.join(fixturesRoot, "enrichment/enrich-history.json"), "utf8"),
    ) as { runs?: Array<{ at?: string; programs?: EnrichRunProgramRow[] }> };
    return (raw.runs ?? [])
      .map((r) => normalizeEnrichEntry(r))
      .filter((r): r is EnrichHistoryEntry => r != null)
      .sort((a, b) => b.at.localeCompare(a.at));
  } catch {
    return [];
  }
}

export async function buildKgMetricsDashboard(
  fixturesRoot = defaultFixturesRoot(),
): Promise<KgMetricsDashboard> {
  const loaded = await loadProgramsWithPaths(fixturesRoot);
  const graph = loadGraphFromProgramFixtures(loaded.map((l) => l.fixture));
  const cutoff = new Date().toISOString();

  const byTa = new Map<string, number>();
  const byPhase = new Map<string, number>();
  const byStatus = new Map<string, number>();
  const bySource = new Map<string, number>();

  let withClockFacts = 0;
  let withDatedCompetitors = 0;
  let withDesignations = 0;
  let competitorLinksTotal = 0;
  let competitorLinksDated = 0;
  let approvedCount = 0;
  let crlOrFailCount = 0;
  let activeCount = 0;
  let retrospectiveProgramCount = 0;

  const liveClocks: KgLiveClockRow[] = [];

  for (const { path: sourcePath, fixture, live, source } of loaded) {
    bump(bySource, source);
    bump(byStatus, fixture.program.status);
    bump(byTa, fixture.indication.therapeuticArea || "unknown");
    bump(byPhase, fixture.trials[0]?.phase ?? "unknown");

    if (source === "retrospective") retrospectiveProgramCount += 1;
    if (fixture.program.status === "approved") approvedCount += 1;
    if (fixture.program.status === "crl" || fixture.program.status === "discontinued") {
      crlOrFailCount += 1;
    }
    if (fixture.program.status === "active") activeCount += 1;

    const app = fixture.application;
    const hasClock = Boolean(
      app?.filedAt || app?.acceptedAt || app?.pdufaDate || app?.expectedFilingAt,
    );
    if (hasClock) withClockFacts += 1;
    if (fixture.designations.length) withDesignations += 1;

    const therapies = fixture.approvedTherapiesInIndication ?? [];
    competitorLinksTotal += therapies.length;
    const dated = therapies.filter((t) => t.approvedAt).length;
    competitorLinksDated += dated;
    if (dated > 0) withDatedCompetitors += 1;

    if (live) {
      const gp = graph.getProgram(fixture.program.id);
      const snap: ClinicalFeatureSnapshot | null = gp
        ? graph.clinicalFeaturesAtCutoff(gp, cutoff)
        : null;
      const slug = sourcePath.replace(/^corpus\/live\//, "").replace(/\.json$/, "");
      liveClocks.push({
        slug,
        drug: fixture.drugAsset.preferredName,
        applicationType: app?.applicationType ?? null,
        filedAt: app?.filedAt ?? null,
        acceptedAt: app?.acceptedAt ?? null,
        pdufaDate: app?.pdufaDate ?? null,
        expectedFilingAt: app?.expectedFilingAt ?? null,
        reviewProgram: app?.reviewProgram ?? null,
        designations: snap?.designationTypes ?? fixture.designations.map((d) => d.designationType),
        competitorsTotal: therapies.length,
        competitorsDated: dated,
        regulatoryAction: fixture.regulatoryAction?.actionType ?? null,
        sourcePath,
      });
    }
  }

  const liveMissingClock: KgCoverageGaps["liveMissingClock"] = [];
  const liveUndatedCompetitors: KgCoverageGaps["liveUndatedCompetitors"] = [];
  for (const { path: sourcePath, fixture, live } of loaded) {
    if (!live) continue;
    const slug = sourcePath.replace(/^corpus\/live\//, "").replace(/\.json$/, "");
    const app = fixture.application;
    const hasClock = Boolean(
      app?.filedAt || app?.acceptedAt || app?.pdufaDate || app?.expectedFilingAt,
    );
    if (!hasClock) {
      liveMissingClock.push({
        slug,
        drug: fixture.drugAsset.preferredName,
        note:
          fixture.program.status === "active"
            ? "No public filing / acceptance / PDUFA / filing-guidance date yet"
            : "No typed clock dates on application",
      });
    }
    const undated = (fixture.approvedTherapiesInIndication ?? [])
      .filter((t) => !t.approvedAt)
      .map((t) => t.drugName);
    if (undated.length) {
      liveUndatedCompetitors.push({
        slug,
        drug: fixture.drugAsset.preferredName,
        undated,
      });
    }
  }

  let seeds: EnrichmentSeedSummary[] = [];
  try {
    const seedRaw = JSON.parse(
      await readFile(path.join(fixturesRoot, "enrichment/seed-programs.json"), "utf8"),
    ) as { programs?: EnrichmentSeedSummary[] };
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

  let lastEnrichRun: EnrichHistoryEntry | null = null;
  try {
    const enrichRun = JSON.parse(
      await readFile(path.join(fixturesRoot, "enrichment/last-enrich-run.json"), "utf8"),
    ) as { at?: string; programs?: EnrichRunProgramRow[] };
    lastEnrichRun = normalizeEnrichEntry(enrichRun);
  } catch {
    lastEnrichRun = null;
  }

  let history = await loadEnrichHistory(fixturesRoot);
  if (lastEnrichRun && !history.some((h) => h.at === lastEnrichRun!.at)) {
    history = [lastEnrichRun, ...history];
  }

  const score = await loadLiveScoreReport(fixturesRoot);

  let orangeBookCsvPresent = false;
  try {
    await readFile(path.join(fixturesRoot, "regulatory/orange_book_products_2026.csv"), "utf8");
    orangeBookCsvPresent = true;
  } catch {
    orangeBookCsvPresent = false;
  }

  const lastEnrichAt = lastEnrichRun?.at ?? null;
  const enrichAgeHours =
    lastEnrichAt != null ? (Date.now() - Date.parse(lastEnrichAt)) / (60 * 60 * 1000) : null;
  const enrichStale = enrichAgeHours == null || enrichAgeHours > 72;

  const contractBlocked =
    score?.opportunities
      .filter((o) => o.contractCoverage === "blocked" || o.calibrationBlocked)
      .map((o) => ({
        polymarketId: o.polymarketId,
        slug: o.slug,
        question: o.question,
        eventType: o.eventType,
        requiredMissing: o.requiredMissing ?? [],
      })) ?? [];

  let filingWatch: KgCoverageGaps["filingWatch"] = [];
  try {
    const watchRaw = JSON.parse(
      await readFile(path.join(fixturesRoot, "enrichment/filing-watch-report.json"), "utf8"),
    ) as {
      programs?: Array<{
        slug: string;
        preferredName: string;
        sponsorName: string;
        operatorAction: string;
        polymarketMarketIds: string[];
        needsFilingGuidanceWatch?: boolean;
      }>;
    };
    filingWatch =
      watchRaw.programs
        ?.filter((p) => p.needsFilingGuidanceWatch)
        .map((p) => ({
          slug: p.slug,
          preferredName: p.preferredName,
          sponsorName: p.sponsorName,
          operatorAction: p.operatorAction,
          polymarketMarketIds: p.polymarketMarketIds,
        })) ?? [];
  } catch {
    filingWatch = [];
  }

  const coverageGaps: KgCoverageGaps = {
    enrichAgeHours,
    enrichStale,
    liveMissingClock,
    liveUndatedCompetitors,
    contractBlocked,
    filingWatch,
  };

  return {
    kind: "kg_metrics_dashboard",
    generatedAt: new Date().toISOString(),
    summary: {
      programCount: loaded.length,
      liveProgramCount: liveClocks.length,
      retrospectiveProgramCount,
      approvedCount,
      crlOrFailCount,
      activeCount,
      withClockFacts,
      withDatedCompetitors,
      withDesignations,
      competitorLinksTotal,
      competitorLinksDated,
      lastEnrichAt,
      lastScoreAt: score?.at ?? null,
      orangeBookCsvPresent,
    },
    byTherapeuticArea: toBuckets(byTa),
    byPhase: toBuckets(byPhase),
    byStatus: toBuckets(byStatus),
    bySource: toBuckets(bySource),
    liveClocks,
    coverageGaps,
    seeds,
    lastEnrichRun,
    enrichHistory: history.slice(0, 30),
    disclaimer:
      "KG metrics from local fixtures only. Enrichment history is append-only from pnpm kg:enrich. Not a trading signal.",
  };
}
