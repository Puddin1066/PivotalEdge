import { describe, expect, it } from "vitest";

import { runProspectivePaperSample } from "@pivotaledge/evals";
import {
  ProspectiveSampleReportSchema,
  RadarSnapshotSchema,
  loadProspectiveCorpus,
} from "@pivotaledge/schemas";
import { buildOpportunityRadar } from "@pivotaledge/workflows";

describe("S9: prospective paper trading gate", () => {
  it("frozen model is calibrated and yields positive simulated net", async () => {
    const corpus = await loadProspectiveCorpus();
    const report = runProspectivePaperSample(corpus);

    expect(ProspectiveSampleReportSchema.safeParse(report).success).toBe(true);
    expect(report.calibrationStatus).toBe("prospective");
    expect(report.trainCases).toBeGreaterThanOrEqual(3);
    expect(report.prospectiveCases).toBeGreaterThanOrEqual(2);
    expect(report.paperTrades).toBeGreaterThan(0);
    expect(report.calibrated).toBe(true);
    expect(report.modelBrier).toBeLessThanOrEqual(report.marketBrier);
    expect(report.simulatedNetPnL).toBeGreaterThan(0);
    expect(report.gatePass).toBe(true);
    expect(report.trades.every((t) => t.simulation === true)).toBe(true);
  });
});

describe("S9: opportunity radar", () => {
  it("builds ranked radar with paper portfolio and live trading disabled", async () => {
    const radar = await buildOpportunityRadar();
    expect(RadarSnapshotSchema.safeParse(radar).success).toBe(true);
    expect(radar.opportunities.length).toBeGreaterThan(0);
    expect(radar.paperPortfolio?.liveTradingEnabled).toBe(false);
    expect(radar.opportunities.some((o) => o.action === "BET_YES")).toBe(true);
  });
});
