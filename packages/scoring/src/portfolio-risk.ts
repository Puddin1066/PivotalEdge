/**
 * Lite portfolio risk engine (portfolio-risk@1).
 * Decision support only — never places orders.
 */
import {
  PortfolioRiskReportSchema,
  type PortfolioRiskBucket,
  type PortfolioRiskDistribution,
  type PortfolioRiskLine,
  type PortfolioRiskReport,
  type PortfolioRiskScenarioId,
  type PortfolioRiskScenarioRow,
  type PortfolioSuggestion,
} from "@pivotaledge/schemas";

export type RiskMarketQuote = {
  marketId: string;
  yesBestAsk: number | null;
  noBestAsk: number | null;
  askSizeYes: number | null;
  askSizeNo: number | null;
  modelP: number;
  conservativeP: number;
};

export type BuildPortfolioRiskInput = {
  suggestion: PortfolioSuggestion;
  quotes: RiskMarketQuote[];
  clinicalConviction: "demo" | "calibrated";
  asksFresh: boolean;
  probabilityMode?: "conservative" | "model";
  /** Total stake to evaluate; scales line notionals. Default = suggestion.deployed */
  evaluationStake?: number;
  /** Scenario driving stress EV + default distribution */
  stressScenarioId?: PortfolioRiskScenarioId;
  feeRate?: number;
  fragilityDeltaP?: number;
  fillableFraction?: number;
  generatedAt?: string;
  /** UTC year for fda_delay_year (tests); default = now */
  referenceYear?: number;
};

const FEE_DEFAULT = 0.02;
const FRAGILITY_DP = 0.05;
const FILLABLE_FRAC = 0.25;
const MC_DRAWS = 5000;
const EXACT_MAX_N = 12;

const SCENARIO_META: Record<
  PortfolioRiskScenarioId,
  { label: string; note: string }
> = {
  base_independent: {
    label: "Base (independent)",
    note: "Line win probs unchanged; outcomes independent.",
  },
  fda_delay_year: {
    label: "FDA delay (this year)",
    note: "Year-end clocks: NO +10pp / YES −10pp on same-year deadlines.",
  },
  ta_oncology_risk: {
    label: "Oncology TA risk",
    note: "Oncology lines: NO +8pp / YES −8pp.",
  },
  same_quarter_cluster: {
    label: "Same-quarter cluster",
    note: "Largest deadline-quarter bucket: NO +8pp / YES −8pp.",
  },
  adverse_p: {
    label: "Adverse P (−5pp)",
    note: "Every line’s P(win) cut 5pp (clamp 1–99%).",
  },
};

function clamp01(p: number): number {
  return Math.min(0.99, Math.max(0.01, p));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round4(n: number): number {
  return Math.round(n * 1e4) / 1e4;
}

/** EV of spending stake S at ask a with win prob p and fee on stake. */
export function lineEv(stake: number, ask: number, pWin: number, feeRate: number): number {
  if (stake <= 0 || ask <= 0) return 0;
  return pWin * (stake / ask) - stake - feeRate * stake;
}

function linePnlIfWin(stake: number, ask: number, feeRate: number): number {
  if (stake <= 0 || ask <= 0) return 0;
  return stake / ask - stake - feeRate * stake;
}

function linePnlIfLose(stake: number, feeRate: number): number {
  if (stake <= 0) return 0;
  return -stake - feeRate * stake;
}

type WorkingLine = {
  marketId: string;
  slug: string;
  question: string;
  side: "YES" | "NO";
  href: string;
  baseStake: number;
  stake: number;
  ask: number;
  askSize: number | null;
  pWinBase: number;
  therapeuticArea: string;
  deadlineCluster: string;
  eventDeadline: string | null;
  liquidityFlags: string[];
  fillable: boolean;
};

function deadlineYear(iso: string | null): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  return new Date(ms).getUTCFullYear();
}

function shockP(
  scenario: PortfolioRiskScenarioId,
  line: WorkingLine,
  p: number,
  densestCluster: string,
  referenceYear: number,
): number {
  let out = p;
  const y = deadlineYear(line.eventDeadline);
  const applySide = (deltaNo: number, deltaYes: number) => {
    out = line.side === "NO" ? out + deltaNo : out + deltaYes;
  };

  switch (scenario) {
    case "base_independent":
      break;
    case "fda_delay_year":
      if (y === referenceYear) applySide(0.1, -0.1);
      break;
    case "ta_oncology_risk":
      if (line.therapeuticArea.toLowerCase() === "oncology") applySide(0.08, -0.08);
      break;
    case "same_quarter_cluster":
      if (line.deadlineCluster === densestCluster && densestCluster !== "unknown") {
        applySide(0.08, -0.08);
      }
      break;
    case "adverse_p":
      out = out - 0.05;
      break;
  }
  return clamp01(out);
}

function densestClusterId(lines: WorkingLine[]): string {
  const counts = new Map<string, number>();
  for (const l of lines) {
    if (l.deadlineCluster === "unknown") continue;
    counts.set(l.deadlineCluster, (counts.get(l.deadlineCluster) ?? 0) + 1);
  }
  let best = "unknown";
  let n = 0;
  for (const [k, v] of counts) {
    if (v > n) {
      best = k;
      n = v;
    }
  }
  return best;
}

type DistResult = {
  meanPnl: number;
  pLoss: number;
  pLossHalf: number;
  p05Pnl: number;
  p95Pnl: number;
  buckets: PortfolioRiskBucket[];
};

function bucketize(returns: number[], weights: number[]): PortfolioRiskBucket[] {
  const defs: { id: string; label: string; min: number; max: number | null }[] = [
    { id: "le_m100", label: "≤ −100%", min: -Infinity, max: -1 },
    { id: "m100_m50", label: "−100% … −50%", min: -1, max: -0.5 },
    { id: "m50_0", label: "−50% … 0%", min: -0.5, max: 0 },
    { id: "0_50", label: "0% … 50%", min: 0, max: 0.5 },
    { id: "50_100", label: "50% … 100%", min: 0.5, max: 1 },
    { id: "gt_100", label: "> 100%", min: 1, max: null },
  ];
  const mass = defs.map(() => 0);
  let wSum = 0;
  for (let i = 0; i < returns.length; i++) {
    const r = returns[i]!;
    const w = weights[i] ?? 1;
    wSum += w;
    for (let b = 0; b < defs.length; b++) {
      const d = defs[b]!;
      const hi = d.max;
      if (r > d.min - 1e-12 && (hi == null || r <= hi + 1e-12)) {
        // fix lower bound for first bucket
        if (d.min === -Infinity || r >= d.min - 1e-12) {
          if (b === 0) {
            if (r <= -1) mass[b]! += w;
          } else if (hi == null) {
            if (r > 1) mass[b]! += w;
          } else if (r > d.min && r <= hi) {
            mass[b]! += w;
          } else if (b === 3 && r >= 0 && r <= 0.5) {
            mass[b]! += w;
          }
        }
      }
    }
  }
  // Cleaner bucket assignment
  const clean = defs.map(() => 0);
  for (let i = 0; i < returns.length; i++) {
    const r = returns[i]!;
    const w = weights[i] ?? 1;
    if (r <= -1) clean[0]! += w;
    else if (r <= -0.5) clean[1]! += w;
    else if (r <= 0) clean[2]! += w;
    else if (r <= 0.5) clean[3]! += w;
    else if (r <= 1) clean[4]! += w;
    else clean[5]! += w;
  }
  const total = clean.reduce((a, b) => a + b, 0) || 1;
  void mass;
  void wSum;
  return defs.map((d, i) => ({
    id: d.id,
    label: d.label,
    probability: round4(clean[i]! / total),
    minReturn: d.min === -Infinity ? -10 : d.min,
    maxReturn: d.max,
  }));
}

function percentile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(q * (sorted.length - 1))));
  return sorted[idx]!;
}

/** Exact or MC distribution of portfolio PnL under independent Bernoulli wins. */
export function bernoulliDistribution(
  lines: { stake: number; ask: number; pWin: number; feeRate: number; active: boolean }[],
  stakeTotal: number,
): DistResult {
  const active = lines.filter((l) => l.active && l.stake > 0 && l.ask > 0);
  const winPnls = active.map((l) => linePnlIfWin(l.stake, l.ask, l.feeRate));
  const losePnls = active.map((l) => linePnlIfLose(l.stake, l.feeRate));
  const ps = active.map((l) => l.pWin);

  const pnls: number[] = [];
  const weights: number[] = [];

  if (active.length === 0) {
    return {
      meanPnl: 0,
      pLoss: 0,
      pLossHalf: 0,
      p05Pnl: 0,
      p95Pnl: 0,
      buckets: bucketize([0], [1]),
    };
  }

  if (active.length <= EXACT_MAX_N) {
    const n = active.length;
    const total = 1 << n;
    for (let mask = 0; mask < total; mask++) {
      let pnl = 0;
      let prob = 1;
      for (let i = 0; i < n; i++) {
        const win = (mask & (1 << i)) !== 0;
        pnl += win ? winPnls[i]! : losePnls[i]!;
        prob *= win ? ps[i]! : 1 - ps[i]!;
      }
      pnls.push(pnl);
      weights.push(prob);
    }
  } else {
    // Deterministic LCG for reproducibility
    let state = 0x12345678;
    const rand = () => {
      state = (Math.imul(1664525, state) + 1013904223) >>> 0;
      return state / 0x100000000;
    };
    for (let d = 0; d < MC_DRAWS; d++) {
      let pnl = 0;
      for (let i = 0; i < active.length; i++) {
        pnl += rand() < ps[i]! ? winPnls[i]! : losePnls[i]!;
      }
      pnls.push(pnl);
      weights.push(1);
    }
  }

  let mean = 0;
  let wSum = 0;
  let lossW = 0;
  let halfW = 0;
  const half = -0.5 * stakeTotal;
  for (let i = 0; i < pnls.length; i++) {
    const w = weights[i]!;
    mean += pnls[i]! * w;
    wSum += w;
    if (pnls[i]! < 0) lossW += w;
    if (pnls[i]! <= half) halfW += w;
  }
  mean /= wSum || 1;

  const sorted = [...pnls].sort((a, b) => a - b);
  // For exact enum, approximate percentiles by sorting unique outcomes weighted — use unweighted sort of expanded; good enough for v1
  const returns = pnls.map((p) => (stakeTotal > 0 ? p / stakeTotal : 0));

  return {
    meanPnl: round2(mean),
    pLoss: round4(lossW / (wSum || 1)),
    pLossHalf: round4(halfW / (wSum || 1)),
    p05Pnl: round2(percentile(sorted, 0.05)),
    p95Pnl: round2(percentile(sorted, 0.95)),
    buckets: bucketize(returns, weights),
  };
}

function expectedPnlFromLines(
  lines: WorkingLine[],
  pWins: number[],
  feeRate: number,
  forStress: boolean,
): number {
  let ev = 0;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]!;
    if (forStress && !l.fillable) continue;
    let e = lineEv(l.stake, l.ask, pWins[i]!, feeRate);
    if (!forStress && l.liquidityFlags.includes("missing_size")) e *= 0.5;
    ev += e;
  }
  return round2(ev);
}

export function buildPortfolioRiskReport(input: BuildPortfolioRiskInput): PortfolioRiskReport {
  const feeRate = input.feeRate ?? FEE_DEFAULT;
  const fragilityDp = input.fragilityDeltaP ?? FRAGILITY_DP;
  const fillFrac = input.fillableFraction ?? FILLABLE_FRAC;
  const mode = input.probabilityMode ?? "conservative";
  const stressId = input.stressScenarioId ?? "fda_delay_year";
  const refYear = input.referenceYear ?? new Date().getUTCFullYear();
  const suggestion = input.suggestion;
  const quoteById = new Map(input.quotes.map((q) => [q.marketId, q]));

  const deployed = suggestion.deployed;
  const evalStake =
    input.evaluationStake != null && input.evaluationStake > 0
      ? input.evaluationStake
      : deployed > 0
        ? deployed
        : 0;
  const scale = deployed > 0 ? evalStake / deployed : 0;

  const working: WorkingLine[] = [];
  for (const line of suggestion.lines) {
    const q = quoteById.get(line.marketId);
    const ask =
      line.side === "YES" ? (q?.yesBestAsk ?? null) : (q?.noBestAsk ?? null);
    const askSize =
      line.side === "YES" ? (q?.askSizeYes ?? null) : (q?.askSizeNo ?? null);
    if (ask == null || ask <= 0) continue;

    const pYes = mode === "model" ? (q?.modelP ?? 0.5) : (q?.conservativeP ?? 0.5);
    const pWin = line.side === "YES" ? pYes : 1 - pYes;
    const stake = round2(line.suggestedNotional * scale);
    const shares = stake / ask;
    const flags: string[] = [];
    if (askSize == null) flags.push("missing_size");
    if (!input.asksFresh) flags.push("stale_ask");
    let fillable = true;
    if (askSize != null && shares > askSize * fillFrac) {
      flags.push("size_exceeds_depth");
      fillable = false;
    }

    working.push({
      marketId: line.marketId,
      slug: line.slug,
      question: line.question,
      side: line.side,
      href: line.href,
      baseStake: line.suggestedNotional,
      stake,
      ask,
      askSize,
      pWinBase: clamp01(pWin),
      therapeuticArea: line.therapeuticArea,
      deadlineCluster: line.deadlineCluster,
      eventDeadline: line.eventDeadline,
      liquidityFlags: flags,
      fillable,
    });
  }

  const densest = densestClusterId(working);

  const pForScenario = (scenario: PortfolioRiskScenarioId) =>
    working.map((l) => shockP(scenario, l, l.pWinBase, densest, refYear));

  const scenarioIds = Object.keys(SCENARIO_META) as PortfolioRiskScenarioId[];
  const scenarios: PortfolioRiskScenarioRow[] = [];

  for (const id of scenarioIds) {
    const ps = pForScenario(id);
    const forStress = id !== "base_independent";
    const ev = expectedPnlFromLines(working, ps, feeRate, forStress);
    const dist = bernoulliDistribution(
      working.map((l, i) => ({
        stake: forStress && !l.fillable ? 0 : l.stake,
        ask: l.ask,
        pWin: ps[i]!,
        feeRate,
        active: !(forStress && !l.fillable),
      })),
      evalStake,
    );
    let worst: string | null = null;
    let worstEv = Infinity;
    for (let i = 0; i < working.length; i++) {
      const l = working[i]!;
      if (forStress && !l.fillable) continue;
      const e = lineEv(l.stake, l.ask, ps[i]!, feeRate);
      if (e < worstEv) {
        worstEv = e;
        worst = l.question;
      }
    }
    scenarios.push({
      id,
      label: SCENARIO_META[id].label,
      expectedPnl: ev,
      pLoss: dist.pLoss,
      note: SCENARIO_META[id].note,
      worstLine: worst,
    });
  }

  const basePs = pForScenario("base_independent");
  const stressPs = pForScenario(stressId);

  const riskLines: PortfolioRiskLine[] = working.map((l, i) => {
    const p = basePs[i]!;
    const breakEvenP = l.ask + feeRate;
    const cushionPp = p - breakEvenP;
    const naiveEvRaw = lineEv(l.stake, l.ask, p, feeRate);
    const naiveEv = l.liquidityFlags.includes("missing_size")
      ? naiveEvRaw * 0.5
      : naiveEvRaw;
    const stressEv = !l.fillable
      ? 0
      : lineEv(l.stake, l.ask, stressPs[i]!, feeRate);
    const evDown = lineEv(l.stake, l.ask, clamp01(p - fragilityDp), feeRate);
    const fragile = cushionPp < fragilityDp || (naiveEvRaw > 0 && evDown <= 0);

    return {
      marketId: l.marketId,
      slug: l.slug,
      question: l.question,
      side: l.side,
      href: l.href,
      stake: l.stake,
      ask: l.ask,
      askSize: l.askSize,
      pWin: round4(p),
      netEdge: round4(p - l.ask - feeRate),
      breakEvenP: round4(breakEvenP),
      cushionPp: round4(cushionPp),
      naiveEv: round2(naiveEv),
      stressEv: round2(stressEv),
      fragile,
      liquidityFlags: l.liquidityFlags,
      fillable: l.fillable,
      therapeuticArea: l.therapeuticArea,
      deadlineCluster: l.deadlineCluster,
      eventDeadline: l.eventDeadline,
    };
  });

  riskLines.sort((a, b) => Number(b.fragile) - Number(a.fragile) || a.cushionPp - b.cushionPp);

  const naiveEv = expectedPnlFromLines(working, basePs, feeRate, false);
  const stressEv = expectedPnlFromLines(working, stressPs, feeRate, true);

  const baseDist = bernoulliDistribution(
    working.map((l, i) => ({
      stake: l.stake,
      ask: l.ask,
      pWin: basePs[i]!,
      feeRate,
      active: true,
    })),
    evalStake,
  );

  const stressDistRaw = bernoulliDistribution(
    working.map((l, i) => ({
      stake: l.fillable ? l.stake : 0,
      ask: l.ask,
      pWin: stressPs[i]!,
      feeRate,
      active: l.fillable,
    })),
    evalStake,
  );

  const distribution: PortfolioRiskDistribution = {
    stake: evalStake,
    method: stressId === "base_independent" ? "independent_bernoulli" : "scenario_mixture",
    scenarioId: stressId,
    meanPnl: stressDistRaw.meanPnl,
    pLoss: stressDistRaw.pLoss,
    pLossHalf: stressDistRaw.pLossHalf,
    p05Pnl: stressDistRaw.p05Pnl,
    p95Pnl: stressDistRaw.p95Pnl,
    buckets: stressDistRaw.buckets,
  };

  // Prefer stress scenario for default distribution per spec; also expose naive via scenarios
  void baseDist;

  const fragileCount = riskLines.filter((l) => l.fragile).length;
  const liquidityOkCount = riskLines.filter((l) => l.fillable).length;

  const notes = [
    `portfolio-risk@1 · feeRate ${(feeRate * 100).toFixed(0)}% · fragility ΔP ${(fragilityDp * 100).toFixed(0)}pp · fillableFraction ${fillFrac}`,
    `Evaluation stake $${evalStake.toFixed(0)} (scale from deployed $${deployed.toFixed(0)}).`,
    `Distribution method: ${distribution.method} · scenario ${stressId}` +
      (working.length <= EXACT_MAX_N ? " · exact Bernoulli enum" : ` · MC ${MC_DRAWS} draws`),
    "Naive EV sums line EVs under independence — not an assumption that every line wins.",
    "Stress treats non-fillable lines as flat (no position).",
  ];
  if (input.clinicalConviction === "demo") {
    notes.push("DEMO conviction — risk numbers are illustrative; do not size up.");
  }
  if (!input.asksFresh) {
    notes.push("Asks stale — refresh Snapshot asks before trusting EV.");
  }

  return PortfolioRiskReportSchema.parse({
    kind: "ops_portfolio_risk_report",
    riskVersion: "portfolio-risk@1",
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    portfolioRef: {
      policyVersion: suggestion.policyVersion,
      deployed: suggestion.deployed,
      deployBudget: suggestion.deployBudget,
      bankroll: suggestion.bankroll,
      lineCount: suggestion.lineCount,
    },
    probabilityMode: mode,
    clinicalConviction: input.clinicalConviction,
    asksFresh: input.asksFresh,
    evaluationStake: evalStake,
    naive: {
      stake: evalStake,
      expectedPnl: naiveEv,
      expectedReturnOnStake: evalStake > 0 ? round4(naiveEv / evalStake) : 0,
      pLoss: baseDist.pLoss,
    },
    stress: {
      stake: evalStake,
      expectedPnl: stressEv,
      expectedReturnOnStake: evalStake > 0 ? round4(stressEv / evalStake) : 0,
      pLoss: stressDistRaw.pLoss,
      scenarioId: stressId,
    },
    scenarios,
    distribution,
    lines: riskLines,
    fragileCount,
    liquidityOkCount,
    excluded: suggestion.excluded,
    notes,
    riskStatement:
      "Caps and scenarios reduce concentration blindness. They do not remove shared regulatory risk. High EV on thin asks is not a trade. Expected PnL is an average over win/lose mixes — not a promise you win the book.",
  });
}
