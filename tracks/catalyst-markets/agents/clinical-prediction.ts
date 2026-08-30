import { okAgent, type AgentResponse } from "../schemas/agent-outputs.js";
import type { CatalystEvent, StructuredTrialFeatures } from "../schemas/event.js";
import { estimatePSuccessBaseline } from "../models/baselines.js";

export function runClinicalPredictionAgent(
  event: CatalystEvent,
  features: StructuredTrialFeatures,
  graph: { sameTargetSuccessRate?: number; nearestAnalogCount?: number },
): AgentResponse {
  const { pSuccess, interval } = estimatePSuccessBaseline(features, graph);
  return okAgent(
    "clinical_prediction_agent",
    event.eventId,
    event.informationCutoff,
    {
      pSuccess,
      pSuccessInterval: interval,
      model: "baseline_structured_v0",
    },
    { confidence: 0.55 + Math.min(0.3, (graph.nearestAnalogCount ?? 0) * 0.03) },
  );
}
