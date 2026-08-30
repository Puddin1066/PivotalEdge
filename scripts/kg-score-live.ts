#!/usr/bin/env tsx
/**
 * Score Polymarket-prioritized live programs against live CLOB asks.
 * Clinical P from enriched KG; quotes from Polymarket CLOB (LIVE lane).
 * Recommendations are decision-support only — no live trading execution.
 *
 * Usage: pnpm kg:score-live
 */
import { config } from "dotenv";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  appendQuoteRows,
  fetchClobOrderBook,
  fetchGammaMarketById,
  yesNoTokenIds,
  type EnrichSeedProgram,
} from "@pivotaledge/adapters";
import {
  assessContractEvidence,
  compileQueryPlan,
  InMemoryKnowledgeGraphRepository,
  loadGraphFromProgramFixtures,
} from "@pivotaledge/kg";
import { buildForecast } from "@pivotaledge/models";
import {
  defaultFixturesRoot,
  FrozenOpportunitySnapshotSchema,
  loadProgramFixture,
  type ArchivedQuoteRow,
  type MarketEventType,
  type MarketQuestion,
  type ProgramFixture,
  RadarOpportunitySchema,
} from "@pivotaledge/schemas";
import { buildBetRecommendation, extractExecutableQuotes, fingerprintRecommendation } from "@pivotaledge/scoring";

config();

type SeedFile = { programs: EnrichSeedProgram[] };

async function loadAllPrograms(root: string): Promise<ProgramFixture[]> {
  const dirs = ["approved", "crl", "corpus", "corpus/live", "corpus/retrospective"];
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

function inferEventType(question: string): MarketEventType {
  const q = question.toLowerCase();
  if (q.includes("bla submitted") || q.includes("nda submitted") || q.includes("submitted by")) {
    return "NDA_BLA_SUBMISSION";
  }
  if (q.includes("this year") || q.includes("by december") || q.includes("by june") || q.includes("by ")) {
    return "FDA_APPROVAL_BY_DATE";
  }
  return "FDA_APPROVAL";
}

/** Normalize Gamma endDate → ISO; null if missing/unparseable. */
function gammaEndToIso(endDate: string | null): string | null {
  if (!endDate) return null;
  const raw = endDate.includes("T") ? endDate : `${endDate}T23:59:00.000Z`;
  const ms = Date.parse(raw);
  if (Number.isNaN(ms)) return null;
  return new Date(ms).toISOString();
}

function resolveEventType(
  seed: EnrichSeedProgram,
  marketId: string,
  question: string,
): MarketEventType {
  return seed.marketEventTypes?.[marketId] ?? inferEventType(question);
}

function buildMarketQuestion(
  seed: EnrichSeedProgram,
  fixture: ProgramFixture,
  marketId: string,
  gamma: { question: string; description: string; endDate: string | null },
): MarketQuestion {
  const deadline = gammaEndToIso(gamma.endDate) ?? "2026-12-31T23:59:00.000Z";
  return {
    marketId: `pm_${marketId}`,
    eventType: resolveEventType(seed, marketId, gamma.question),
    drugAssetId: fixture.drugAsset.id,
    drugAliases: [seed.preferredName, ...seed.fallbackCompetitors.slice(0, 0)],
    sponsorId: fixture.sponsor.id,
    indicationId: fixture.indication.id,
    population: null,
    applicationId: fixture.application?.id ?? null,
    linkedTrialIds: fixture.trials.map((t) => t.id),
    endpointIds: fixture.endpoints.map((e) => e.id),
    eventDeadline: deadline,
    resolutionSource: "polymarket_rules_and_fda",
    resolutionDefinition: gamma.description.slice(0, 2000) || gamma.question,
    conditionalApprovalCounts: true,
    ambiguityFlags: seed.preferredName.toLowerCase().includes("vaccine")
      ? ["asset_alias_resolution"]
      : [],
    parserConfidence: 0.7,
  };
}

async function main() {
  const root = defaultFixturesRoot();
  const seed = JSON.parse(
    await readFile(path.join(root, "enrichment/seed-programs.json"), "utf8"),
  ) as SeedFile;
  const programs = await loadAllPrograms(root);
  const bySlug = new Map(
    programs
      .filter((p) => p.program.id.includes("_"))
      .map((p) => {
        // match live fixtures by preferred name / program id fragment
        return [p.drugAsset.preferredName.toLowerCase(), p] as const;
      }),
  );

  const graph = loadGraphFromProgramFixtures(programs);
  const repo = new InMemoryKnowledgeGraphRepository(graph);
  const cutoff = new Date().toISOString();
  const frozenAt = cutoff;
  const outDir = path.join(root, "opportunities/live");
  await mkdir(outDir, { recursive: true });

  const rows: unknown[] = [];
  const vaultRows: ArchivedQuoteRow[] = [];
  let clinicalNote =
    "P from enriched KG; DEMO conviction until trading readiness reports calibrated.";
  try {
    const ready = JSON.parse(
      await readFile(path.join(root, "evals/trading-readiness-report.json"), "utf8"),
    ) as { clinicalConviction?: string };
    if (ready.clinicalConviction === "calibrated") {
      clinicalNote =
        "P from enriched KG + clinical chrono. Executable asks from live CLOB. Not live-traded.";
    }
  } catch {
    /* keep demo note */
  }

  for (const s of seed.programs) {
    const fixture =
      programs.find((p) => p.program.id === `prog_${s.slug.replace(/-/g, "_")}`) ??
      programs.find((p) => p.drugAsset.preferredName.toLowerCase() === s.preferredName.toLowerCase()) ??
      bySlug.get(s.preferredName.toLowerCase());
    if (!fixture) {
      console.warn(`Skip ${s.slug}: fixture not loaded`);
      continue;
    }

    for (const marketId of s.polymarketMarketIds) {
      console.log(`\nScore ${s.slug} × market ${marketId}…`);
      const gamma = await fetchGammaMarketById(marketId);
      if (!gamma || gamma.closed) {
        console.warn(`  skip: gamma missing/closed`);
        continue;
      }
      const tokens = yesNoTokenIds(gamma);
      if (!tokens) {
        console.warn(`  skip: no CLOB tokens`);
        continue;
      }

      const [yesBook, noBook] = await Promise.all([
        fetchClobOrderBook(tokens.yes, { marketId: `pm_${marketId}`, depth: 20 }),
        fetchClobOrderBook(tokens.no, { marketId: `pm_${marketId}`, depth: 20 }),
      ]);

      try {
        const quotes = extractExecutableQuotes(yesBook, noBook);
        vaultRows.push({
          kind: "archived_clob_quote",
          capturedAt: frozenAt,
          marketId,
          tokenYesId: tokens.yes,
          tokenNoId: tokens.no,
          bestAskYes: quotes.yesAsk,
          bestAskNo: quotes.noAsk,
          bestAskYesSize: quotes.yesAskSize,
          bestAskNoSize: quotes.noAskSize,
          source: "kg_score_live",
          slug: s.slug,
          question: gamma.question,
        });
      } catch {
        /* thin book — still score if recommendation path works */
      }

      const marketQuestion = buildMarketQuestion(s, fixture, marketId, gamma);
      const plan = compileQueryPlan(marketQuestion, {
        forecastCutoff: cutoff,
        therapeuticArea: fixture.indication.therapeuticArea,
      });
      const precedentBundle = repo.executePlan(plan);
      const contract = assessContractEvidence(marketQuestion, precedentBundle);
      const forecast = buildForecast({
        marketQuestion,
        precedentBundle,
        forecastCutoff: cutoff,
        forecastId: `fc_live_${s.slug}_${marketId}`,
        generatedAt: frozenAt,
      });

      const recommendation = buildBetRecommendation({
        marketQuestion,
        forecast,
        yesOrderBook: yesBook,
        noOrderBook: noBook,
        precedentBundle,
        bankroll: 10_000,
        generatedAt: frozenAt,
      });
      const fingerprint = fingerprintRecommendation(recommendation);

      const snapshot = FrozenOpportunitySnapshotSchema.parse({
        kind: "frozen_opportunity_snapshot",
        snapshotVersion: "live-1",
        frozenAt,
        marketQuestion,
        forecast,
        yesOrderBook: yesBook,
        noOrderBook: noBook,
        precedentBundle,
        bankroll: 10_000,
      });

      const snapRel = `opportunities/live/${s.slug}-${marketId}.json`;
      await writeFile(path.join(root, snapRel), `${JSON.stringify(snapshot, null, 2)}\n`);

      const radar = RadarOpportunitySchema.parse({
        id: `radar_${s.slug}_${marketId}`,
        marketId: marketQuestion.marketId,
        question: gamma.question,
        action: recommendation.action,
        modelProbability: recommendation.modelProbability,
        conservativeProbability: recommendation.conservativeProbability,
        executablePrice: recommendation.executablePrice,
        netEdge: recommendation.netEdge,
        recommendedStake: recommendation.recommendedStake,
        evidenceConfidence: recommendation.evidenceConfidence,
        opportunityScore:
          Math.round(
            (Math.abs(recommendation.netEdge) * 100 +
              recommendation.recommendedStake / 100 +
              (recommendation.evidenceConfidence === "high"
                ? 20
                : recommendation.evidenceConfidence === "medium"
                  ? 10
                  : 0)) *
              100,
          ) / 100,
        dossierPath: snapRel,
        orderBooksAreMock: false,
        generatedAt: frozenAt,
        dataLane: "live_polymarket",
        tradability: gamma.acceptingOrders && !gamma.closed ? "purchasable_now" : "not_purchasable",
      });

      const closesAt = gammaEndToIso(gamma.endDate);
      const row = {
        slug: s.slug,
        polymarketId: marketId,
        url: `https://polymarket.com/market/${gamma.slug}`,
        question: gamma.question,
        eventType: marketQuestion.eventType,
        dataLane: "live_polymarket",
        tradability: radar.tradability,
        clinicalNote,
        modelP: recommendation.modelProbability,
        conservativeP: recommendation.conservativeProbability,
        yesBestAsk: yesBook.bestAsk,
        noBestAsk: noBook.bestAsk,
        action: recommendation.action,
        netEdge: recommendation.netEdge,
        stake: recommendation.recommendedStake,
        evidenceConfidence: recommendation.evidenceConfidence,
        fingerprint: fingerprint.contentHash,
        snapshot: snapRel,
        thesis: recommendation.primaryThesis,
        eventDeadline: marketQuestion.eventDeadline,
        closesAt,
        requiredPresent: contract.requiredPresent,
        requiredMissing: contract.requiredMissing,
        contractCoverage: contract.contractCoverage,
        calibrationBlocked: contract.calibrationBlocked,
        contractNotes: contract.notes,
      };
      rows.push(row);
      console.log(
        `  ${recommendation.action} modelP=${recommendation.modelProbability.toFixed(3)} yesAsk=${yesBook.bestAsk} noAsk=${noBook.bestAsk} edge=${recommendation.netEdge.toFixed(3)} coverage=${contract.contractCoverage}`,
      );
    }
  }

  const reportPath = path.join(root, "enrichment/live-score-report.json");
  await writeFile(
    reportPath,
    `${JSON.stringify(
      {
        kind: "live_kg_score_report",
        at: frozenAt,
        cutoff,
        disclaimer:
          "LIVE CLOB quotes + enriched-KG probabilities. Not a trade instruction. Clinical conviction DEMO until trading readiness Bar A (see pnpm paper:live).",
        opportunities: rows,
      },
      null,
      2,
    )}\n`,
  );

  if (vaultRows.length) {
    await appendQuoteRows(vaultRows, root);
    console.log(`Appended ${vaultRows.length} quote vault rows.`);
  }

  console.log(`\nWrote ${rows.length} scored opportunities → ${reportPath}`);
  console.log(JSON.stringify(rows, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
