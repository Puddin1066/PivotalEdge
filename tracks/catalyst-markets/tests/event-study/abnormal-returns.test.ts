import { describe, expect, it } from "vitest";

import { computeEventStudy } from "../../event-study/abnormal-returns.js";
import { dailyReturns } from "../../event-study/windows.js";
import type { PriceBar } from "../../event-study/windows.js";

function synthBars(n: number, start = "2024-01-02"): PriceBar[] {
  const bars: PriceBar[] = [];
  let d = new Date(start);
  let px = 100;
  for (let i = 0; i < n; ) {
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) {
      px *= 1 + (i % 5 === 0 ? 0.01 : -0.002);
      bars.push({ date: d.toISOString().slice(0, 10), close: px });
      i++;
    }
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return bars;
}

describe("event-study", () => {
  it("computes daily returns", () => {
    const r = dailyReturns([
      { date: "2024-01-02", close: 100 },
      { date: "2024-01-03", close: 110 },
    ]);
    expect(r).toHaveLength(1);
    expect(r[0]!.ret).toBeCloseTo(0.1);
  });

  it("fits market model and returns CAR windows", () => {
    const stock = synthBars(120);
    const market = synthBars(120);
    const eventDate = stock[90]!.date;
    // inject jump on event
    const idx = stock.findIndex((b) => b.date === eventDate);
    stock[idx]!.close *= 1.2;
    const result = computeEventStudy({
      stockBars: stock,
      marketBars: market,
      eventDate,
    });
    expect(result.estimationDays).toBeGreaterThan(20);
    expect(result.arD0).not.toBeNull();
    expect(result.carM1P1).not.toBeNull();
  });
});
