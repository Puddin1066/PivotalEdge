import { okAgent, type AgentResponse } from "../schemas/agent-outputs.js";
import type { CatalystEvent } from "../schemas/event.js";
import { estimateConditionalCar } from "../models/equity.js";

export function runEquityResponseAgent(
  event: CatalystEvent,
  precedents: Array<{ outcomeLabel: string | null; carM1P1: number | null }>,
): AgentResponse {
  const { rSuccess, rFailure } = estimateConditionalCar(event, precedents);
  return okAgent("equity_response_agent", event.eventId, event.informationCutoff, {
    rSuccess,
    rFailure,
    targetWindow: "CAR_-1_+1",
    model: "precedent_conditional_mean_v0",
  });
}
