import { z } from "zod";

import { IdSchema, IsoDateTimeSchema } from "./common.js";

export const MarketEventTypeSchema = z.enum([
  "TRIAL_PRIMARY_ENDPOINT",
  "TRIAL_POSITIVE_TOPLINE",
  "NDA_BLA_SUBMISSION",
  "FILING_ACCEPTANCE",
  "FDA_APPROVAL",
  "FDA_APPROVAL_BY_DATE",
  "ADVISORY_COMMITTEE_VOTE",
]);
export type MarketEventType = z.infer<typeof MarketEventTypeSchema>;

export const MarketQuestionSchema = z.object({
  marketId: IdSchema,
  eventType: MarketEventTypeSchema,
  drugAssetId: IdSchema.nullable(),
  drugAliases: z.array(z.string()),
  sponsorId: IdSchema.nullable(),
  indicationId: IdSchema.nullable(),
  population: z.string().nullable(),
  applicationId: IdSchema.nullable(),
  linkedTrialIds: z.array(IdSchema),
  endpointIds: z.array(IdSchema),
  eventDeadline: IsoDateTimeSchema,
  resolutionSource: z.string().min(1),
  resolutionDefinition: z.string().min(1),
  conditionalApprovalCounts: z.boolean().nullable(),
  ambiguityFlags: z.array(z.string()),
  parserConfidence: z.number().min(0).max(1),
});
export type MarketQuestion = z.infer<typeof MarketQuestionSchema>;

export const PredictionMarketSchema = z.object({
  id: IdSchema,
  platform: z.literal("polymarket"),
  eventId: z.string().nullable(),
  question: z.string().min(1),
  resolutionRules: z.string().min(1),
  closesAt: IsoDateTimeSchema.nullable(),
  tokenYesId: z.string().nullable(),
  tokenNoId: z.string().nullable(),
  active: z.boolean(),
});
export type PredictionMarket = z.infer<typeof PredictionMarketSchema>;

export const OrderBookLevelSchema = z.object({
  price: z.number().min(0).max(1),
  size: z.number().nonnegative(),
});

export const OrderBookSnapshotSchema = z.object({
  id: IdSchema,
  marketId: IdSchema,
  capturedAt: IsoDateTimeSchema,
  bids: z.array(OrderBookLevelSchema),
  asks: z.array(OrderBookLevelSchema),
  /** Midpoint is observational only — never treat as executable. */
  midpoint: z.number().min(0).max(1).nullable(),
  bestBid: z.number().min(0).max(1).nullable(),
  bestAsk: z.number().min(0).max(1).nullable(),
});
export type OrderBookSnapshot = z.infer<typeof OrderBookSnapshotSchema>;
