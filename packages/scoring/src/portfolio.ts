/**
 * Edge-weighted Ops portfolio suggestion (portfolio-policy@1).
 * Suggestion only — never places orders.
 */
import {
  DEFAULT_PORTFOLIO_POLICY,
  PortfolioSuggestionSchema,
  type PortfolioLine,
  type PortfolioPolicyConfig,
  type PortfolioSuggestion,
} from "@pivotaledge/schemas";

export type PortfolioCandidate = {
  marketId: string;
  slug: string;
  question: string;
  action: "BET_YES" | "BET_NO" | string;
  netEdge: number;
  stake: number;
  evidenceConfidence: string;
  tradability: string;
  therapeuticArea?: string | null;
  sponsor?: string | null;
  eventDeadline?: string | null;
  askSize?: number | null;
  askStale?: boolean;
};

function confidenceFactor(level: string): number {
  if (level === "high") return 1;
  if (level === "moderate" || level === "medium") return 0.7;
  return 0;
}

function deadlineCluster(iso: string | null | undefined): string {
  if (!iso) return "unknown";
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "unknown";
  const d = new Date(ms);
  const q = Math.floor(d.getUTCMonth() / 3) + 1;
  return `${d.getUTCFullYear()}-Q${q}`;
}

function liquidityFactor(
  askSize: number | null | undefined,
  config: PortfolioPolicyConfig,
): number {
  if (askSize == null || Number.isNaN(askSize)) return config.missingLiquidityFactor;
  if (config.minAskSize <= 0) return 1;
  return Math.min(1, Math.max(0, askSize / config.minAskSize));
}

export type BuildPortfolioInput = {
  candidates: PortfolioCandidate[];
  bankroll: number;
  clinicalConviction: "demo" | "calibrated";
  asksFresh: boolean;
  generatedAt?: string;
  config?: Partial<PortfolioPolicyConfig>;
};

/**
 * Build a deploy-this-week book from BET_* candidates with concentration caps.
 */
export function buildEdgeWeightedPortfolio(
  input: BuildPortfolioInput,
): PortfolioSuggestion {
  const config = {
    ...DEFAULT_PORTFOLIO_POLICY,
    ...input.config,
    policyVersion: "portfolio-policy@1" as const,
  };
  const bankroll = Math.max(1, input.bankroll);
  const deployBudget = bankroll * config.maxDeployFraction;
  const demoH = input.clinicalConviction === "demo" ? config.demoConvictionHaircut : 1;
  const excluded: PortfolioSuggestion["excluded"] = [];
  const scored: {
    c: PortfolioCandidate;
    side: "YES" | "NO";
    score: number;
    haircuts: string[];
    ta: string;
    sponsor: string | null;
    cluster: string;
  }[] = [];

  for (const c of input.candidates) {
    if (c.action !== "BET_YES" && c.action !== "BET_NO") {
      excluded.push({
        marketId: c.marketId,
        slug: c.slug,
        question: c.question,
        reason: `action_${c.action}`,
      });
      continue;
    }
    if (c.tradability !== "purchasable_now") {
      excluded.push({
        marketId: c.marketId,
        slug: c.slug,
        question: c.question,
        reason: "not_purchasable",
      });
      continue;
    }
    if (Math.abs(c.netEdge) < config.minNetEdge) {
      excluded.push({
        marketId: c.marketId,
        slug: c.slug,
        question: c.question,
        reason: "below_min_edge",
      });
      continue;
    }
    const conf = confidenceFactor(c.evidenceConfidence);
    if (conf <= 0) {
      excluded.push({
        marketId: c.marketId,
        slug: c.slug,
        question: c.question,
        reason: "low_evidence_confidence",
      });
      continue;
    }

    const haircuts: string[] = [];
    let hStale = 1;
    if (c.askStale || !input.asksFresh) {
      hStale = config.staleAskHaircut;
      haircuts.push("stale_ask");
    }
    if (demoH < 1) haircuts.push("demo_conviction");

    const liq = liquidityFactor(c.askSize, config);
    if (c.askSize == null) haircuts.push("missing_ask_size");

    const score = Math.abs(c.netEdge) * conf * liq * hStale * demoH;
    scored.push({
      c,
      side: c.action === "BET_YES" ? "YES" : "NO",
      score,
      haircuts,
      ta: (c.therapeuticArea && c.therapeuticArea.trim()) || "unknown",
      sponsor: c.sponsor?.trim() || null,
      cluster: deadlineCluster(c.eventDeadline),
    });
  }

  scored.sort((a, b) => b.score - a.score);
  const scoreSum = scored.reduce((s, x) => s + x.score, 0);

  const slugUsed = new Map<string, number>();
  const taUsed = new Map<string, number>();
  const clusterUsed = new Map<string, number>();
  const sponsorUsed = new Map<string, number>();

  const lines: PortfolioLine[] = [];
  let deployed = 0;

  for (const row of scored) {
    const { c, side, score, haircuts, ta, sponsor, cluster } = row;
    const share = scoreSum > 0 ? score / scoreSum : 0;
    const nameCap = bankroll * config.maxNameFraction;
    const fromDeploy = deployBudget * share;
    const uncapped = Math.min(nameCap, c.stake > 0 ? c.stake : nameCap, fromDeploy);

    const slugRoom =
      deployBudget * config.maxSlugFractionOfDeploy - (slugUsed.get(c.slug) ?? 0);
    const taRoom =
      deployBudget * config.maxTherapeuticAreaFractionOfDeploy - (taUsed.get(ta) ?? 0);
    const clusterRoom =
      deployBudget * config.maxDeadlineClusterFractionOfDeploy -
      (clusterUsed.get(cluster) ?? 0);
    const sponsorRoom = sponsor
      ? deployBudget * config.maxSponsorFractionOfDeploy - (sponsorUsed.get(sponsor) ?? 0)
      : Infinity;

    const budgetLeft = deployBudget - deployed;
    let suggested = Math.min(
      uncapped,
      Math.max(0, slugRoom),
      Math.max(0, taRoom),
      Math.max(0, clusterRoom),
      Math.max(0, sponsorRoom),
      Math.max(0, budgetLeft),
    );
    suggested = Math.round(suggested * 100) / 100;

    if (suggested < config.minLineNotional) {
      excluded.push({
        marketId: c.marketId,
        slug: c.slug,
        question: c.question,
        reason:
          uncapped >= config.minLineNotional
            ? "below_min_after_caps"
            : "below_min_line",
      });
      continue;
    }

    deployed += suggested;
    slugUsed.set(c.slug, (slugUsed.get(c.slug) ?? 0) + suggested);
    taUsed.set(ta, (taUsed.get(ta) ?? 0) + suggested);
    clusterUsed.set(cluster, (clusterUsed.get(cluster) ?? 0) + suggested);
    if (sponsor) sponsorUsed.set(sponsor, (sponsorUsed.get(sponsor) ?? 0) + suggested);

    lines.push({
      marketId: c.marketId,
      slug: c.slug,
      question: c.question,
      side,
      action: c.action as "BET_YES" | "BET_NO",
      netEdge: c.netEdge,
      score: Math.round(score * 1e6) / 1e6,
      uncappedNotional: Math.round(uncapped * 100) / 100,
      suggestedNotional: suggested,
      weightOfDeploy: deployBudget > 0 ? suggested / deployBudget : 0,
      therapeuticArea: ta,
      sponsor,
      deadlineCluster: cluster,
      eventDeadline: c.eventDeadline ?? null,
      haircuts,
      evidenceConfidence: c.evidenceConfidence,
      href: `/ops/market/${c.marketId}`,
    });
  }

  const notes = [
    `Deploy budget = ${(config.maxDeployFraction * 100).toFixed(0)}% of bankroll ($${deployBudget.toFixed(0)}).`,
    `Per-name cap ${(config.maxNameFraction * 100).toFixed(0)}% bankroll; slug ≤${(config.maxSlugFractionOfDeploy * 100).toFixed(0)}% / TA ≤${(config.maxTherapeuticAreaFractionOfDeploy * 100).toFixed(0)}% / deadline-quarter ≤${(config.maxDeadlineClusterFractionOfDeploy * 100).toFixed(0)}% of deploy.`,
    "Suggestion only — place fills on Polymarket yourself, then Log fill in Book.",
  ];
  if (input.clinicalConviction === "demo") {
    notes.push("DEMO conviction: all scores haircut 50%.");
  }
  if (!input.asksFresh) {
    notes.push("Asks stale: scores haircut 50% — Snapshot asks before sizing.");
  }

  return PortfolioSuggestionSchema.parse({
    kind: "ops_portfolio_suggestion",
    policyVersion: "portfolio-policy@1",
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    bankroll,
    deployBudget: Math.round(deployBudget * 100) / 100,
    deployed: Math.round(deployed * 100) / 100,
    cashReserve: Math.round((deployBudget - deployed) * 100) / 100,
    clinicalConviction: input.clinicalConviction,
    asksFresh: input.asksFresh,
    lineCount: lines.length,
    lines,
    excluded,
    notes,
    riskStatement:
      "Edge-weighted caps reduce concentration in one name or one TA/deadline cluster. They do not remove shared regulatory or calendar risk. Correlated FDA clocks can still move together.",
  });
}

export { DEFAULT_PORTFOLIO_POLICY };
export type { PortfolioPolicyConfig, PortfolioSuggestion };
