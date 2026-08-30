#!/usr/bin/env tsx
/** S6 CLI: frozen snapshot → BetRecommendation (S6 gate). */
import { loadFrozenOpportunitySnapshot } from "@pivotaledge/schemas";
import {
  buildBetRecommendation,
  fingerprintRecommendation,
  recommendationFromSnapshot,
} from "@pivotaledge/scoring";

const snapshotPath = process.argv[2] ?? "opportunities/synalphimab-frozen.json";

async function main() {
  const snapshot = await loadFrozenOpportunitySnapshot(snapshotPath);

  const fromSnapshot = recommendationFromSnapshot(snapshot);
  const direct = buildBetRecommendation({
    marketQuestion: snapshot.marketQuestion,
    forecast: snapshot.forecast,
    yesOrderBook: snapshot.yesOrderBook,
    noOrderBook: snapshot.noOrderBook,
    precedentBundle: snapshot.precedentBundle,
    bankroll: snapshot.bankroll,
    generatedAt: snapshot.frozenAt,
    policyConfig: snapshot.policyConfig,
  });

  const fpA = fingerprintRecommendation(fromSnapshot);
  const fpB = fingerprintRecommendation(direct);

  console.log(JSON.stringify({ recommendation: fromSnapshot, fingerprint: fpA }, null, 2));

  if (fpA.contentHash !== fpB.contentHash) {
    console.error("S6 gate FAIL: snapshot rebuild fingerprint mismatch");
    process.exit(1);
  }
  console.log("\nS6 gate PASS (recommendation reproducible from frozen snapshot).");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
