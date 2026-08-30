import type { BetAction } from "@pivotaledge/schemas";

import type { ContractEvidenceAssessment } from "@pivotaledge/schemas";

import type { EdgeEstimate } from "./edge.js";
import type { RiskAssessment } from "./confidence.js";
import type { BettingPolicyConfig } from "./policy-config.js";

export type PolicyClockContext = {
  yesBestAsk: number;
  eventDeadline: string | null;
  applicationAccepted: boolean;
  acceptedAt: string | null;
  pdufaDate: string | null;
  expectedFilingAt: string | null;
  reviewProgram: string;
  /** Forecast component decision_by_T when available. */
  decisionByDeadlineP: number | null;
};

export type PolicyDecision = {
  action: BetAction;
  executablePrice: number;
  netEdge: number;
  maximumEntryPrice: number | null;
  primaryThesis: string;
  strongestCounterargument: string;
  invalidators: string[];
};

function stakeFraction(netEdge: number, config: BettingPolicyConfig): number {
  if (netEdge <= 0) return 0;
  const raw = config.kellyFraction * netEdge * 4;
  return Math.min(config.maxBankrollFraction, Math.max(0, raw));
}

/** Block fading near-certain YES when the regulatory clock implies imminent decision. */
export function shouldBlockNoFade(clock: PolicyClockContext | undefined): boolean {
  if (!clock || clock.yesBestAsk < 0.95) return false;

  if (clock.applicationAccepted) {
    if (clock.reviewProgram === "cnpv") return true;
    if (clock.decisionByDeadlineP != null && clock.decisionByDeadlineP >= 0.85) return true;
    if (clock.pdufaDate && clock.eventDeadline) {
      const pdufa = Date.parse(clock.pdufaDate);
      const deadline = Date.parse(clock.eventDeadline);
      if (Number.isFinite(pdufa) && Number.isFinite(deadline) && pdufa <= deadline) return true;
    }
    return true;
  }

  if (
    !clock.acceptedAt &&
    !clock.pdufaDate &&
    !clock.expectedFilingAt &&
    clock.yesBestAsk >= 0.95
  ) {
    return true;
  }

  return false;
}

/** Block actionable bets when contract-required evidence is missing at cutoff. */
export function applyContractCalibrationGate(
  decision: PolicyDecision,
  contract: ContractEvidenceAssessment | undefined,
): PolicyDecision {
  if (!contract) return decision;

  const reviewClockPartial =
    contract.contractCoverage === "partial" &&
    contract.requiredPresent.includes("review_clock_inferred") &&
    contract.requiredMissing.includes("review_clock");

  if (reviewClockPartial) {
    if (decision.action === "BET_YES") {
      return {
        action: "NO_BET",
        executablePrice: decision.executablePrice,
        netEdge: decision.netEdge,
        maximumEntryPrice: null,
        primaryThesis:
          "Contract partial: cohort PE→filing prior only — cannot BET_YES without sponsor acceptance, filing guidance, or PDUFA.",
        strongestCounterargument:
          "Public filing or acceptance before deadline would invalidate YES thesis.",
        invalidators: contract.requiredMissing.map((f) => `Public evidence satisfies: ${f}`),
      };
    }
    return decision;
  }

  if (!contract.calibrationBlocked) return decision;
  if (decision.action !== "BET_YES" && decision.action !== "BET_NO") return decision;

  const missing = contract.requiredMissing.join(", ") || "required contract fields";
  return {
    action: "NO_BET",
    executablePrice: decision.executablePrice,
    netEdge: decision.netEdge,
    maximumEntryPrice: null,
    primaryThesis: `Contract checklist blocked: missing ${missing}. Model P is not calibrated for ${contract.eventType} until required evidence is present.`,
    strongestCounterargument:
      "Entering on uncited gaps risks fading or chasing mispriced clock state; enrich or wait for public filings.",
    invalidators: contract.requiredMissing.map((f) => `Public evidence satisfies: ${f}`),
  };
}

export function decideBetAction(
  edge: EdgeEstimate,
  risks: RiskAssessment,
  config: BettingPolicyConfig,
  clock?: PolicyClockContext,
): PolicyDecision {
  const yesEligible =
    edge.netEdgeYes >= config.minNetEdge &&
    risks.evidenceConfidence !== "low" &&
    risks.latentInformationRisk !== "high";

  let noEligible =
    edge.netEdgeNo != null &&
    edge.netEdgeNo >= config.minNetEdge &&
    edge.executableNoPrice != null &&
    risks.evidenceConfidence !== "low";

  if (noEligible && shouldBlockNoFade(clock)) {
    noEligible = false;
  }

  if (yesEligible && (!noEligible || edge.netEdgeYes >= (edge.netEdgeNo ?? -1))) {
    return {
      action: "BET_YES",
      executablePrice: edge.executableYesPrice,
      netEdge: edge.netEdgeYes,
      maximumEntryPrice: edge.executableYesPrice + config.minNetEdge / 2,
      primaryThesis: `Conservative model P(YES) exceeds executable ask plus fees by ${(edge.netEdgeYes * 100).toFixed(1)}pp.`,
      strongestCounterargument:
        risks.resolutionRisk === "moderate"
          ? "Outcome not yet terminal; regulatory timing risk remains."
          : "Market may price latent catalysts not yet in public evidence.",
      invalidators: [
        "New CRL or trial failure disclosure",
        "Executable ask rises above maximum entry price",
        "Material evidence excluded by cutoff audit",
      ],
    };
  }

  if (noEligible && edge.executableNoPrice != null && edge.netEdgeNo != null) {
    return {
      action: "BET_NO",
      executablePrice: edge.executableNoPrice,
      netEdge: edge.netEdgeNo,
      maximumEntryPrice: edge.executableNoPrice + config.minNetEdge / 2,
      primaryThesis: `Conservative P(NO) exceeds executable NO ask plus fees by ${(edge.netEdgeNo * 100).toFixed(1)}pp.`,
      strongestCounterargument: "Approval catalyst before deadline could invalidate NO thesis.",
      invalidators: [
        "FDA approval or filing acceptance before deadline",
        "Executable NO ask rises above maximum entry price",
      ],
    };
  }

  if (
    !yesEligible &&
    !noEligible &&
    edge.netEdgeNo != null &&
    edge.netEdgeNo >= config.minNetEdge &&
    shouldBlockNoFade(clock)
  ) {
    return {
      action: "NO_BET",
      executablePrice: edge.executableYesPrice,
      netEdge: edge.netEdgeNo,
      maximumEntryPrice: null,
      primaryThesis:
        "Model implies NO edge, but policy blocks fading ≥95¢ YES without contradictory clock facts (accepted NDA / PDUFA / imminent CNPV review).",
      strongestCounterargument:
        "Market near-certainty often prices regulatory state not yet in our graph; missing or bullish clock → pass.",
      invalidators: [
        "Public CRL or trial failure before deadline",
        "YES ask falls below adverse-selection threshold with clock unchanged",
      ],
    };
  }

  const nearEdge = edge.netEdgeYes > 0 || (edge.netEdgeNo != null && edge.netEdgeNo > 0);

  if (nearEdge && risks.evidenceConfidence === "low") {
    return {
      action: "WAIT",
      executablePrice: edge.executableYesPrice,
      netEdge: Math.max(edge.netEdgeYes, edge.netEdgeNo ?? -Infinity),
      maximumEntryPrice: null,
      primaryThesis: "Edge signal present but evidence confidence is insufficient for entry.",
      strongestCounterargument: "Additional cited evidence could upgrade confidence to actionable.",
      invalidators: ["Evidence confidence reaches moderate with new public filings"],
    };
  }

  return {
    action: "NO_BET",
    executablePrice: edge.executableYesPrice,
    netEdge: Math.max(edge.netEdgeYes, edge.netEdgeNo ?? -Infinity),
    maximumEntryPrice: null,
    primaryThesis: "Net edge below policy threshold after fees and conservative probability.",
    strongestCounterargument: "Market price may already reflect undisclosed public information.",
    invalidators: ["Executable price moves to create threshold edge"],
  };
}

export { stakeFraction };
