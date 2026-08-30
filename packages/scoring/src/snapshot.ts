import type { FrozenOpportunitySnapshot } from "@pivotaledge/schemas";

import { buildBetRecommendation } from "./recommendation.js";
import { DEFAULT_BETTING_POLICY } from "./policy-config.js";

export function recommendationFromSnapshot(snapshot: FrozenOpportunitySnapshot) {
  return buildBetRecommendation({
    marketQuestion: snapshot.marketQuestion,
    forecast: snapshot.forecast,
    yesOrderBook: snapshot.yesOrderBook,
    noOrderBook: snapshot.noOrderBook,
    precedentBundle: snapshot.precedentBundle,
    bankroll: snapshot.bankroll,
    generatedAt: snapshot.frozenAt,
    policyConfig: snapshot.policyConfig ?? DEFAULT_BETTING_POLICY,
  });
}
