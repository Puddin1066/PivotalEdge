import { isAvailableAtCutoff } from "@pivotaledge/schemas";

import { okAgent, type AgentResponse } from "../schemas/agent-outputs.js";
import type { CatalystEvent, StructuredTrialFeatures } from "../schemas/event.js";
import { embedTrialFields } from "../embeddings/trial.js";

export function runTrialAgent(
  event: CatalystEvent,
  extras?: {
    enrollment?: number;
    endpointText?: string;
    eligibilityText?: string;
    mechanismText?: string;
  },
): AgentResponse {
  const features: StructuredTrialFeatures = {
    phase: event.phase,
    enrollment: extras?.enrollment ?? null,
    isOncology: (event.indication ?? "").toUpperCase().includes("NSCLC") ||
      (event.indication ?? "").toUpperCase().includes("PDAC") ||
      (event.indication ?? "").toLowerCase().includes("cancer"),
    isRareDisease: false,
    hasPriorApprovalSameAsset: false,
    sponsorIsLargeCap: (event.companyMarketCapPreEvent ?? 0) >= 10_000_000_000,
    logMarketCap:
      event.companyMarketCapPreEvent != null && event.companyMarketCapPreEvent > 0
        ? Math.log(event.companyMarketCapPreEvent)
        : null,
    pipelineConcentration: event.pipelineConcentration,
  };

  const embeddings = embedTrialFields({
    endpoint: extras?.endpointText ?? event.drug ?? "",
    eligibility: extras?.eligibilityText ?? "",
    intervention: event.drug ?? "",
    mechanism: extras?.mechanismText ?? event.target ?? "",
    design: `phase ${event.phase ?? "unknown"} ${event.eventType}`,
  });

  return okAgent("trial_agent", event.eventId, event.informationCutoff, {
    features,
    embeddings,
    nctId: event.nctId,
  });
}

export function assertCutoffOk(
  firstPublicAt: string | null,
  cutoff: string,
): boolean {
  return isAvailableAtCutoff(firstPublicAt, cutoff);
}
