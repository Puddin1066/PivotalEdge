import { z } from "zod";

/** ISO date (YYYY-MM-DD) or datetime. */
export const IsoDateSchema = z.string().min(10);
export const IsoDateTimeSchema = z.string().datetime({ offset: true });

export const EventTypeSchema = z.enum([
  "phase_2_topline",
  "phase_3_topline",
  "regulatory_decision",
  "crl",
  "approval",
  "interim_analysis",
  "other",
]);
export type EventType = z.infer<typeof EventTypeSchema>;

/**
 * Canonical catalyst event (Notion §3).
 * information_cutoff is mandatory — no post-cutoff evidence in historical prediction.
 */
export const CatalystEventSchema = z.object({
  eventId: z.string().min(1),
  nctId: z.string().nullable(),
  ticker: z.string().min(1),
  companyId: z.string().min(1),
  assetId: z.string().min(1),
  eventDate: IsoDateSchema,
  eventType: EventTypeSchema,
  phase: z.number().int().min(1).max(4).nullable(),
  indication: z.string().nullable(),
  drug: z.string().nullable(),
  target: z.string().nullable(),
  modality: z.string().nullable(),
  /** Outcome labels — null in live mode until after catalyst. */
  outcomeLabel: z.enum(["positive", "negative", "mixed", "unknown"]).nullable(),
  primaryEndpointMet: z.boolean().nullable(),
  safetyLabel: z.enum(["acceptable", "problematic", "terminating", "unknown"]).nullable(),
  companyMarketCapPreEvent: z.number().nonnegative().nullable(),
  pipelineConcentration: z.number().min(0).max(1).nullable(),
  xbiReturnD0: z.number().nullable(),
  stockReturnD0: z.number().nullable(),
  abnormalReturnD0: z.number().nullable(),
  carM1P1: z.number().nullable(),
  car0P1: z.number().nullable(),
  car0P5: z.number().nullable(),
  carM5P5: z.number().nullable(),
  informationCutoff: IsoDateTimeSchema,
  /** Market-implied P(success) proxy when available (options/prediction later). */
  marketImpliedProbability: z.number().min(0).max(1).nullable().optional(),
});
export type CatalystEvent = z.infer<typeof CatalystEventSchema>;

export const StructuredTrialFeaturesSchema = z.object({
  phase: z.number().int().nullable(),
  enrollment: z.number().int().nonnegative().nullable(),
  isOncology: z.boolean(),
  isRareDisease: z.boolean(),
  hasPriorApprovalSameAsset: z.boolean(),
  sponsorIsLargeCap: z.boolean(),
  logMarketCap: z.number().nullable(),
  pipelineConcentration: z.number().nullable(),
});
export type StructuredTrialFeatures = z.infer<typeof StructuredTrialFeaturesSchema>;
