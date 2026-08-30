#!/usr/bin/env tsx
/**
 * Run the deterministic orchestration pipeline on a fixture profile.
 *
 * Usage:
 *   pnpm orchestration:fixture
 *   pnpm orchestration:fixture -- --profile synalphimab
 *   pnpm orchestration:fixture -- --enrich
 *   pnpm orchestration:fixture -- --dry-run
 */
import {
  createFixtureResearchAdapter,
  createInMemoryEvidenceWriter,
  createMemoryRunStore,
  createOrchestrationContext,
  getFixtureProfile,
  isOrchestrationEnabled,
  planTargetedResearch,
  runDeterministicPipeline,
  runEnrichmentGraph,
  SYNALPHIMAB_PROFILE,
} from "@pivotaledge/orchestration";

function parseArgs(argv: string[]) {
  let profileId = "synalphimab";
  let dryRun = false;
  let enrich = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--profile" && argv[i + 1]) {
      profileId = argv[++i]!;
    } else if (argv[i] === "--dry-run") {
      dryRun = true;
    } else if (argv[i] === "--enrich") {
      enrich = true;
    }
  }
  return { profileId, dryRun, enrich };
}

async function main() {
  const { profileId, dryRun, enrich } = parseArgs(process.argv.slice(2));
  const profile = profileId === "synalphimab" ? SYNALPHIMAB_PROFILE : getFixtureProfile(profileId);

  const ctx = createOrchestrationContext({
    config: enrich ? { enabled: true } : { enabled: false },
    overrides: enrich
      ? {
          research: createFixtureResearchAdapter(),
          evidenceWriter: createInMemoryEvidenceWriter(),
          runStore: createMemoryRunStore(),
        }
      : undefined,
  });

  console.log(`Profile: ${profile.id}`);
  console.log(`Orchestration enabled: ${isOrchestrationEnabled(ctx.config)}`);
  console.log(`Forecast cutoff: ${profile.forecastCutoff}`);

  if (dryRun) {
    console.log("Dry run — config and profile only.");
    return;
  }

  if (enrich) {
    const result = await runEnrichmentGraph(ctx, { profile });
    console.log("\n--- Enrichment graph result ---");
    console.log(`Run ID: ${result.runId}`);
    console.log(`Action: ${result.recommendation.action}`);
    console.log(`P_initial: ${result.diff.initialProbability.toFixed(4)}`);
    console.log(`P_enriched: ${result.diff.finalProbability.toFixed(4)}`);
    console.log(`ΔP: ${result.diff.probabilityDelta.toFixed(4)}`);
    console.log(`Evidence added: ${result.diff.evidenceAdded}`);
    console.log(`Iterations: ${result.diff.researchIterations}`);
    console.log(`Stop reason: ${result.diff.stopReason}`);
    console.log(`Features changed: ${result.diff.featuresChanged.join(", ") || "(none)"}`);
    return;
  }

  const result = await runDeterministicPipeline(ctx, { profile });
  const tasks = planTargetedResearch(result.gaps, ctx.config);

  console.log("\n--- Pipeline result ---");
  console.log(`Action: ${result.recommendation.action}`);
  console.log(`Model P: ${result.forecast.modelProbability.toFixed(4)}`);
  console.log(`Conservative P: ${result.forecast.conservativeProbability.toFixed(4)}`);
  console.log(`Fingerprint: ${result.fingerprint.contentHash}`);
  console.log(`Gaps: ${result.gaps.length}`);
  console.log(`Research tasks (if enrichment ran): ${tasks.length}`);

  if (result.gaps.length > 0) {
    console.log("\nTop gaps:");
    for (const gap of result.gaps.slice(0, 5)) {
      console.log(`  - ${gap.featureName} (importance=${gap.featureImportance.toFixed(2)})`);
    }
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
