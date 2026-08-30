#!/usr/bin/env tsx
/** S3 gate: run extraction gold-set evaluation. */
import { runGoldEval } from "@pivotaledge/agents";

async function main() {
  const summary = await runGoldEval();
  console.log(JSON.stringify(summary, null, 2));
  if (!summary.passed) {
    console.error("\nS3 gate FAIL: require >=95% schema and citation validity.");
    process.exit(1);
  }
  console.log("\nS3 gate PASS.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
