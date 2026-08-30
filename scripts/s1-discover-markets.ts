#!/usr/bin/env tsx
/**
 * S1 CLI: discover active biotech Polymarket markets and parse to MarketQuestion.
 * Usage: pnpm s1:discover [--llm] [--limit N]
 */
import { config } from "dotenv";

import { buildAmbiguityQueue, discoverBiotechMarkets } from "@pivotaledge/agents";

config();

const args = process.argv.slice(2);
const useLlm = args.includes("--llm");
const limitIdx = args.indexOf("--limit");
const limit = limitIdx >= 0 ? Number(args[limitIdx + 1]) : 15;

async function main() {
  console.log(`Discovering biotech markets (useLlm=${useLlm}, limit=${limit})...`);
  const markets = await discoverBiotechMarkets({ limit, useLlm, maxPages: 8 });
  const queue = buildAmbiguityQueue(markets);
  const silentAmbiguity = markets.filter(
    (m) => m.needsReview && m.marketQuestion.ambiguityFlags.length === 0,
  );

  console.log(`\nFound ${markets.length} biotech markets`);
  console.log(`Needs review: ${markets.filter((m) => m.needsReview).length}`);
  console.log(`Ambiguity queue: ${queue.list("pending").length}`);
  console.log(`Silent ambiguity violations: ${silentAmbiguity.length}`);

  for (const m of markets.slice(0, 12)) {
    const flags =
      m.marketQuestion.ambiguityFlags.length > 0
        ? ` [${m.marketQuestion.ambiguityFlags.join(", ")}]`
        : "";
    console.log(
      `- ${m.gamma.id}: ${m.gamma.question.slice(0, 72)}… ` +
        `(${m.marketQuestion.eventType}, conf=${m.marketQuestion.parserConfidence.toFixed(2)}${flags})`,
    );
  }

  if (markets.length < 10) {
    console.warn("\nS1 gate warning: fewer than 10 biotech markets found.");
  }
  if (silentAmbiguity.length > 0) {
    console.error("\nS1 gate FAIL: silent ambiguity detected.");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
