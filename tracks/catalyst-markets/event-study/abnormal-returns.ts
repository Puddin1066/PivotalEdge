import { expectedReturn, fitMarketModel, type MarketModelParams } from "./expected-returns.js";
import {
  dailyReturns,
  sliceWindow,
  type PriceBar,
  type ReturnSeries,
} from "./windows.js";

export type CarWindows = {
  arD0: number | null;
  carM1P1: number | null;
  car0P1: number | null;
  car0P5: number | null;
  carM5P5: number | null;
};

export type EventStudyResult = CarWindows & {
  model: MarketModelParams;
  estimationDays: number;
};

function sumReturns(rows: ReturnSeries[]): number | null {
  if (rows.length === 0) return null;
  return rows.reduce((a, r) => a + r.ret, 0);
}

function abnormalSeries(
  stock: ReturnSeries[],
  market: ReturnSeries[],
  model: MarketModelParams,
): ReturnSeries[] {
  const mkt = new Map(market.map((m) => [m.date, m.ret]));
  const out: ReturnSeries[] = [];
  for (const s of stock) {
    const mr = mkt.get(s.date);
    if (mr === undefined) continue;
    out.push({ date: s.date, ret: s.ret - expectedReturn(model, mr) });
  }
  return out;
}

/**
 * Lo-style event study: fit market model on pre-event estimation window,
 * then compute AR/CAR over standard windows (Notion §10).
 */
export function computeEventStudy(input: {
  stockBars: PriceBar[];
  marketBars: PriceBar[];
  eventDate: string;
  /** Exclusive end of estimation window relative to event (default -2). */
  estimationEndOffset?: number;
  estimationDays?: number;
}): EventStudyResult {
  const estimationEndOffset = input.estimationEndOffset ?? -2;
  const estimationDays = input.estimationDays ?? 60;

  const stockR = dailyReturns(input.stockBars);
  const mktR = dailyReturns(input.marketBars);

  const est = sliceWindow(
    stockR,
    input.eventDate,
    estimationEndOffset - estimationDays + 1,
    estimationEndOffset,
  );
  const estMkt = sliceWindow(
    mktR,
    input.eventDate,
    estimationEndOffset - estimationDays + 1,
    estimationEndOffset,
  );
  const model = fitMarketModel(est, estMkt);
  const ar = abnormalSeries(stockR, mktR, model);

  const car = (a: number, b: number) => sumReturns(sliceWindow(ar, input.eventDate, a, b));

  return {
    model,
    estimationDays: est.length,
    arD0: car(0, 0),
    carM1P1: car(-1, 1),
    car0P1: car(0, 1),
    car0P5: car(0, 5),
    carM5P5: car(-5, 5),
  };
}
