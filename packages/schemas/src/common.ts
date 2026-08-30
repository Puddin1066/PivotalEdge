import { z } from "zod";

/** ISO-8601 datetime string (validated loosely for fixture friendliness). */
export const IsoDateTimeSchema = z
  .string()
  .min(1)
  .refine((v) => !Number.isNaN(Date.parse(v)), { message: "Invalid ISO datetime" });

export const IsoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

/**
 * Evidence layers must stay separated. Outcome labels are never model inputs
 * before their valid public timestamps.
 */
export const EvidenceLayerSchema = z.enum([
  "raw_document",
  "sourced_fact",
  "extracted_observation",
  "calculated_metric",
  "model_inference",
  "market_observation",
  "user_judgment",
  "outcome_label",
]);
export type EvidenceLayer = z.infer<typeof EvidenceLayerSchema>;

export const ConfidenceLevelSchema = z.enum(["low", "moderate", "high"]);
export type ConfidenceLevel = z.infer<typeof ConfidenceLevelSchema>;

export const IdSchema = z.string().min(1);
