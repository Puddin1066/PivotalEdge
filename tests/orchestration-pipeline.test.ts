import { describe, expect, it } from "vitest";

import { evaluateOpportunity } from "@pivotaledge/workflows";
import {
  createOrchestrationContext,
  runDeterministicPipeline,
  SYNALPHIMAB_PROFILE,
} from "@pivotaledge/orchestration";

describe("orchestration: deterministic pipeline integration", () => {
  it("matches evaluateOpportunity live pipeline fingerprint", async () => {
    const ctx = createOrchestrationContext({ config: { enabled: false } });
    const pipeline = await runDeterministicPipeline(ctx, { profile: SYNALPHIMAB_PROFILE });
    const dossier = await evaluateOpportunity({ livePipeline: true });

    expect(pipeline.market.question).toContain("Synalphimab");
    expect(pipeline.recommendation.action).toBe("BET_YES");
    expect(pipeline.fingerprint.contentHash).toBe(dossier.fingerprint.contentHash);
  });

  it("evaluates contract-aware gaps on synalphimab fixture", async () => {
    const ctx = createOrchestrationContext();
    const result = await runDeterministicPipeline(ctx, {
      profile: SYNALPHIMAB_PROFILE,
      verifyFrozenFingerprint: false,
    });

    expect(result.gaps.length).toBeGreaterThan(0);
    expect(result.gaps.every((g) => g.researchQuestion.length > 0)).toBe(true);
  });
});
