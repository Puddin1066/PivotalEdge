import { describe, expect, it } from "vitest";

import {
  assignSplit,
  DEFAULT_TEMPORAL_SPLIT,
  partitionBySplit,
} from "../../backtest/temporal-split.js";

describe("chronological split", () => {
  it("assigns buckets without random shuffle", () => {
    expect(assignSplit("2019-06-03")).toBe("train");
    expect(assignSplit("2021-06-01")).toBe("validate");
    expect(assignSplit("2023-06-01")).toBe("test");
    expect(assignSplit("2025-06-01")).toBe("forward");
  });

  it("partitions corpus by frozen dates", () => {
    const parts = partitionBySplit(
      [
        { eventDate: "2019-01-01" },
        { eventDate: "2021-01-01" },
        { eventDate: "2023-01-01" },
        { eventDate: "2026-01-01" },
      ],
      DEFAULT_TEMPORAL_SPLIT,
    );
    expect(parts.train).toHaveLength(1);
    expect(parts.validate).toHaveLength(1);
    expect(parts.test).toHaveLength(1);
    expect(parts.forward).toHaveLength(1);
  });
});
