import { resolveTicker } from "../entity-resolution/tickers.js";
import { okAgent, type AgentResponse } from "../schemas/agent-outputs.js";
import type { CatalystEvent } from "../schemas/event.js";

export function runCompanyAgent(event: CatalystEvent): AgentResponse {
  const map = resolveTicker(event.ticker);
  return okAgent("company_agent", event.eventId, event.informationCutoff, {
    companyId: event.companyId,
    ticker: event.ticker,
    sponsorMap: map,
    marketCap: event.companyMarketCapPreEvent,
    pipelineConcentration: event.pipelineConcentration,
    cashMillions: null,
    exposureVector: {
      singleAssetConcentration: event.pipelineConcentration,
      isMicroCap: (event.companyMarketCapPreEvent ?? Infinity) < 500_000_000,
    },
  });
}
