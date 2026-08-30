import { describe, expect, it } from "vitest";

import { loadEventFixtures } from "../../ingestion/aact.js";
import { runCatalystPipeline } from "../../orchestration/graph.js";

describe("multi-agent pipeline", () => {
  it("runs historical pipeline and passes audit on fixture", async () => {
    const events = await loadEventFixtures();
    const event = events.find((e) => e.eventId === "NCT01234567_2024-05-17");
    expect(event).toBeDefined();
    const { state, prediction } = await runCatalystPipeline(event!, {
      mode: "historical",
      runId: "test_hist",
    });
    expect(state.agentLog.length).toBeGreaterThanOrEqual(10);
    expect(state.auditStatus).toBe("pass");
    expect(prediction?.pSuccess).toBeGreaterThan(0);
    expect(prediction?.expectedCatalystReturn).toBeTypeOf("number");
    expect(state.thesis).toContain("ABCD");
  }, 30_000);

  it("skips outcome/event-study in live mode and still predicts", async () => {
    const events = await loadEventFixtures();
    const event = events.find((e) => e.eventId.includes("LIVE"));
    expect(event).toBeDefined();
    const { state, prediction } = await runCatalystPipeline(event!, {
      mode: "live",
      freeze: true,
      runId: "test_live",
    });
    expect(state.agentLog.some((a) => a.agent === "outcome_agent" && a.status === "skipped")).toBe(
      true,
    );
    expect(state.auditStatus).toBe("pass");
    expect(prediction?.frozen).toBe(true);
  }, 30_000);
});
