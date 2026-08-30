import { z } from "zod";

import { IsoDateTimeSchema } from "./event.js";

export const AgentNameSchema = z.enum([
  "trial_agent",
  "outcome_agent",
  "lineage_agent",
  "company_agent",
  "market_agent",
  "event_study_agent",
  "literature_agent",
  "graph_retrieval_agent",
  "clinical_prediction_agent",
  "equity_response_agent",
  "ensemble_agent",
  "audit_agent",
  "thesis_agent",
]);
export type AgentName = z.infer<typeof AgentNameSchema>;

/** Notion §17 — agents pass structured JSON, not prose. */
export const AgentResponseSchema = z.object({
  agent: AgentNameSchema,
  eventId: z.string().min(1),
  asOf: IsoDateTimeSchema,
  status: z.enum(["success", "partial", "failed", "skipped"]),
  data: z.record(z.string(), z.unknown()),
  confidence: z.number().min(0).max(1),
  sources: z.array(
    z.object({
      url: z.string().nullable(),
      firstPublicAt: IsoDateTimeSchema.nullable(),
      note: z.string().optional(),
    }),
  ),
  warnings: z.array(z.string()),
});
export type AgentResponse = z.infer<typeof AgentResponseSchema>;

export function okAgent(
  agent: AgentName,
  eventId: string,
  asOf: string,
  data: Record<string, unknown>,
  opts?: {
    confidence?: number;
    sources?: AgentResponse["sources"];
    warnings?: string[];
  },
): AgentResponse {
  return AgentResponseSchema.parse({
    agent,
    eventId,
    asOf,
    status: "success",
    data,
    confidence: opts?.confidence ?? 0.8,
    sources: opts?.sources ?? [],
    warnings: opts?.warnings ?? [],
  });
}
