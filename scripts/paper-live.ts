#!/usr/bin/env tsx
/**
 * Open prospective paper positions from latest quote vault + clinical KG.
 * Does not resolve PnL until markets settle. liveTradingEnabled always false.
 * Writes fixtures/evals/live-paper-report.json + trading-readiness-report.json.
 *
 * Usage:
 *   pnpm quotes:snapshot && pnpm paper:live
 */
import { config } from "dotenv";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  latestQuotesByMarket,
  loadQuoteArchive,
  summarizeQuoteVault,
  type EnrichSeedProgram,
} from "@pivotaledge/adapters";
import {
  holdoutCorpusFromPrograms,
  runClinicalChronoCalibration,
} from "@pivotaledge/evals";
import {
  evaluateChronologicalHoldout,
  fitCalibrationWeights,
  MODEL_VERSION,
  predictHoldoutCase,
  probabilityInterval,
} from "@pivotaledge/models";
import {
  TradingReadinessReportSchema,
  defaultFixturesRoot,
  loadClinicalCalibrationCorpus,
  loadProgramFixture,
  type ProgramFixture,
  type TradingReadinessReport,
} from "@pivotaledge/schemas";
import {
  decideBetAction,
  DEFAULT_BETTING_POLICY,
  stakeFraction,
  type EdgeEstimate,
  type RiskAssessment,
} from "@pivotaledge/scoring";

config();

type SeedFile = { programs: EnrichSeedProgram[] };

async function loadResolvedPrograms(root: string): Promise<ProgramFixture[]> {
  const dirs = ["approved", "crl", "corpus", "corpus/retrospective", "corpus/live"];
  const out: ProgramFixture[] = [];
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

function findFixture(programs: ProgramFixture[], seed: EnrichSeedProgram): ProgramFixture | null {
  return (
    programs.find((p) => p.program.id === `prog_${seed.slug.replace(/-/g, "_")}`) ??
    programs.find((p) => p.drugAsset.preferredName.toLowerCase() === seed.preferredName.toLowerCase()) ??
    null
  );
}

function risksFromFixture(fixture: ProgramFixture): RiskAssessment {
  const trial = fixture.trials[0];
  return {
    evidenceConfidence:
      fixture.designations.length > 0 || (trial?.biomarkerEnriched ?? false) ? "moderate" : "moderate",
    resolutionRisk: "moderate",
    latentInformationRisk: (trial?.actualEnrollment ?? 0) >= 50 ? "low" : "moderate",
  };
}

async function main() {
  const root = defaultFixturesRoot();
  const seed = JSON.parse(
    await readFile(path.join(root, "enrichment/seed-programs.json"), "utf8"),
  ) as SeedFile;

  const clinicalCorpus = await loadClinicalCalibrationCorpus();
  const clinical = runClinicalChronoCalibration(clinicalCorpus, { minTrainCases: 8 });
  const weights = fitCalibrationWeights(
    clinicalCorpus.cases.map((c) => ({
      caseId: c.caseId,
      forecastCutoff: c.forecastCutoff,
      phase: c.phase,
      therapeuticArea: c.therapeuticArea,
      primaryEndpointMet: c.primaryEndpointMet,
      applicationFiled: c.applicationFiled,
      resolvedApproved: c.resolvedApproved,
      biomarkerEnriched: c.biomarkerEnriched,
      orphanDesignated: c.orphanDesignated,
      priorApprovalCount: c.priorApprovalCount,
      designationCount: c.designationCount,
      enrollmentRatio: c.enrollmentRatio,
      trialStatus: c.trialStatus,
      endpointFamily: c.endpointFamily,
    })),
  );

  const programs = await loadResolvedPrograms(root);
  const kgHoldout = holdoutCorpusFromPrograms(programs);
  const kgEval = evaluateChronologicalHoldout(kgHoldout, {
    minTrainCases: Math.min(3, Math.max(2, kgHoldout.cases.length - 2)),
  });

  const quoteRows = await loadQuoteArchive(root);
  const vault = summarizeQuoteVault(quoteRows, root);
  const latest = latestQuotesByMarket(quoteRows);

  const config = DEFAULT_BETTING_POLICY;
  let bankroll = 10_000;
  const positions: Record<string, unknown>[] = [];

  for (const s of seed.programs) {
    const fixture = findFixture(programs, s);
    if (!fixture) continue;
    const trial = fixture.trials[0];
    const pe = fixture.trialResults[0]?.primaryEndpointMet;
    if (pe == null || !trial) continue;

    for (const marketId of s.polymarketMarketIds) {
      const quote = latest.get(marketId);
      if (!quote || quote.bestAskYes == null || quote.bestAskNo == null) continue;

      const modelP = predictHoldoutCase(
        {
          phase: trial.phase,
          therapeuticArea: fixture.indication.therapeuticArea,
          primaryEndpointMet: pe,
          applicationFiled: fixture.application != null,
          biomarkerEnriched: trial.biomarkerEnriched,
          orphanDesignated: fixture.designations.some((d) => d.designationType === "orphan"),
          priorApprovalCount: fixture.priorApprovals.length,
          designationCount: fixture.designations.length,
          enrollmentRatio:
            trial.plannedEnrollment && trial.plannedEnrollment > 0 && trial.actualEnrollment != null
              ? trial.actualEnrollment / trial.plannedEnrollment
              : null,
          trialStatus: trial.status,
          endpointFamily: fixture.endpoints[0]?.endpointFamily ?? null,
        },
        weights,
      );
      const interval = probabilityInterval(modelP, fixture.trialResults.length + fixture.designations.length);
      const edge: EdgeEstimate = {
        executableYesPrice: quote.bestAskYes,
        executableNoPrice: quote.bestAskNo,
        netEdgeYes: interval.low - quote.bestAskYes - config.feeRate,
        netEdgeNo: 1 - interval.high - quote.bestAskNo - config.feeRate,
        marketImpliedProbability: quote.bestAskYes,
        marketAdjustedProbability: modelP * 0.85 + quote.bestAskYes * 0.15,
      };
      const decision = decideBetAction(edge, risksFromFixture(fixture), config);
      let stake = 0;
      if (decision.action === "BET_YES" || decision.action === "BET_NO") {
        const fraction = stakeFraction(decision.netEdge, config);
        stake = Math.round(bankroll * fraction * 100) / 100;
      }

      positions.push({
        marketId,
        slug: s.slug,
        question: quote.question ?? null,
        quoteCapturedAt: quote.capturedAt,
        yesAsk: quote.bestAskYes,
        noAsk: quote.bestAskNo,
        yesAskSize: quote.bestAskYesSize,
        noAskSize: quote.bestAskNoSize,
        modelP,
        conservativeP: interval.low,
        action: decision.action,
        netEdge: decision.netEdge,
        stake,
        status: "open",
        simulation: true,
        clinicalConviction: "demo" as const,
      });
    }
  }

  const seedMarketCount = new Set(seed.programs.flatMap((p) => p.polymarketMarketIds)).size;
  const captureDays = new Set(quoteRows.map((r) => r.capturedAt.slice(0, 10)));
  const sortedCaptures = quoteRows.map((r) => r.capturedAt).sort();
  const firstCapture = sortedCaptures[0] ?? null;
  const lastCapture = sortedCaptures.at(-1) ?? null;
  const spanDays =
    firstCapture && lastCapture
      ? Math.floor(
          (Date.parse(lastCapture) - Date.parse(firstCapture)) / (24 * 60 * 60 * 1000),
        )
      : 0;

  // Freshness: latest vault row per seeded market within 48h (FDA books move slowly).
  const nowMs = Date.now();
  const maxStaleMs = 48 * 60 * 60 * 1000;
  let staleMarkets = 0;
  for (const marketId of seed.programs.flatMap((p) => p.polymarketMarketIds)) {
    const q = latestQuotesByMarket(quoteRows).get(marketId);
    if (!q || nowMs - Date.parse(q.capturedAt) > maxStaleMs) staleMarkets += 1;
  }
  const quotesFresh = staleMarkets === 0 && vault.distinctMarkets >= seedMarketCount;

  const blockers: string[] = [];
  if (!clinical.beatsBaseRate) blockers.push("clinical chrono does not beat base-rate Brier");
  if (clinical.totalCases < 40) blockers.push("clinical corpus < 40 cases");
  if (clinical.testCases < 20) blockers.push("clinical OOS < 20");
  if (!kgEval.beatsBaseRate) blockers.push("KG holdout does not beat base-rate Brier");
  if (kgHoldout.cases.length < 15) blockers.push("KG holdout cases < 15");
  if (vault.totalRows < seedMarketCount) {
    blockers.push(
      `quote vault needs ≥1 snapshot per seeded market (have ${vault.totalRows}, need ≥${seedMarketCount})`,
    );
  }
  if (vault.distinctMarkets < seedMarketCount) {
    blockers.push(`quote vault missing markets (${vault.distinctMarkets}/${seedMarketCount})`);
  }
  if (!quotesFresh) {
    blockers.push(
      `seeded market asks stale or missing (>48h): ${staleMarkets} — run pnpm quotes:snapshot`,
    );
  }

  // Conviction = clinical model ready + executable asks in hand.
  // Multi-day vault depth is tracked for later edge-vs-market proof, not as a wait gate
  // (FDA Polymarket books and clinical labels do not refresh on a daily cadence).
  const calibratedConviction =
    clinical.totalCases >= 80 &&
    clinical.beatsBaseRate &&
    kgEval.beatsBaseRate &&
    kgHoldout.cases.length >= 15 &&
    quotesFresh;

  if (clinical.totalCases < 80) {
    blockers.push(`clinical corpus < 80 cases (have ${clinical.totalCases})`);
  }
  if (!calibratedConviction && quotesFresh && clinical.totalCases >= 80) {
    blockers.push("clinical/KG gates incomplete for calibrated conviction");
  }

  // Live-book contract coverage (informational for edge identification; not a Bar A gate).
  let liveContractSummary: {
    reportAt: string | null;
    total: number;
    complete: number;
    partial: number;
    blocked: number;
    betCandidatesBlocked: number;
  } | null = null;
  try {
    const liveRaw = JSON.parse(
      await readFile(path.join(root, "enrichment/live-score-report.json"), "utf8"),
    ) as {
      at?: string;
      opportunities?: Array<{
        action?: string;
        contractCoverage?: "complete" | "partial" | "blocked";
        calibrationBlocked?: boolean;
        polymarketId?: string;
      }>;
    };
    const opps = liveRaw.opportunities ?? [];
    const hasContractFields = opps.some((o) => o.contractCoverage != null);
    if (!hasContractFields && opps.length > 0) {
      blockers.push("live score report missing contract fields — run pnpm kg:score-live");
    } else if (opps.length > 0) {
      const complete = opps.filter((o) => o.contractCoverage === "complete").length;
      const partial = opps.filter((o) => o.contractCoverage === "partial").length;
      const blocked = opps.filter(
        (o) => o.contractCoverage === "blocked" || o.calibrationBlocked,
      ).length;
      const betCandidatesBlocked = opps.filter(
        (o) =>
          (o.action === "BET_YES" || o.action === "BET_NO") &&
          (o.contractCoverage === "blocked" || o.calibrationBlocked),
      ).length;
      liveContractSummary = {
        reportAt: liveRaw.at ?? null,
        total: opps.length,
        complete,
        partial,
        blocked,
        betCandidatesBlocked,
      };
      if (betCandidatesBlocked > 0) {
        blockers.push(
          `live book: ${betCandidatesBlocked} BET_* candidate(s) contract-blocked (edge identification gated)`,
        );
      }
    }
  } catch {
    blockers.push("live score report missing — run pnpm kg:score-live");
  }

  const openBets = positions.filter(
    (p) => p.action === "BET_YES" || p.action === "BET_NO",
  ).length;

  for (const p of positions) {
    (p as { clinicalConviction: "demo" | "calibrated" }).clinicalConviction = calibratedConviction
      ? "calibrated"
      : "demo";
  }

  const readiness: TradingReadinessReport = TradingReadinessReportSchema.parse({
    kind: "trading_readiness_report",
    generatedAt: new Date().toISOString(),
    clinicalConviction: calibratedConviction ? "calibrated" : "demo",
    liveTradingEnabled: false,
    checks: {
      clinicalBeatsBaseRate: clinical.beatsBaseRate,
      clinicalCases: clinical.totalCases,
      clinicalOos: clinical.testCases,
      kgHoldoutBeatsBaseRate: kgEval.beatsBaseRate,
      kgHoldoutCases: kgHoldout.cases.length,
      quoteVaultRows: vault.totalRows,
      quoteVaultMarkets: vault.distinctMarkets,
      quoteVaultMinRows:
        vault.totalRows >= seedMarketCount && vault.distinctMarkets >= seedMarketCount,
      quoteVaultDistinctDays: captureDays.size,
      quoteVaultSpanDays: spanDays,
      quoteVaultFresh: quotesFresh,
      openPaperPositions: positions.length,
      openBetActions: openBets,
    },
    blockers,
    paperReady:
      clinical.beatsBaseRate &&
      kgEval.beatsBaseRate &&
      vault.totalRows >= seedMarketCount &&
      vault.distinctMarkets >= seedMarketCount &&
      quotesFresh,
    notes:
      "Calibrated conviction = clinical+KG beat base rate (≥80 chrono / ≥15 KG holdout) with fresh executable asks (≤48h). Multi-day vault depth is informational for eventual market-edge proof — FDA books do not need daily novelty. Live trading stays off until resolved prospective PnL + execution adapter.",
  });

  await mkdir(path.join(root, "evals"), { recursive: true });
  const paperPath = path.join(root, "evals/live-paper-report.json");
  await writeFile(
    paperPath,
    `${JSON.stringify(
      {
        kind: "live_paper_open_positions",
        generatedAt: new Date().toISOString(),
        modelVersion: MODEL_VERSION,
        policyVersion: config.policyVersion,
        bankroll,
        liveTradingEnabled: false,
        positions,
        readiness,
        quoteVault: {
          totalRows: vault.totalRows,
          distinctMarkets: vault.distinctMarkets,
          latestCapturedAt: vault.latestCapturedAt,
        },
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  await writeFile(
    path.join(root, "evals/trading-readiness-report.json"),
    `${JSON.stringify(readiness, null, 2)}\n`,
    "utf8",
  );

  console.log(
    JSON.stringify(
      {
        positions: positions.length,
        openBets,
        paperReady: readiness.paperReady,
        clinicalConviction: readiness.clinicalConviction,
        blockers: readiness.blockers,
        liveContract: liveContractSummary,
        quoteVaultRows: vault.totalRows,
        report: "fixtures/evals/live-paper-report.json",
      },
      null,
      2,
    ),
  );

  if (!readiness.checks.quoteVaultMinRows) {
    console.error("\nRun `pnpm quotes:snapshot` first to populate the quote vault.");
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
