import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it, afterEach } from "vitest";

import {
  getLatestOrchestrationTraceForMarket,
  getOrchestrationRunDiff,
  getOrchestrationRunEvidence,
  getOrchestrationRunDetail,
  resolveOrchestrationMarketIdsForOps,
  resumeOrchestrationRun,
  startOrchestrationRun,
} from "@pivotaledge/orchestration";

describe("orchestration: API service layer (Phase 3)", () => {
  let tmpRoot: string;

  afterEach(async () => {
    if (tmpRoot) await rm(tmpRoot, { recursive: true, force: true });
  });

  it("starts run, persists diff/trace/evidence artifacts", async () => {
    tmpRoot = await mkdtemp(path.join(os.tmpdir(), "pe-orch-"));
    const started = await startOrchestrationRun({
      marketId: "pm_poly_syn_001",
      rootDir: tmpRoot,
    });

    expect(started.runId).toMatch(/^orch_/);
    expect(started.status).toBe("completed");
    expect(started.interrupted).toBe(false);
    expect(started.diff?.evidenceAdded).toBeGreaterThan(0);

    const diff = await getOrchestrationRunDiff(started.runId, tmpRoot);
    expect(diff?.probabilityDelta).toBeDefined();
    expect(diff?.researchIterations).toBeGreaterThan(0);

    const detail = await getOrchestrationRunDetail(started.runId, tmpRoot);
    expect(detail.run?.status).toBe("completed");
    expect(detail.trace?.runId).toBe(started.runId);

    const evidence = await getOrchestrationRunEvidence(started.runId, tmpRoot);
    expect(evidence?.newEvidenceIds.length).toBeGreaterThan(0);
  });

  it("interrupts for human review when configured and resumes on approval", async () => {
    tmpRoot = await mkdtemp(path.join(os.tmpdir(), "pe-orch-review-"));

    const started = await startOrchestrationRun({
      marketId: "pm_poly_syn_001",
      rootDir: tmpRoot,
      requireHumanReviewOnEvidence: true,
    });

    expect(started.interrupted).toBe(true);
    expect(started.status).toBe("awaiting_review");

    const evidence = await getOrchestrationRunEvidence(started.runId, tmpRoot);
    expect(evidence?.pendingRecords.length).toBeGreaterThan(0);

    const resumed = await resumeOrchestrationRun({
      runId: started.runId,
      rootDir: tmpRoot,
      approved: true,
    });

    expect(resumed.status).toBe("completed");
    expect(resumed.interrupted).toBe(false);
    expect(resumed.diff?.evidenceAdded).toBeGreaterThan(0);
  });

  it("resolves latest trace by ops polymarket id aliases", async () => {
    tmpRoot = await mkdtemp(path.join(os.tmpdir(), "pe-orch-alias-"));
    const started = await startOrchestrationRun({
      marketId: "pm_poly_syn_001",
      rootDir: tmpRoot,
    });

    const opsIds = resolveOrchestrationMarketIdsForOps("poly_syn_001");
    expect(opsIds).toContain("pm_poly_syn_001");

    const byCanonical = await getLatestOrchestrationTraceForMarket("pm_poly_syn_001", tmpRoot);
    expect(byCanonical.run?.runId).toBe(started.runId);

    const byAliases = await getLatestOrchestrationTraceForMarket(
      ["pm_missing", "pm_poly_syn_001"],
      tmpRoot,
    );
    expect(byAliases.run?.runId).toBe(started.runId);
  });
});
