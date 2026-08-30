import { z } from "zod";

import { BettingPolicyConfigSchema } from "./bet.js";
import { IsoDateTimeSchema } from "./common.js";
import { ForecastSchema } from "./forecast.js";
import { PrecedentBundleSchema } from "./kg.js";
import { MarketQuestionSchema, OrderBookSnapshotSchema } from "./market.js";

export const FrozenOpportunitySnapshotSchema = z.object({
  kind: z.literal("frozen_opportunity_snapshot"),
  snapshotVersion: z.string().min(1),
  frozenAt: IsoDateTimeSchema,
  marketQuestion: MarketQuestionSchema,
  forecast: ForecastSchema,
  yesOrderBook: OrderBookSnapshotSchema,
  noOrderBook: OrderBookSnapshotSchema.nullable().default(null),
  precedentBundle: PrecedentBundleSchema,
  policyConfig: BettingPolicyConfigSchema.optional(),
  bankroll: z.number().positive().optional(),
});
export type FrozenOpportunitySnapshot = z.infer<typeof FrozenOpportunitySnapshotSchema>;
