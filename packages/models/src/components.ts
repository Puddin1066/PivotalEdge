import type { ForecastComponent, MarketQuestion } from "@pivotaledge/schemas";

import { MODEL_VERSION } from "./calibration.js";
import type { ModelFeatures } from "./features.js";
import {
  acceptanceGivenSubmissionProbability,
  decisionByDeadlineProbability,
  submissionByDeadlineProbability,
} from "./regulatory-clock.js";

export type ComponentBreakdown = {
  components: ForecastComponent[];
  compositeProbability: number;
};

function component(
  id: string,
  name: ForecastComponent["name"],
  probability: number,
  intervalLow: number | null,
  intervalHigh: number | null,
): ForecastComponent {
  return {
    id,
    name,
    probability,
    intervalLow,
    intervalHigh,
    modelVersion: MODEL_VERSION,
    calibrationStatus: "held_out",
  };
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** Decompose FDA approval-by-deadline into auditable component probabilities. */
export function decomposeApprovalByDeadline(
  question: MarketQuestion,
  features: ModelFeatures,
  approvalGivenAcceptance: number,
): ComponentBreakdown {
  const clinicalAdequacy =
    features.primaryEndpointMet === true
      ? 0.88
      : features.primaryEndpointMet === false
        ? 0.25
        : 0.55;

  const submissionByDeadline = submissionByDeadlineProbability(features, question.eventDeadline);
  const acceptanceGivenSubmission = acceptanceGivenSubmissionProbability(features);
  const approvalGivenAcceptanceP = clamp01(approvalGivenAcceptance);
  const decisionByDeadline = decisionByDeadlineProbability(features, question.eventDeadline);

  const compositeProbability = clamp01(
    clinicalAdequacy *
      submissionByDeadline *
      acceptanceGivenSubmission *
      approvalGivenAcceptanceP *
      decisionByDeadline,
  );

  const components: ForecastComponent[] = [
    component("comp_clinical", "clinical_adequacy", clinicalAdequacy, null, null),
    component("comp_submission", "submission_by_T", submissionByDeadline, null, null),
    component(
      "comp_acceptance",
      "acceptance_given_submission",
      acceptanceGivenSubmission,
      null,
      null,
    ),
    component("comp_approval", "approval_given_acceptance", approvalGivenAcceptanceP, null, null),
    component("comp_decision", "decision_by_T", decisionByDeadline, null, null),
  ];

  if (features.programStatus === "approved") {
    return {
      components: components.map((c) =>
        c.name === "decision_by_T" ? { ...c, probability: 1 } : c,
      ),
      compositeProbability: 1,
    };
  }
  if (features.programStatus === "crl") {
    return {
      components: components.map((c) =>
        c.name === "decision_by_T" ? { ...c, probability: 0 } : c,
      ),
      compositeProbability: 0,
    };
  }

  return { components, compositeProbability };
}

export function decomposeForecast(
  question: MarketQuestion,
  features: ModelFeatures,
  modelProbability: number,
): ComponentBreakdown {
  if (question.eventType === "FDA_APPROVAL_BY_DATE" || question.eventType === "FDA_APPROVAL") {
    return decomposeApprovalByDeadline(question, features, modelProbability);
  }

  return {
    components: [component("comp_other", "other", modelProbability, null, null)],
    compositeProbability: modelProbability,
  };
}
