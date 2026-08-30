import { describe, expect, it } from "vitest";

import { buildKgMetricsDashboard } from "@pivotaledge/workflows";

describe("KG metrics dashboard", () => {
  it("aggregates inventory and enrich history shape", async () => {
    const dash = await buildKgMetricsDashboard();
    expect(dash.kind).toBe("kg_metrics_dashboard");
    expect(dash.summary.programCount).toBeGreaterThan(10);
    expect(dash.summary.liveProgramCount).toBeGreaterThanOrEqual(3);
    expect(dash.byTherapeuticArea.length).toBeGreaterThan(0);
    expect(dash.liveClocks.some((r) => r.slug === "retatrutide-obesity")).toBe(true);
    expect(dash.seeds.length).toBeGreaterThanOrEqual(3);
    expect(dash.coverageGaps).toBeDefined();
    expect(Array.isArray(dash.coverageGaps.liveMissingClock)).toBe(true);
    expect(Array.isArray(dash.coverageGaps.liveUndatedCompetitors)).toBe(true);
  });
});
