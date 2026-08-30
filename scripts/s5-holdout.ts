#!/usr/bin/env tsx
/** S5 gate CLI: chronological holdout Brier vs base-rate-only. */
import { evaluateChronologicalHoldout } from "@pivotaledge/models";
import { loadHoldoutCorpus } from "@pivotaledge/schemas";

async function main() {
  const corpus = await loadHoldoutCorpus();
  const evaluation = evaluateChronologicalHoldout(corpus, { minTrainCases: 4 });

  console.log(JSON.stringify(evaluation, null, 2));

  if (!evaluation.beatsBaseRate) {
    console.error("S5 gate FAIL: calibrated Brier did not beat base-rate-only");
    process.exit(1);
  }
  console.log("\nS5 gate PASS (calibrated beats base-rate Brier).");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
