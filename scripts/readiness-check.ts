#!/usr/bin/env tsx
/**
 * Unified readiness sweep: quote vault → filing watch → live KG score → paper readiness → S9 gate.
 * Does not enable live trading. Exits non-zero if Bar A (paperReady) fails.
 *
 * Usage: pnpm readiness:check
 */
import { execSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { defaultFixturesRoot } from "@pivotaledge/schemas";

function run(label: string, cmd: string) {
  console.log(`\n=== ${label} ===`);
  execSync(cmd, { stdio: "inherit", cwd: process.cwd() });
}

async function main() {
  run("Quote vault snapshot", "pnpm quotes:snapshot");
  run("Filing guidance watch", "pnpm kg:filing-watch");
  run("Edge scan (discover + score)", "pnpm edge:scan");
  run("Paper readiness (Bar A)", "pnpm paper:live");
  run("S9 prospective paper gate", "pnpm s9:paper");

  const root = defaultFixturesRoot();
  const readiness = JSON.parse(
    await readFile(path.join(root, "evals/trading-readiness-report.json"), "utf8"),
  ) as { paperReady?: boolean; clinicalConviction?: string; blockers?: string[] };

  console.log("\n=== Summary ===");
  console.log(
    JSON.stringify(
      {
        paperReady: readiness.paperReady,
        clinicalConviction: readiness.clinicalConviction,
        blockers: readiness.blockers,
      },
      null,
      2,
    ),
  );

  if (!readiness.paperReady) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
