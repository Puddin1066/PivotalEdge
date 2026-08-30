import { z } from "zod";

import { ConfidenceLevelSchema, IdSchema, IsoDateTimeSchema } from "./common.js";

export const BettingPolicyConfigSchema = z.object({
  policyVersion: z.string().min(1),
  minNetEdge: z.number().min(0).max(1),
  feeRate: z.number().min(0).max(0.5),
  maxBankrollFraction: z.number().min(0).max(1),
  kellyFraction: z.number().min(0).max(1),
  recommendationTtlHours: z.number().positive(),
  minAskSize: z.number().nonnegative(),
});
export type BettingPolicyConfig = z.infer<typeof BettingPolicyConfigSchema>;

export const BetActionSchema = z.enum(["BET_YES", "BET_NO", "WAIT", "NO_BET"]);
export type BetAction = z.infer<typeof BetActionSchema>;

export const BetRecommendationSchema = z.object({
  action: BetActionSchema,
  marketId: IdSchema,
  generatedAt: IsoDateTimeSchema,
  expiresAt: IsoDateTimeSchema,
  modelProbability: z.number().min(0).max(1),
  marketAdjustedProbability: z.number().min(0).max(1),
  conservativeProbability: z.number().min(0).max(1),
  executablePrice: z.number().min(0).max(1),
  maximumEntryPrice: z.number().min(0).max(1).nullable(),
  netEdge: z.number(),
  recommendedStake: z.number().nonnegative(),
  maximumStake: z.number().nonnegative(),
  bankrollFraction: z.number().min(0).max(1),
  evidenceConfidence: ConfidenceLevelSchema,
  resolutionRisk: ConfidenceLevelSchema,
  latentInformationRisk: ConfidenceLevelSchema,
  primaryThesis: z.string().min(1),
  strongestCounterargument: z.string().min(1),
  invalidators: z.array(z.string()),
  supportingEvidenceIds: z.array(IdSchema),
  forecastId: IdSchema,
  orderBookSnapshotId: IdSchema,
  policyVersion: z.string().min(1),
});
export type BetRecommendation = z.infer<typeof BetRecommendationSchema>;
