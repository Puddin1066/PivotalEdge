import { z } from "zod";

import { MarketQuestionSchema, type MarketQuestion } from "@pivotaledge/schemas";
import type { GammaMarket } from "@pivotaledge/adapters";

export const AmbiguityQueueItemSchema = z.object({
  id: z.string(),
  marketId: z.string(),
  question: z.string(),
  reason: z.string(),
  ambiguityFlags: z.array(z.string()),
  parserConfidence: z.number(),
  createdAt: z.string(),
  status: z.enum(["pending", "resolved", "rejected"]),
});
export type AmbiguityQueueItem = z.infer<typeof AmbiguityQueueItemSchema>;

export class AmbiguityQueue {
  private items = new Map<string, AmbiguityQueueItem>();

  enqueue(item: Omit<AmbiguityQueueItem, "id" | "createdAt" | "status">): AmbiguityQueueItem {
    const id = `amb_${item.marketId}_${Date.now()}`;
    const full: AmbiguityQueueItem = {
      ...item,
      id,
      createdAt: new Date().toISOString(),
      status: "pending",
    };
    this.items.set(id, full);
    return full;
  }

  list(status?: AmbiguityQueueItem["status"]): AmbiguityQueueItem[] {
    const all = [...this.items.values()];
    return status ? all.filter((i) => i.status === status) : all;
  }

  resolve(id: string): void {
    const item = this.items.get(id);
    if (item) this.items.set(id, { ...item, status: "resolved" });
  }
}

/** Rule-based pre-parse for tests and offline fallback. */
export function heuristicParseMarketQuestion(market: GammaMarket): MarketQuestion {
  const q = market.question.toLowerCase();
  let eventType: MarketQuestion["eventType"] = "FDA_APPROVAL";
  if (q.includes("by ") || q.includes("before ") || q.includes("this year")) {
    eventType = "FDA_APPROVAL_BY_DATE";
  } else if (q.includes("phase 3") || q.includes("phase iii") || q.includes("trial")) {
    eventType = "TRIAL_PRIMARY_ENDPOINT";
  } else if (q.includes("topline") || q.includes("top-line")) {
    eventType = "TRIAL_POSITIVE_TOPLINE";
  }

  const drugMatch = market.question.match(/(?:FDA approves|Will)\s+([A-Z][A-Za-z0-9-]+)/);
  const drugName = drugMatch?.[1] ?? null;
  const ambiguityFlags: string[] = [];
  if (!drugName) ambiguityFlags.push("drug_name_unresolved");
  if (!market.endDate) ambiguityFlags.push("deadline_missing");

  const deadline = market.endDate ?? new Date(Date.now() + 365 * 864e5).toISOString();

  return MarketQuestionSchema.parse({
    marketId: market.id,
    eventType,
    drugAssetId: null,
    drugAliases: drugName ? [drugName] : [],
    sponsorId: null,
    indicationId: null,
    population: null,
    applicationId: null,
    linkedTrialIds: [],
    endpointIds: [],
    eventDeadline: deadline,
    resolutionSource: "Polymarket resolution rules + FDA/CT.gov confirmation",
    resolutionDefinition: market.description.slice(0, 2000) || market.question,
    conditionalApprovalCounts: q.includes("conditional") ? true : null,
    ambiguityFlags,
    parserConfidence: ambiguityFlags.length === 0 ? 0.75 : 0.45,
  });
}

const MarketQuestionJsonSchema = {
  type: "object" as const,
  additionalProperties: false,
  required: [
    "marketId",
    "eventType",
    "drugAssetId",
    "drugAliases",
    "sponsorId",
    "indicationId",
    "population",
    "applicationId",
    "linkedTrialIds",
    "endpointIds",
    "eventDeadline",
    "resolutionSource",
    "resolutionDefinition",
    "conditionalApprovalCounts",
    "ambiguityFlags",
    "parserConfidence",
  ],
  properties: {
    marketId: { type: "string" },
    eventType: {
      type: "string",
      enum: [
        "TRIAL_PRIMARY_ENDPOINT",
        "TRIAL_POSITIVE_TOPLINE",
        "NDA_BLA_SUBMISSION",
        "FILING_ACCEPTANCE",
        "FDA_APPROVAL",
        "FDA_APPROVAL_BY_DATE",
        "ADVISORY_COMMITTEE_VOTE",
      ],
    },
    drugAssetId: { type: ["string", "null"] },
    drugAliases: { type: "array", items: { type: "string" } },
    sponsorId: { type: ["string", "null"] },
    indicationId: { type: ["string", "null"] },
    population: { type: ["string", "null"] },
    applicationId: { type: ["string", "null"] },
    linkedTrialIds: { type: "array", items: { type: "string" } },
    endpointIds: { type: "array", items: { type: "string" } },
    eventDeadline: { type: "string" },
    resolutionSource: { type: "string" },
    resolutionDefinition: { type: "string" },
    conditionalApprovalCounts: { type: ["boolean", "null"] },
    ambiguityFlags: { type: "array", items: { type: "string" } },
    parserConfidence: { type: "number", minimum: 0, maximum: 1 },
  },
};

export type ParseMarketOptions = {
  apiKey?: string;
  model?: string;
  useHeuristicFallback?: boolean;
};

export async function parseMarketQuestion(
  market: GammaMarket,
  options: ParseMarketOptions = {},
): Promise<{ question: MarketQuestion; usedLlm: boolean; modelCallId: string | null }> {
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
  const useHeuristic = options.useHeuristicFallback ?? !apiKey;

  if (useHeuristic) {
    const question = heuristicParseMarketQuestion(market);
    return { question, usedLlm: false, modelCallId: null };
  }

  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({ apiKey });

  const response = await client.chat.completions.create({
    model: options.model ?? "gpt-4.1-mini",
    temperature: 0,
    messages: [
      {
        role: "system",
        content:
          "Parse Polymarket biotechnology market rules into structured JSON. " +
          "Never invent NCT IDs, application numbers, or sponsor facts. " +
          "Set ambiguityFlags for any unresolved entity or ambiguous resolution language. " +
          "parserConfidence is 0-1 reflecting resolution clarity.",
      },
      {
        role: "user",
        content: JSON.stringify({
          marketId: market.id,
          question: market.question,
          description: market.description,
          endDate: market.endDate,
          tags: market.tags,
        }),
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "MarketQuestion",
        strict: true,
        schema: MarketQuestionJsonSchema,
      },
    },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    const question = heuristicParseMarketQuestion(market);
    question.ambiguityFlags.push("llm_empty_response");
    return { question, usedLlm: false, modelCallId: response.id };
  }

  const raw = JSON.parse(content) as Record<string, unknown>;
  if (!raw.eventDeadline || !Date.parse(String(raw.eventDeadline))) {
    raw.eventDeadline = market.endDate ?? new Date(Date.now() + 365 * 864e5).toISOString();
    if (!Array.isArray(raw.ambiguityFlags)) raw.ambiguityFlags = [];
    (raw.ambiguityFlags as string[]).push("deadline_inferred");
  }

  const parsed = MarketQuestionSchema.safeParse(raw);
  if (!parsed.success) {
    const question = heuristicParseMarketQuestion(market);
    question.ambiguityFlags.push("llm_schema_validation_failed");
    return { question, usedLlm: false, modelCallId: response.id };
  }

  const question = parsed.data;
  question.marketId = market.id;
  return { question, usedLlm: true, modelCallId: response.id };
}

export function requiresHumanReview(question: MarketQuestion): boolean {
  return (
    question.ambiguityFlags.length > 0 ||
    question.parserConfidence < 0.6 ||
    question.drugAliases.length === 0
  );
}
