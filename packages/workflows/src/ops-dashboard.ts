/**
 * Manual ops book + marked positions for the Ops console.
 */
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  latestQuotesByMarket,
  loadQuoteArchive,
} from "@pivotaledge/adapters";
import {
  CreateManualPositionInputSchema,
  ManualBookSchema,
  PatchManualPositionInputSchema,
  realizedManualPnL,
  defaultFixturesRoot,
  type CreateManualPositionInput,
  type ManualBook,
  type ManualPosition,
  type PatchManualPositionInput,
  type PortfolioSuggestion,
  type PortfolioRiskReport,
  type PortfolioRiskScenarioId,
} from "@pivotaledge/schemas";
import { buildEdgeWeightedPortfolio, buildPortfolioRiskReport } from "@pivotaledge/scoring";

import {
  buildPlatformDashboard,
  type LiveScoredOpportunity,
  type PlatformDashboard,
  type TradingReadinessSummary,
} from "./platform-dashboard.js";

export type MarkedManualPosition = ManualPosition & {
  markAsk: number | null;
  markedAt: string | null;
  askStale: boolean;
  edgeBroken: boolean;
  unrealizedPnL: number | null;
  modelPNow: number | null;
  conservativePNow: number | null;
  netEdgeNow: number | null;
  alerts: string[];
};

export type OpsAttentionItem = {
  id: string;
  severity: "high" | "medium" | "low";
  kind: "edge_broken" | "ask_stale" | "ending" | "review" | "no_scores";
  title: string;
  detail: string;
  href: string;
};

export type OpsPaperPosition = {
  marketId: string;
  question: string;
  action: string;
  netEdge: number;
  stake: number;
  status: string;
};

export type OpsDashboard = {
  kind: "ops_dashboard";
  generatedAt: string;
  platform: PlatformDashboard;
  trading: TradingReadinessSummary | null;
  bankroll: number;
  manual: {
    open: MarkedManualPosition[];
    closed: MarkedManualPosition[];
  };
  paperOpen: number;
  paperPositions: OpsPaperPosition[];
  portfolio: PortfolioSuggestion;
  risk: PortfolioRiskReport;
  attention: OpsAttentionItem[];
  asksFresh: boolean;
  lastAskAt: string | null;
};

function bookPath(fixturesRoot: string): string {
  return path.join(fixturesRoot, "ops/manual-book.json");
}

export async function loadManualBook(
  fixturesRoot = defaultFixturesRoot(),
): Promise<ManualBook> {
  try {
    const raw = await readFile(bookPath(fixturesRoot), "utf8");
    return ManualBookSchema.parse(JSON.parse(raw));
  } catch {
    return ManualBookSchema.parse({
      kind: "manual_ops_book",
      updatedAt: new Date().toISOString(),
      bankroll: 10_000,
      positions: [],
    });
  }
}

async function saveManualBook(book: ManualBook, fixturesRoot: string): Promise<void> {
  const p = bookPath(fixturesRoot);
  await mkdir(path.dirname(p), { recursive: true });
  await writeFile(p, `${JSON.stringify(book, null, 2)}\n`, "utf8");
}

export async function createManualPosition(
  input: CreateManualPositionInput,
  fixturesRoot = defaultFixturesRoot(),
): Promise<ManualPosition> {
  const parsed = CreateManualPositionInputSchema.parse(input);
  const book = await loadManualBook(fixturesRoot);
  const position: ManualPosition = {
    id: `man_${randomUUID().replace(/-/g, "").slice(0, 16)}`,
    marketId: parsed.marketId,
    polymarketUrl: parsed.polymarketUrl,
    question: parsed.question,
    slug: parsed.slug,
    side: parsed.side,
    status: "open",
    recommendationFingerprint: parsed.recommendationFingerprint,
    modelPAtEntry: parsed.modelPAtEntry,
    conservativePAtEntry: parsed.conservativePAtEntry,
    recommendedAction: parsed.recommendedAction,
    maxEntryPriceAtEntry: parsed.maxEntryPriceAtEntry ?? null,
    netEdgeAtEntry: parsed.netEdgeAtEntry,
    fillPrice: parsed.fillPrice,
    fillNotional: parsed.fillNotional,
    feesPaid: parsed.feesPaid ?? 0,
    filledAt: parsed.filledAt ?? new Date().toISOString(),
    notes: parsed.notes,
    markAsk: null,
    markedAt: null,
    closedAt: null,
    resolvedYes: null,
    realizedPnL: null,
    invalidatorsNoted: parsed.invalidatorsNoted ?? [],
  };
  book.positions.unshift(position);
  book.updatedAt = new Date().toISOString();
  await saveManualBook(book, fixturesRoot);
  return position;
}

export async function patchManualPosition(
  input: PatchManualPositionInput,
  fixturesRoot = defaultFixturesRoot(),
): Promise<ManualPosition> {
  const parsed = PatchManualPositionInputSchema.parse(input);
  const book = await loadManualBook(fixturesRoot);
  const idx = book.positions.findIndex((p) => p.id === parsed.id);
  if (idx < 0) throw new Error(`position not found: ${parsed.id}`);
  const current = book.positions[idx]!;

  let next: ManualPosition = { ...current, ...parsed, id: current.id };

  if (parsed.status === "resolved" && parsed.resolvedYes != null) {
    next = {
      ...next,
      status: "resolved",
      resolvedYes: parsed.resolvedYes,
      closedAt: parsed.closedAt ?? new Date().toISOString(),
      closeReason: parsed.closeReason ?? "resolved",
      realizedPnL:
        parsed.realizedPnL ??
        realizedManualPnL({
          side: current.side,
          fillPrice: current.fillPrice,
          fillNotional: current.fillNotional,
          feesPaid: current.feesPaid,
          resolvedYes: parsed.resolvedYes,
        }),
    };
  } else if (parsed.status === "cancelled") {
    next = {
      ...next,
      status: "cancelled",
      closedAt: parsed.closedAt ?? new Date().toISOString(),
      closeReason: parsed.closeReason ?? "manual_exit",
      realizedPnL: parsed.realizedPnL ?? 0,
    };
  }

  book.positions[idx] = next;
  book.updatedAt = new Date().toISOString();
  await saveManualBook(book, fixturesRoot);
  return next;
}

function markPosition(
  p: ManualPosition,
  opp: LiveScoredOpportunity | undefined,
  quote: { bestAskYes: number | null; bestAskNo: number | null; capturedAt: string } | undefined,
  nowMs: number,
): MarkedManualPosition {
  const markAsk =
    quote != null
      ? p.side === "YES"
        ? quote.bestAskYes
        : quote.bestAskNo
      : (p.markAsk ?? null);
  const markedAt = quote?.capturedAt ?? p.markedAt ?? null;
  const askStale = markedAt ? nowMs - Date.parse(markedAt) > 48 * 60 * 60 * 1000 : true;
  const maxEntry = p.maxEntryPriceAtEntry ?? null;
  const edgeBroken =
    p.status === "open" && markAsk != null && maxEntry != null && markAsk > maxEntry + 1e-9;

  let unrealizedPnL: number | null = null;
  if (p.status === "open" && markAsk != null && markAsk > 0) {
    // Mark-to-ask approximation: value of shares bought = (notional/fillPrice)*markAsk
    const shares = p.fillNotional / p.fillPrice;
    unrealizedPnL = shares * markAsk - p.fillNotional - p.feesPaid;
  }

  const alerts: string[] = [];
  if (edgeBroken) alerts.push("EDGE BROKEN");
  if (p.invalidatorsNoted.length) alerts.push("REVIEW");
  if (askStale) alerts.push("REFRESH ASKS");

  let netEdgeNow: number | null = null;
  if (opp) {
    netEdgeNow = opp.netEdge;
  }

  return {
    ...p,
    markAsk,
    markedAt,
    askStale,
    edgeBroken,
    unrealizedPnL,
    modelPNow: opp?.modelP ?? null,
    conservativePNow: opp?.conservativeP ?? null,
    netEdgeNow,
    alerts,
  };
}

function buildAttention(
  open: MarkedManualPosition[],
  opportunities: LiveScoredOpportunity[],
  asksFresh: boolean,
  lastEnrichAt: string | null,
): OpsAttentionItem[] {
  const items: OpsAttentionItem[] = [];
  if (opportunities.length === 0) {
    items.push({
      id: "no_scores",
      severity: "high",
      kind: "no_scores",
      title: "No live edges scored",
      detail: "Run Rescore live to join clinical P with current CLOB asks.",
      href: "/ops/health",
    });
  }
  if (!asksFresh) {
    items.push({
      id: "asks_stale",
      severity: "medium",
      kind: "ask_stale",
      title: "Executable asks may be stale",
      detail: "Snapshot CLOB asks so marks and edges use fillable prices.",
      href: "/ops/health",
    });
  }
  const enrichAgeHours =
    lastEnrichAt != null ? (Date.now() - Date.parse(lastEnrichAt)) / (60 * 60 * 1000) : null;
  if (enrichAgeHours == null || enrichAgeHours > 72) {
    items.push({
      id: "enrich_stale",
      severity: "low",
      kind: "review",
      title: "KG enrich may be stale",
      detail:
        enrichAgeHours == null
          ? "No enrich run recorded — open /ops/kg and run KG enrich."
          : `Last enrich ${enrichAgeHours.toFixed(0)}h ago (>72h). Re-run when public clock facts change.`,
      href: "/ops/kg",
    });
  }
  for (const p of open) {
    if (p.edgeBroken) {
      items.push({
        id: `broken_${p.id}`,
        severity: "high",
        kind: "edge_broken",
        title: `Ask moved through max entry — ${p.side}`,
        detail: p.question,
        href: `/ops/market/${p.marketId}`,
      });
    } else if (p.invalidatorsNoted.length) {
      items.push({
        id: `review_${p.id}`,
        severity: "medium",
        kind: "review",
        title: "Invalidator noted on open position",
        detail: p.question,
        href: `/ops/market/${p.marketId}`,
      });
    } else if (p.askStale) {
      items.push({
        id: `stale_${p.id}`,
        severity: "low",
        kind: "ask_stale",
        title: "Held market has stale mark",
        detail: p.question,
        href: `/ops/book`,
      });
    }
  }
  return items.slice(0, 8);
}

export async function buildOpsDashboard(
  fixturesRoot = defaultFixturesRoot(),
): Promise<OpsDashboard> {
  const platform = await buildPlatformDashboard(fixturesRoot);
  const book = await loadManualBook(fixturesRoot);
  const quoteRows = await loadQuoteArchive(fixturesRoot);
  const latest = latestQuotesByMarket(quoteRows);
  const nowMs = Date.now();
  const oppByMarket = new Map(platform.opportunities.map((o) => [o.polymarketId, o]));

  const marked = book.positions.map((p) => {
    const q = latest.get(p.marketId);
    return markPosition(
      p,
      oppByMarket.get(p.marketId),
      q
        ? { bestAskYes: q.bestAskYes, bestAskNo: q.bestAskNo, capturedAt: q.capturedAt }
        : undefined,
      nowMs,
    );
  });

  const open = marked.filter((p) => p.status === "open");
  const closed = marked.filter((p) => p.status !== "open");

  let paperOpen = 0;
  let paperPositions: OpsPaperPosition[] = [];
  try {
    const paper = JSON.parse(
      await readFile(path.join(fixturesRoot, "evals/live-paper-report.json"), "utf8"),
    ) as {
      positions?: {
        marketId?: string;
        question?: string;
        status?: string;
        action?: string;
        netEdge?: number;
        stake?: number;
      }[];
    };
    paperPositions = (paper.positions ?? [])
      .filter((p) => p.status === "open" && p.marketId && p.question)
      .map((p) => ({
        marketId: p.marketId!,
        question: p.question!,
        action: p.action ?? "NO_BET",
        netEdge: p.netEdge ?? 0,
        stake: p.stake ?? 0,
        status: p.status ?? "open",
      }));
    paperOpen = paperPositions.filter(
      (p) => p.action === "BET_YES" || p.action === "BET_NO",
    ).length;
  } catch {
    paperOpen = 0;
    paperPositions = [];
  }

  const lastAskAt =
    quoteRows.map((r) => r.capturedAt).sort().at(-1) ?? null;
  const asksFresh =
    lastAskAt != null && nowMs - Date.parse(lastAskAt) <= 48 * 60 * 60 * 1000;

  const trading = platform.trading;
  const attention = buildAttention(
    open,
    platform.opportunities,
    asksFresh,
    platform.enrichment.lastEnrichAt,
  );

  const seedMeta = new Map<
    string,
    { therapeuticArea: string; sponsor: string }
  >();
  try {
    const seedRaw = JSON.parse(
      await readFile(path.join(fixturesRoot, "enrichment/seed-programs.json"), "utf8"),
    ) as {
      programs?: {
        slug?: string;
        therapeuticArea?: string;
        sponsorName?: string;
      }[];
    };
    for (const s of seedRaw.programs ?? []) {
      if (!s.slug) continue;
      seedMeta.set(s.slug, {
        therapeuticArea: s.therapeuticArea ?? "unknown",
        sponsor: s.sponsorName ?? "unknown",
      });
    }
  } catch {
    /* optional */
  }

  const portfolio = buildEdgeWeightedPortfolio({
    bankroll: book.bankroll,
    clinicalConviction: trading?.clinicalConviction ?? "demo",
    asksFresh,
    generatedAt: new Date().toISOString(),
    candidates: platform.opportunities.map((o) => {
      const meta = seedMeta.get(o.slug);
      const q = latest.get(o.polymarketId);
      const sideAskSize =
        o.action === "BET_NO" ? (q?.bestAskNoSize ?? null) : (q?.bestAskYesSize ?? null);
      const askStale =
        q?.capturedAt != null
          ? nowMs - Date.parse(q.capturedAt) > 48 * 60 * 60 * 1000
          : true;
      return {
        marketId: o.polymarketId,
        slug: o.slug,
        question: o.question,
        action: o.action,
        netEdge: o.netEdge,
        stake: o.stake,
        evidenceConfidence: o.evidenceConfidence,
        tradability: o.tradability,
        therapeuticArea: meta?.therapeuticArea ?? null,
        sponsor: meta?.sponsor ?? null,
        eventDeadline: o.eventDeadline,
        askSize: sideAskSize,
        askStale,
      };
    }),
  });

  const risk = buildPortfolioRiskReport({
    suggestion: portfolio,
    clinicalConviction: trading?.clinicalConviction ?? "demo",
    asksFresh,
    generatedAt: new Date().toISOString(),
    quotes: platform.opportunities.map((o) => {
      const q = latest.get(o.polymarketId);
      return {
        marketId: o.polymarketId,
        yesBestAsk: o.yesBestAsk,
        noBestAsk: o.noBestAsk,
        askSizeYes: q?.bestAskYesSize ?? null,
        askSizeNo: q?.bestAskNoSize ?? null,
        modelP: o.modelP,
        conservativeP: o.conservativeP,
      };
    }),
  });

  return {
    kind: "ops_dashboard",
    generatedAt: new Date().toISOString(),
    platform,
    trading,
    bankroll: book.bankroll,
    manual: { open, closed },
    paperOpen,
    paperPositions,
    portfolio,
    risk,
    attention,
    asksFresh,
    lastAskAt,
  };
}

/** Rebuild risk report with optional stake / scenario / probability mode (same live inputs). */
export async function buildOpsRiskReport(
  options: {
    evaluationStake?: number;
    stressScenarioId?: PortfolioRiskScenarioId;
    probabilityMode?: "conservative" | "model";
    fixturesRoot?: string;
  } = {},
): Promise<PortfolioRiskReport> {
  const fixturesRoot = options.fixturesRoot ?? defaultFixturesRoot();
  const dash = await buildOpsDashboard(fixturesRoot);
  const quoteRows = await loadQuoteArchive(fixturesRoot);
  const latest = latestQuotesByMarket(quoteRows);

  return buildPortfolioRiskReport({
    suggestion: dash.portfolio,
    clinicalConviction: dash.trading?.clinicalConviction ?? "demo",
    asksFresh: dash.asksFresh,
    probabilityMode: options.probabilityMode ?? "conservative",
    evaluationStake: options.evaluationStake,
    stressScenarioId: options.stressScenarioId ?? "fda_delay_year",
    quotes: dash.platform.opportunities.map((o) => {
      const q = latest.get(o.polymarketId);
      return {
        marketId: o.polymarketId,
        yesBestAsk: o.yesBestAsk,
        noBestAsk: o.noBestAsk,
        askSizeYes: q?.bestAskYesSize ?? null,
        askSizeNo: q?.bestAskNoSize ?? null,
        modelP: o.modelP,
        conservativeP: o.conservativeP,
      };
    }),
  });
}
