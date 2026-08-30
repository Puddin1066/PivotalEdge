import type { BettingPolicyConfig } from "@pivotaledge/schemas";
import { BettingPolicyConfigSchema } from "@pivotaledge/schemas";

export const DEFAULT_BETTING_POLICY: BettingPolicyConfig = BettingPolicyConfigSchema.parse({
  policyVersion: "betting-policy@2",
  minNetEdge: 0.05,
  feeRate: 0.02,
  maxBankrollFraction: 0.02,
  kellyFraction: 0.25,
  recommendationTtlHours: 24,
  minAskSize: 50,
});

export { BettingPolicyConfigSchema };
export type { BettingPolicyConfig };
