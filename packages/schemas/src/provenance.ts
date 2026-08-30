import { z } from "zod";

import { IsoDateTimeSchema } from "./common.js";

/**
 * Every document and assertion carries temporal provenance so historical
 * replay can enforce first_public_at <= forecast_cutoff.
 */
export const TemporalProvenanceSchema = z.object({
  sourceUrl: z.union([z.string().url(), z.string().startsWith("fixture://")]),
  sourceSystem: z.string().min(1),
  retrievedAt: IsoDateTimeSchema,
  firstPublicAt: IsoDateTimeSchema.nullable(),
  effectiveAt: IsoDateTimeSchema.nullable(),
  versionId: z.string().nullable(),
  checksum: z.string().min(1),
  exactPassage: z.string().nullable(),
  locator: z.string().nullable(),
  accessClass: z.enum(["open", "restricted", "unknown"]),
});
export type TemporalProvenance = z.infer<typeof TemporalProvenanceSchema>;

/** Audit that a snapshot complied with a forecast cutoff. */
export const CutoffAuditSchema = z.object({
  forecastCutoff: IsoDateTimeSchema,
  checkedAt: IsoDateTimeSchema,
  includedAssertionIds: z.array(z.string()),
  excludedAssertionIds: z.array(z.string()),
  leakageDetected: z.boolean(),
  notes: z.array(z.string()).default([]),
});
export type CutoffAudit = z.infer<typeof CutoffAuditSchema>;

/**
 * Returns true when an assertion's firstPublicAt is at or before the cutoff.
 * Null firstPublicAt is treated as unknown and fails closed (not usable).
 */
export function isAvailableAtCutoff(firstPublicAt: string | null, forecastCutoff: string): boolean {
  if (firstPublicAt === null) return false;
  return Date.parse(firstPublicAt) <= Date.parse(forecastCutoff);
}
