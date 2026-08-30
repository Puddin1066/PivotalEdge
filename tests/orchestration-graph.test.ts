import { describe, expect, it } from "vitest";

import { isAvailableAtCutoff } from "@pivotaledge/schemas";
import {
  createFixtureResearchAdapter,
  createInMemoryEvidenceWriter,
  createMemoryRunStore,
  createOrchestrationContext,
  runEnrichmentGraph,
  SYNALPHIMAB_PROFILE,
  validateEvidenceRecords,
} from "@pivotaledge/orchestration";

describe("orchestration: LangGraph enrichment loop (Phase 2)", () => {
  it("completes enrichment graph with fixture research and persists run", async () => {
    const runStore = createMemoryRunStore();
    const ctx = createOrchestrationContext({
      config: { enabled: true, maxResearchIterations: 2 },
      overrides: {
        research: createFixtureResearchAdapter(),
        evidenceWriter: createInMemoryEvidenceWriter(),
        runStore,
      },
    });

    const result = await runEnrichmentGraph(ctx, { profile: SYNALPHIMAB_PROFILE });

    expect(result.runId).toMatch(/^orch_/);
    expect(result.recommendation.action).toBe("BET_YES");
    expect(result.diff.researchIterations).toBeGreaterThan(0);
    expect(result.diff.evidenceAdded).toBeGreaterThan(0);
    expect(result.diff.featuresChanged.length).toBeGreaterThan(0);
    expect(result.run?.status).toBe("completed");
    expect(result.run?.initialProbability).not.toBeNull();
    expect(result.run?.enrichedProbability).not.toBeNull();
  });

  it("falls back to baseline when orchestration disabled", async () => {
    const ctx = createOrchestrationContext({ config: { enabled: false } });
    const result = await runEnrichmentGraph(ctx, { profile: SYNALPHIMAB_PROFILE });

    expect(result.diff.stopReason).toBe("orchestration_disabled");
    expect(result.diff.evidenceAdded).toBe(0);
    expect(result.diff.probabilityDelta).toBe(0);
  });

  it("stops enrichment when research yields no valid evidence", async () => {
    const ctx = createOrchestrationContext({
      config: { enabled: true, maxResearchIterations: 1 },
      overrides: {
        research: createFixtureResearchAdapter({ returnEmpty: true }),
        runStore: createMemoryRunStore(),
      },
    });

    const result = await runEnrichmentGraph(ctx, { profile: SYNALPHIMAB_PROFILE });

    expect(result.diff.stopReason).toBe("no_new_validated_evidence");
    expect(result.diff.evidenceAdded).toBe(0);
    expect(result.diff.researchIterations).toBe(0);
  });

  it("fixture research produces cutoff-safe evidence", async () => {
    const research = createFixtureResearchAdapter();
    const records = await research.executeTask({
      task: {
        taskId: "task_acceptedAt",
        gapFeature: "acceptedAt",
        researchQuestion: "Was acceptance public?",
        sourcePriority: ["openfda"],
        priorityScore: 0.9,
      },
      marketQuestion: {
        marketId: "pm_test",
        eventType: "FDA_APPROVAL_BY_DATE",
        drugAssetId: "drug_syn",
        drugAliases: [],
        sponsorId: null,
        indicationId: null,
        population: null,
        applicationId: null,
        linkedTrialIds: [],
        endpointIds: [],
        eventDeadline: null,
        resolutionSource: "FDA",
        resolutionDefinition: "test",
        conditionalApprovalCounts: null,
        ambiguityFlags: [],
        parserConfidence: 0.9,
      },
      forecastCutoff: SYNALPHIMAB_PROFILE.forecastCutoff,
    });

    const validated = validateEvidenceRecords(records, SYNALPHIMAB_PROFILE.forecastCutoff);
    expect(validated.accepted.length).toBe(1);
    expect(isAvailableAtCutoff(validated.accepted[0]!.firstPublicAt, SYNALPHIMAB_PROFILE.forecastCutoff)).toBe(
      true,
    );
  });
});
