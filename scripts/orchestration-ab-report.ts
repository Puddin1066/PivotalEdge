#!/usr/bin/env tsx
/**
 * Phase 5: enrichment A/B telemetry — compare P_initial vs P_enriched on fixture corpus.
 *
 * Usage:
 *   pnpm orchestration:ab-report
 *   pnpm orchestration:ab-report -- --json
 */
import {
  runEnrichmentAbReport,
  type EnrichmentRunOutcome,
} from "@pivotaledge/evals";
import {
  createFixtureResearchAdapter,
  createInMemoryEvidenceWriter,
  createMemoryRunStore,
  createOrchestrationContext,
  getFixtureProfile,
  runDeterministicPipeline,
  runEnrichmentGraph,
} from "@pivotaledge/orchestration";
import { loadEnrichmentAbCorpus, type EnrichmentAbCase } from "@pivotaledge/schemas";

function parseArgs(argv: string[]) {
  return { json: argv.includes("--json") };
}

async function runCase(abCase: EnrichmentAbCase): Promise<EnrichmentRunOutcome> {
  const profile = getFixtureProfile(abCase.profileId);
  const ctx = createOrchestrationContext({
    config: { enabled: true, maxResearchIterations: 2 },
    overrides: {
      research: createFixtureResearchAdapter(),
      evidenceWriter: createInMemoryEvidenceWriter(),
      runStore: createMemoryRunStore(),
    },
  });

  const baseline = await runDeterministicPipeline(ctx, {
    profile,
    verifyFrozenFingerprint: false,
  });
  const enriched = await runEnrichmentGraph(ctx, { profile });

  return {
    runId: enriched.runId,
    pInitial: enriched.diff.initialProbability,
    pEnriched: enriched.diff.finalProbability,
    probabilityDelta: enriched.diff.probabilityDelta,
    initialAction: baseline.recommendation.action,
    enrichedAction: enriched.recommendation?.action ?? baseline.recommendation.action,
    evidenceAdded: enriched.diff.evidenceAdded,
    researchIterations: enriched.diff.researchIterations,
    stopReason: enriched.diff.stopReason,
  };
}

async function main() {
  const { json } = parseArgs(process.argv.slice(2));
  const corpus = await loadEnrichmentAbCorpus();
  const report = await runEnrichmentAbReport(corpus, runCase);

  if (json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log("Enrichment A/B report (fixture corpus — mocked research adapters)");
  console.log(`Cases: ${report.caseCount}`);
  console.log(`Initial Brier:  ${report.initialBrier.toFixed(4)}`);
  console.log(`Enriched Brier: ${report.enrichedBrier.toFixed(4)}`);
  console.log(`Δ Brier:        ${report.brierImprovement.toFixed(4)} (${report.enrichmentHelpsCalibration ? "enriched better or equal" : "no calibration gain"})`);
  console.log(`Initial log-loss:  ${report.initialLogLoss.toFixed(4)}`);
  console.log(`Enriched log-loss: ${report.enrichedLogLoss.toFixed(4)}`);
  console.log(`Δ log-loss:        ${report.logLossImprovement.toFixed(4)}`);
  console.log(`Action accuracy — initial: ${(report.initialActionAccuracy * 100).toFixed(0)}%, enriched: ${(report.enrichedActionAccuracy * 100).toFixed(0)}% (Δ ${(report.actionAccuracyDelta * 100).toFixed(0)} pp)`);
  console.log(`Mean |ΔP|: ${report.meanAbsoluteProbabilityDelta.toFixed(4)}`);
  console.log(`Cases with enrichment signal: ${report.casesWithEnrichmentSignal}/${report.caseCount}`);

  console.log("\nPer case:");
  for (const c of report.cases) {
    console.log(
      `  ${c.caseId} (${c.profileId}): P ${c.pInitial.toFixed(4)} → ${c.pEnriched.toFixed(4)} (Δ ${c.probabilityDelta.toFixed(4)}), ` +
        `action ${c.initialAction} → ${c.enrichedAction}, evidence +${c.evidenceAdded}, outcome=${c.resolvedApproved ? "YES" : "NO"}`,
    );
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
