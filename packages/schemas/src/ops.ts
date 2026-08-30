import { z } from "zod";

import { BetActionSchema } from "./bet.js";
import { IdSchema, IsoDateTimeSchema } from "./common.js";

export const ManualSideSchema = z.enum(["YES", "NO"]);
export type ManualSide = z.infer<typeof ManualSideSchema>;

export const ManualPositionStatusSchema = z.enum(["open", "resolved", "cancelled"]);
export type ManualPositionStatus = z.infer<typeof ManualPositionStatusSchema>;

export const ManualCloseReasonSchema = z.enum([
  "resolved",
  "manual_exit",
  "invalidated",
  "expired_no_fill",
]);
export type ManualCloseReason = z.infer<typeof ManualCloseReasonSchema>;

/** Operator-logged Polymarket fill — PivotalEdge never places the order. */
export const ManualPositionSchema = z.object({
  id: IdSchema,
  marketId: z.string().min(1),
  polymarketUrl: z.string().url(),
  question: z.string().min(1),
  slug: z.string().optional(),
  side: ManualSideSchema,
  status: ManualPositionStatusSchema,
  recommendationFingerprint: z.string().optional(),
  modelPAtEntry: z.number().min(0).max(1),
  conservativePAtEntry: z.number().min(0).max(1),
  recommendedAction: BetActionSchema,
  maxEntryPriceAtEntry: z.number().min(0).max(1).nullable().optional(),
  netEdgeAtEntry: z.number().optional(),
  fillPrice: z.number().min(0).max(1),
  /** USDC notional spent at fill */
  fillNotional: z.number().positive(),
  feesPaid: z.number().nonnegative().default(0),
  filledAt: IsoDateTimeSchema,
  notes: z.string().optional(),
  markAsk: z.number().min(0).max(1).nullable().optional(),
  markedAt: IsoDateTimeSchema.nullable().optional(),
  closedAt: IsoDateTimeSchema.nullable().optional(),
  resolvedYes: z.boolean().nullable().optional(),
  realizedPnL: z.number().nullable().optional(),
  closeReason: ManualCloseReasonSchema.optional(),
  invalidatorsNoted: z.array(z.string()).default([]),
});
export type ManualPosition = z.infer<typeof ManualPositionSchema>;

export const ManualBookSchema = z.object({
  kind: z.literal("manual_ops_book"),
  updatedAt: IsoDateTimeSchema,
  bankroll: z.number().positive().default(10_000),
  positions: z.array(ManualPositionSchema),
});
export type ManualBook = z.infer<typeof ManualBookSchema>;

export const CreateManualPositionInputSchema = z.object({
  marketId: z.string().min(1),
  polymarketUrl: z.string().url(),
  question: z.string().min(1),
  slug: z.string().optional(),
  side: ManualSideSchema,
  recommendationFingerprint: z.string().optional(),
  modelPAtEntry: z.number().min(0).max(1),
  conservativePAtEntry: z.number().min(0).max(1),
  recommendedAction: BetActionSchema,
  maxEntryPriceAtEntry: z.number().min(0).max(1).nullable().optional(),
  netEdgeAtEntry: z.number().optional(),
  fillPrice: z.number().min(0).max(1),
  fillNotional: z.number().positive(),
  feesPaid: z.number().nonnegative().optional(),
  filledAt: IsoDateTimeSchema.optional(),
  notes: z.string().optional(),
  invalidatorsNoted: z.array(z.string()).optional(),
});
export type CreateManualPositionInput = z.infer<typeof CreateManualPositionInputSchema>;

export const PatchManualPositionInputSchema = z.object({
  id: IdSchema,
  notes: z.string().optional(),
  invalidatorsNoted: z.array(z.string()).optional(),
  markAsk: z.number().min(0).max(1).nullable().optional(),
  markedAt: IsoDateTimeSchema.nullable().optional(),
  status: ManualPositionStatusSchema.optional(),
  resolvedYes: z.boolean().nullable().optional(),
  closeReason: ManualCloseReasonSchema.optional(),
  closedAt: IsoDateTimeSchema.optional(),
  realizedPnL: z.number().nullable().optional(),
});
export type PatchManualPositionInput = z.infer<typeof PatchManualPositionInputSchema>;

/** Binary market PnL: notional at ask; win pays notional/price − notional. */
export function realizedManualPnL(args: {
  side: "YES" | "NO";
  fillPrice: number;
  fillNotional: number;
  feesPaid: number;
  resolvedYes: boolean;
}): number {
  const won = args.side === "YES" ? args.resolvedYes : !args.resolvedYes;
  const gross = won ? args.fillNotional / args.fillPrice - args.fillNotional : -args.fillNotional;
  return gross - args.feesPaid;
}
