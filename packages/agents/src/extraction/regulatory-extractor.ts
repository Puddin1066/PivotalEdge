import {
  RegulatoryAssessmentSchema,
  type ExtractionCitation,
  type RegulatoryAssessment,
} from "@pivotaledge/schemas";

export type ExtractRegulatoryInput = {
  applicationId: string;
  documentId: string;
  sourceText: string;
};

export type ExtractRegulatoryOptions = {
  apiKey?: string;
  model?: string;
  useHeuristicFallback?: boolean;
};

export function heuristicExtractRegulatory(input: ExtractRegulatoryInput): RegulatoryAssessment {
  const text = input.sourceText;
  let actionType: RegulatoryAssessment["actionType"] = null;
  if (/approved/i.test(text)) actionType = "approval";
  else if (/complete response letter|crl/i.test(text)) actionType = "crl";

  const passage =
    text.match(/FDA[^]*?\./i)?.[0] ??
    text.match(/Complete Response Letter[^]*?\./i)?.[0] ??
    text.slice(0, 200);

  const citations: Record<string, ExtractionCitation> = {};
  if (actionType && passage) {
    citations.actionType = {
      documentId: input.documentId,
      exactPassage: passage.trim(),
      locator: actionType === "crl" ? "8k#item8.01" : "approval-letter#1",
    };
  }

  const manufacturingConcerns: string[] = [];
  if (/manufacturing inspection/i.test(text)) {
    manufacturingConcerns.push("manufacturing inspection deficiencies");
    if (passage) {
      citations.manufacturingConcerns = {
        documentId: input.documentId,
        exactPassage: passage.trim(),
        locator: "8k#item8.01",
      };
    }
  }

  return RegulatoryAssessmentSchema.parse({
    applicationId: input.applicationId,
    documentId: input.documentId,
    actionType,
    statisticalConcerns: [],
    safetyConcerns: [],
    benefitRiskSummary: null,
    manufacturingConcerns,
    citations,
    unresolvedFields: actionType ? [] : ["actionType"],
    supportingAssertionIds: [],
    contradictoryAssertionIds: [],
  });
}

export async function extractRegulatoryAssessment(
  input: ExtractRegulatoryInput,
  options: ExtractRegulatoryOptions = {},
): Promise<{
  assessment: RegulatoryAssessment;
  usedLlm: boolean;
  modelCallId: string | null;
}> {
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
  const useHeuristic = options.useHeuristicFallback ?? !apiKey;

  if (useHeuristic) {
    return {
      assessment: heuristicExtractRegulatory(input),
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
          "Extract regulatory facts from FDA or sponsor disclosure text. " +
          "Never infer CRL contents beyond explicit statements. " +
          "Cite exact passages for non-null critical fields.",
      },
      {
        role: "user",
        content: JSON.stringify(input),
      },
    ],
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    return {
      assessment: heuristicExtractRegulatory(input),
      usedLlm: false,
      modelCallId: response.id,
    };
  }

  const parsed = RegulatoryAssessmentSchema.safeParse(JSON.parse(content));
  if (!parsed.success) {
    const fallback = heuristicExtractRegulatory(input);
    fallback.unresolvedFields.push("llm_schema_validation_failed");
    return { assessment: fallback, usedLlm: false, modelCallId: response.id };
  }

  parsed.data.applicationId = input.applicationId;
  parsed.data.documentId = input.documentId;
  return { assessment: parsed.data, usedLlm: true, modelCallId: response.id };
}
