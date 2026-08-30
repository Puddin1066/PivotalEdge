import type { ConfidenceLevel, PrecedentBundle } from "@pivotaledge/schemas";

import type { ExecutableQuotes } from "./edge.js";
import type { BettingPolicyConfig } from "./policy-config.js";

export type RiskAssessment = {
  evidenceConfidence: ConfidenceLevel;
  resolutionRisk: ConfidenceLevel;
  latentInformationRisk: ConfidenceLevel;
};

export function assessRisks(
  bundle: PrecedentBundle,
  quotes: ExecutableQuotes,
  config: BettingPolicyConfig,
): RiskAssessment {
  const evidenceCount = bundle.supportingEvidenceIds.length;
  const cohortPrograms = bundle.cohorts.reduce((n, c) => n + c.programs.length, 0);
  const missing = bundle.missingHighValueEvidence.length;

  let evidenceConfidence: ConfidenceLevel = "low";
  if (evidenceCount >= 2 && cohortPrograms >= 1 && missing === 0) {
    evidenceConfidence = "high";
  } else if (evidenceCount >= 1 && missing <= 1) {
    evidenceConfidence = "moderate";
  }

  const resolutionRisk: ConfidenceLevel =
    bundle.currentProgram?.status === "approved" || bundle.currentProgram?.status === "crl"
      ? "low"
      : "moderate";

  const thinLiquidity =
    quotes.yesAskSize < config.minAskSize || quotes.noAskSize < config.minAskSize;
  const latentInformationRisk: ConfidenceLevel = thinLiquidity ? "moderate" : "low";

  return { evidenceConfidence, resolutionRisk, latentInformationRisk };
}
