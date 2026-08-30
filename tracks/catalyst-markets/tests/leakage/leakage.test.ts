import { describe, expect, it } from "vitest";

import { auditLeakage } from "../../backtest/leakage.js";

describe("leakage audit", () => {
  it("fails on post-cutoff evidence", () => {
    const r = auditLeakage({
      informationCutoff: "2024-05-16T23:59:59.000Z",
      eventDate: "2024-05-17",
      evidence: [
        { id: "ok", firstPublicAt: "2024-05-10T00:00:00.000Z" },
        { id: "bad", firstPublicAt: "2024-05-20T00:00:00.000Z" },
      ],
    });
    expect(r.ok).toBe(false);
    expect(r.findings.some((f) => f.code === "post_cutoff_evidence")).toBe(true);
  });

  it("passes when all evidence is pre-cutoff", () => {
    const r = auditLeakage({
      informationCutoff: "2024-05-16T23:59:59.000Z",
      eventDate: "2024-05-17",
      evidence: [{ id: "ok", firstPublicAt: "2024-05-10T00:00:00.000Z" }],
      marketDataThrough: "2024-05-16",
    });
    expect(r.ok).toBe(true);
  });
});
