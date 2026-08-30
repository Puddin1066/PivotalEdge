import { z } from "zod";

import { IsoDateTimeSchema } from "./event.js";

/** Notion §9 outcome-label ontology. */
export const OutcomeLabelsSchema = z.object({
  efficacyOutcome: z.enum(["positive", "negative", "mixed", "unknown"]),
  primaryEndpoint: z.enum(["met", "missed", "ambiguous", "unknown"]),
  safety: z.enum(["acceptable", "problematic", "terminating", "unknown"]),
  development: z.enum(["advanced", "discontinued", "paused", "unclear"]),
  regulatory: z.enum([
    "approved",
    "crl",
    "withdrawn",
    "pending",
    "not_applicable",
  ]),
  source: z.string().min(1),
  publicationDate: IsoDateTimeSchema.nullable(),
  confidence: z.number().min(0).max(1),
  extractionMethod: z.enum(["structured", "heuristic", "llm", "human"]),
  humanReviewStatus: z.enum(["unreviewed", "accepted", "rejected"]),
  evidenceUrl: z.string().nullable(),
});
export type OutcomeLabels = z.infer<typeof OutcomeLabelsSchema>;
