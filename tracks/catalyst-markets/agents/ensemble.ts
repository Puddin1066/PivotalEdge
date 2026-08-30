import {
  expectedCatalystReturn,
  probabilityEdge,
} from "../schemas/prediction.js";
import { okAgent, type AgentResponse } from "../schemas/agent-outputs.js";
import type { CatalystEvent } from "../schemas/event.js";

export function runEnsembleAgent(
  event: CatalystEvent,
  input: {
    pSuccess: number;
    rSuccess: number;
    rFailure: number;
    nearestAnalogCount: number;
  },
): AgentResponse {
  const ecr = expectedCatalystReturn(input.pSuccess, input.rSuccess, input.rFailure);
  const edge = probabilityEdge(input.pSuccess, event.marketImpliedProbability);

  return okAgent("ensemble_agent", event.eventId, event.informationCutoff, {
    pSuccess: input.pSuccess,
    rSuccess: input.rSuccess,
    rFailure: input.rFailure,
    expectedCatalystReturn: ecr,
    marketImpliedProbability: event.marketImpliedProbability ?? null,
    probabilityEdge: edge,
    edgeScore: edge ?? ecr,
    nearestAnalogCount: input.nearestAnalogCount,
  });
}
