/** Trading-day aligned price bar. */
export type PriceBar = {
  date: string;
  close: number;
};

export type ReturnSeries = {
  date: string;
  ret: number;
};

/** Simple close-to-close returns. */
export function dailyReturns(bars: PriceBar[]): ReturnSeries[] {
  const out: ReturnSeries[] = [];
  for (let i = 1; i < bars.length; i++) {
    const prev = bars[i - 1]!;
    const cur = bars[i]!;
    if (prev.close <= 0) continue;
    out.push({ date: cur.date, ret: cur.close / prev.close - 1 });
  }
  return out;
}

export function findIndexOnOrAfter(dates: string[], target: string): number {
  for (let i = 0; i < dates.length; i++) {
    if (dates[i]! >= target) return i;
  }
  return -1;
}

export function sliceWindow(
  returns: ReturnSeries[],
  eventDate: string,
  startOffset: number,
  endOffset: number,
): ReturnSeries[] {
  const dates = returns.map((r) => r.date);
  const eventIdx = findIndexOnOrAfter(dates, eventDate);
  if (eventIdx < 0) return [];
  const from = eventIdx + startOffset;
  const to = eventIdx + endOffset;
  const out: ReturnSeries[] = [];
  for (let i = from; i <= to; i++) {
    const row = returns[i];
    if (row) out.push(row);
  }
  return out;
}
