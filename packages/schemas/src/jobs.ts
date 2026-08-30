import { z } from "zod";

import { IdSchema, IsoDateTimeSchema } from "./common.js";

/** Record of every OpenAI (or other) model call for audit and cost control. */
export const ModelCallSchema = z.object({
  id: IdSchema,
  purpose: z.enum([
    "market_parse",
    "entity_resolve",
    "trial_extract",
    "regulatory_extract",
    "analogue_rank",
    "red_team",
    "dossier",
    "other",
  ]),
  modelName: z.string().min(1),
  promptVersion: z.string().min(1),
  schemaVersion: z.string().min(1),
  startedAt: IsoDateTimeSchema,
  completedAt: IsoDateTimeSchema.nullable(),
  inputTokens: z.number().int().nonnegative().nullable(),
  outputTokens: z.number().int().nonnegative().nullable(),
  costUsd: z.number().nonnegative().nullable(),
  sourceIds: z.array(IdSchema).default([]),
  forecastCutoff: IsoDateTimeSchema.nullable(),
  status: z.enum(["succeeded", "failed", "truncated"]),
  errorMessage: z.string().nullable(),
});
export type ModelCall = z.infer<typeof ModelCallSchema>;

export const JobSchema = z.object({
  id: IdSchema,
  jobType: z.enum([
    "ingest",
    "extract",
    "resolve_entities",
    "forecast",
    "backtest",
    "orderbook_snapshot",
    "other",
  ]),
  status: z.enum(["queued", "running", "succeeded", "failed", "cancelled"]),
  createdAt: IsoDateTimeSchema,
  startedAt: IsoDateTimeSchema.nullable(),
  completedAt: IsoDateTimeSchema.nullable(),
  attempts: z.number().int().nonnegative(),
  relatedEntityIds: z.array(IdSchema).default([]),
  errorMessage: z.string().nullable(),
  costUsd: z.number().nonnegative().nullable(),
});
export type Job = z.infer<typeof JobSchema>;
