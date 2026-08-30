import { isAvailableAtCutoff } from "@pivotaledge/schemas";

import { searchFdaDocuments } from "../ingestion/fda.js";
import { searchPubmed } from "../ingestion/pubmed.js";
import { okAgent, type AgentResponse } from "../schemas/agent-outputs.js";
import type { CatalystEvent } from "../schemas/event.js";

export async function runLiteratureAgent(event: CatalystEvent): Promise<AgentResponse> {
  const cutoff = event.informationCutoff;
  const pubmed = await searchPubmed({
    terms: [event.drug ?? "", event.target ?? "", event.indication ?? ""].filter(Boolean),
    cutoff,
  });
  const fda = await searchFdaDocuments({ drug: event.drug ?? undefined, cutoff });

  const filtered = [...pubmed, ...fda].filter((d) =>
    isAvailableAtCutoff("firstPublicAt" in d ? d.firstPublicAt : null, cutoff),
  );

  return okAgent(
    "literature_agent",
    event.eventId,
    cutoff,
    {
      evidenceCount: filtered.length,
      evidence: filtered,
      structuredEvidenceScore: filtered.length === 0 ? 0 : Math.min(1, filtered.length / 5),
    },
    {
      confidence: 0.5,
      warnings:
        filtered.length === 0
          ? ["No PubMed/FDA hits in MVP stub — score is placeholder"]
          : [],
    },
  );
}
