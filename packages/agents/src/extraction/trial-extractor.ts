import {
  TrialAssessmentSchema,
  type ExtractionCitation,
  type TrialAssessment,
} from "@pivotaledge/schemas";

export type ExtractTrialInput = {
  trialId: string;
  documentId: string;
  sourceText: string;
  nctId?: string | null;
};

export type ExtractTrialOptions = {
  apiKey?: string;
  model?: string;
  useHeuristicFallback?: boolean;
};

/** Deterministic extractor for fixtures/gold set — parses known passage patterns only. */
export function heuristicExtractTrial(input: ExtractTrialInput): TrialAssessment {
  const text = input.sourceText;
  const passage =
    text.match(/Primary endpoint[^]*?\)\./i)?.[0] ??
    text.match(/overall survival[^]*?\)\./i)?.[0] ??
    text.trim();

  const hrMatch = text.match(/HR\s*([0-9.]+)/i);
  const ciMatch = text.match(/95%\s*CI\s*([0-9.]+)\s*[-–]\s*([0-9.]+)/i);
  const pMatch = text.match(/p\s*=\s*([0-9.]+)/i);
  const met = /was met|met the primary/i.test(text);

  const citation: ExtractionCitation | null = passage
    ? {
        documentId: input.documentId,
        exactPassage: passage.trim(),
        locator: "results#primary",
      }
    : null;

  const citations: Record<string, ExtractionCitation> = {};
  if (citation) {
    if (met) citations.primaryEndpointMet = citation;
    if (hrMatch) citations.effectEstimate = citation;
    if (ciMatch) citations.confidenceInterval = citation;
    if (pMatch) citations.pValue = citation;
  }

  return TrialAssessmentSchema.parse({
    trialId: input.trialId,
    documentId: input.documentId,
    phase: text.match(/phase\s*(iii|ii|i)/i)?.[1]?.toUpperCase() ?? null,
    population: null,
    intervention: null,
    control: null,
    primaryEndpoints: [],
    enrollmentPlanned: null,
    enrollmentActual: null,
    primaryEndpointMet: met ? true : null,
    effectEstimate: hrMatch ? Number(hrMatch[1]) : null,
    confidenceInterval: ciMatch
      ? ([Number(ciMatch[1]), Number(ciMatch[2])] as [number, number])
      : null,
    pValue: pMatch ? Number(pMatch[1]) : null,
    multiplicityControlled: null,
    discontinuationImbalance: null,
    safetySignals: [],
    protocolChanges: [],
    citations,
    unresolvedFields: passage ? [] : ["primaryEndpointMet", "effectEstimate"],
  });
}

const TrialAssessmentJsonSchema = {
  type: "object" as const,
  additionalProperties: false,
  required: [
    "trialId",
    "documentId",
    "phase",
    "population",
    "intervention",
    "control",
    "primaryEndpoints",
    "enrollmentPlanned",
    "enrollmentActual",
    "primaryEndpointMet",
    "effectEstimate",
    "confidenceInterval",
    "pValue",
    "multiplicityControlled",
    "discontinuationImbalance",
    "safetySignals",
    "protocolChanges",
    "supportingAssertionIds",
    "contradictoryAssertionIds",
    "unresolvedFields",
    "citations",
  ],
  properties: {
    trialId: { type: "string" },
    documentId: { type: "string" },
    phase: { type: ["string", "null"] },
    population: { type: ["string", "null"] },
    intervention: { type: ["string", "null"] },
    control: { type: ["string", "null"] },
    primaryEndpoints: { type: "array", items: { type: "object" } },
    enrollmentPlanned: { type: ["number", "null"] },
    enrollmentActual: { type: ["number", "null"] },
    primaryEndpointMet: { type: ["boolean", "null"] },
    effectEstimate: { type: ["number", "null"] },
    confidenceInterval: { type: ["array", "null"], items: { type: "number" } },
    pValue: { type: ["number", "null"] },
    multiplicityControlled: { type: ["boolean", "null"] },
    discontinuationImbalance: { type: ["number", "null"] },
    safetySignals: { type: "array", items: { type: "object" } },
    protocolChanges: { type: "array", items: { type: "object" } },
    supportingAssertionIds: { type: "array", items: { type: "string" } },
    contradictoryAssertionIds: { type: "array", items: { type: "string" } },
    unresolvedFields: { type: "array", items: { type: "string" } },
    citations: { type: "object", additionalProperties: true },
  },
};

export async function extractTrialAssessment(
  input: ExtractTrialInput,
  options: ExtractTrialOptions = {},
): Promise<{ assessment: TrialAssessment; usedLlm: boolean; modelCallId: string | null }> {
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
  const useHeuristic = options.useHeuristicFallback ?? !apiKey;

  if (useHeuristic) {
    return {
      assessment: heuristicExtractTrial(input),
      usedLlm: false,
      modelCallId: null,
    };
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
          "Extract trial facts into JSON. Never invent numbers. " +
          "For every non-null numeric or boolean outcome field, add a citations entry " +
          "with documentId, exactPassage (verbatim substring), and locator. " +
          "Use null and unresolvedFields when absent from text.",
      },
      {
        role: "user",
        content: JSON.stringify({
          trialId: input.trialId,
          documentId: input.documentId,
          nctId: input.nctId ?? null,
          sourceText: input.sourceText,
        }),
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "TrialAssessment",
        strict: false,
        schema: TrialAssessmentJsonSchema,
      },
    },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    return {
      assessment: heuristicExtractTrial(input),
      usedLlm: false,
      modelCallId: response.id,
    };
  }

  const parsed = TrialAssessmentSchema.safeParse(JSON.parse(content));
  if (!parsed.success) {
    const fallback = heuristicExtractTrial(input);
    fallback.unresolvedFields.push("llm_schema_validation_failed");
    return { assessment: fallback, usedLlm: false, modelCallId: response.id };
  }

  parsed.data.trialId = input.trialId;
  parsed.data.documentId = input.documentId;
  return { assessment: parsed.data, usedLlm: true, modelCallId: response.id };
}
