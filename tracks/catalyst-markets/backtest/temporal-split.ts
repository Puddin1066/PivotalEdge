export type TemporalSplit = {
  trainEnd: string;
  validateStart: string;
  validateEnd: string;
  testStart: string;
  testEnd: string;
  forwardStart: string;
};

/** Notion §15 — chronological only; never random split. */
export const DEFAULT_TEMPORAL_SPLIT: TemporalSplit = {
  trainEnd: "2020-12-31",
  validateStart: "2021-01-01",
  validateEnd: "2022-12-31",
  testStart: "2023-01-01",
  testEnd: "2024-12-31",
  forwardStart: "2025-01-01",
};

export type SplitBucket = "train" | "validate" | "test" | "forward";

export function assignSplit(
  eventDate: string,
  split: TemporalSplit = DEFAULT_TEMPORAL_SPLIT,
): SplitBucket {
  if (eventDate <= split.trainEnd) return "train";
  if (eventDate >= split.validateStart && eventDate <= split.validateEnd) {
    return "validate";
  }
  if (eventDate >= split.testStart && eventDate <= split.testEnd) return "test";
  if (eventDate >= split.forwardStart) return "forward";
  // Between trainEnd and validateStart (gap) → treat as train
  if (eventDate < split.validateStart) return "train";
  return "forward";
}

export function partitionBySplit<T extends { eventDate: string }>(
  rows: T[],
  split: TemporalSplit = DEFAULT_TEMPORAL_SPLIT,
): Record<SplitBucket, T[]> {
  const out: Record<SplitBucket, T[]> = {
    train: [],
    validate: [],
    test: [],
    forward: [],
  };
  for (const row of rows) {
    out[assignSplit(row.eventDate, split)].push(row);
  }
  return out;
}
