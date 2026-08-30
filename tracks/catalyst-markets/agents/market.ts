import { dailyReturns } from "../event-study/windows.js";
import { fetchDailyPrices } from "../ingestion/prices.js";
import { okAgent, type AgentResponse } from "../schemas/agent-outputs.js";
import type { CatalystEvent } from "../schemas/event.js";

function trailingReturn(
  returns: { date: string; ret: number }[],
  eventDate: string,
  days: number,
): number | null {
  const before = returns.filter((r) => r.date < eventDate);
  if (before.length < days) return null;
  const slice = before.slice(-days);
  return slice.reduce((a, r) => a + r.ret, 0);
}

export async function runMarketAgent(event: CatalystEvent): Promise<AgentResponse> {
  const stock = await fetchDailyPrices(event.ticker);
  const xbi = await fetchDailyPrices("XBI");
  const spy = await fetchDailyPrices("SPY");
  const stockR = dailyReturns(stock);
  const xbiR = dailyReturns(xbi);

  return okAgent("market_agent", event.eventId, event.informationCutoff, {
    preEventRunup30: trailingReturn(stockR, event.eventDate, 30),
    preEventRunup60: trailingReturn(stockR, event.eventDate, 60),
    xbiReturnD0: event.xbiReturnD0,
    spyBarsAvailable: spy.length,
    xbiBarsAvailable: xbi.length,
    stockBarsAvailable: stock.length,
    regime: {
      xbiTrailing20: trailingReturn(xbiR, event.eventDate, 20),
    },
  });
}
