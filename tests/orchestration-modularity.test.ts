import { describe, expect, it, vi } from "vitest";

import type { PrecedentBundle } from "@pivotaledge/schemas";
import {
  createOrchestrationContext,
  runDeterministicPipeline,
  SYNALPHIMAB_PROFILE,
} from "@pivotaledge/orchestration";

describe("orchestration: modularity via port overrides", () => {
  it("uses injected KgPort without touching filesystem fixtures", async () => {
    const mockBundle: PrecedentBundle = {
      marketQuestionId: "pm_mock",
      currentProgram: null,
      cohorts: [],
      exactAnalogues: [],
      supportingEvidenceIds: [],
      contradictoryEvidenceIds: [],
      missingHighValueEvidence: [],
      cutoffCompliance: {
        forecastCutoff: SYNALPHIMAB_PROFILE.forecastCutoff,
        checkedAt: new Date().toISOString(),
        includedAssertionIds: [],
        excludedAssertionIds: [],
        leakageDetected: false,
        notes: [],
      },
    };

    const executePlan = vi.fn(async () => mockBundle);
    const ctx = createOrchestrationContext({
      overrides: {
        kg: { executePlan },
      },
    });

    await runDeterministicPipeline(ctx, {
      profile: SYNALPHIMAB_PROFILE,
      verifyFrozenFingerprint: false,
    });

    expect(executePlan).toHaveBeenCalledOnce();
    expect(executePlan.mock.calls[0]?.[0]?.programFixturePaths).toEqual(
      SYNALPHIMAB_PROFILE.programFixturePaths,
    );
  });

  it("routes evidence writes through EvidenceWriterPort", async () => {
    const writeValidated = vi.fn(async () => ({
      newEvidenceIds: ["ev_mock"],
      contradictoryEvidenceIds: [],
      fixturePath: "approved/synalphimab-nsclc.json",
    }));

    const ctx = createOrchestrationContext({
      overrides: {
        evidenceWriter: { writeValidated },
      },
    });

    const result = await ctx.evidenceWriter.writeValidated({
      runId: "run_test",
      records: [],
      programFixturePath: "approved/synalphimab-nsclc.json",
    });

    expect(writeValidated).toHaveBeenCalledOnce();
    expect(result.newEvidenceIds).toEqual(["ev_mock"]);
  });
});
