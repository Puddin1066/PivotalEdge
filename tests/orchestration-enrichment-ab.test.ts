import { describe, expect, it } from "vitest";

import {
  actionMatchesOutcome,
  attachTelemetryToProspectiveCase,
  buildEnrichmentAbCaseResult,
  buildEnrichmentAbReport,
  logLossScore,
  meanLogLoss,
  runEnrichmentAbReport,
} from "@pivotaledge/evals";
import type { EnrichmentAbCorpus } from "@pivotaledge/schemas";
import {
  createFixtureResearchAdapter,
  createInMemoryEvidenceWriter,
  createMemoryRunStore,
  createOrchestrationContext,
  getFixtureProfile,
  runDeterministicPipeline,
  runEnrichmentGraph,
} from "@pivotaledge/orchestration";
import { loadEnrichmentAbCorpus } from "@pivotaledge/schemas";

describe("enrichment A/B telemetry (Phase 5)", () => {
  const mockCorpus: EnrichmentAbCorpus = {
    kind: "enrichment_ab_corpus",
    description: "unit test corpus",
    cases: [
      {
        caseId: "mock_a",
        profileId: "p1",
        resolvedApproved: true,
      },
      {
        caseId: "mock_b",
        profileId: "p2",
        resolvedApproved: false,
      },
    ],
  };

  it("computes log-loss and Brier improvement when enriched is closer to outcome", () => {
    const results = [
      buildEnrichmentAbCaseResult(mockCorpus.cases[0]!, {
        runId: "orch_a",
        pInitial: 0.4,
        pEnriched: 0.85,
        probabilityDelta: 0.45,
        initialAction: "WAIT",
        enrichedAction: "BET_YES",
        evidenceAdded: 2,
        researchIterations: 1,
        stopReason: "no_material_gaps",
      }),
      buildEnrichmentAbCaseResult(mockCorpus.cases[1]!, {
        runId: "orch_b",
        pInitial: 0.7,
        pEnriched: 0.25,
        probabilityDelta: -0.45,
        initialAction: "BET_YES",
        enrichedAction: "BET_NO",
        evidenceAdded: 1,
        researchIterations: 1,
        stopReason: "no_material_gaps",
      }),
    ];

    const report = buildEnrichmentAbReport(mockCorpus, results);

    expect(report.initialBrier).toBeGreaterThan(report.enrichedBrier);
    expect(report.brierImprovement).toBeGreaterThan(0);
    expect(report.enrichmentHelpsCalibration).toBe(true);
    expect(report.casesWithEnrichmentSignal).toBe(2);
    expect(report.enrichedActionAccuracy).toBe(1);
  });

  it("scores action alignment against resolved outcomes", () => {
    expect(actionMatchesOutcome("BET_YES", true)).toBe(true);
    expect(actionMatchesOutcome("BET_NO", false)).toBe(true);
    expect(actionMatchesOutcome("BET_YES", false)).toBe(false);
    expect(actionMatchesOutcome("WAIT", true)).toBeNull();
  });

  it("computes stable log-loss", () => {
    expect(logLossScore(0.9, 1)).toBeLessThan(logLossScore(0.5, 1));
    expect(meanLogLoss([0.9, 0.1], [1, 0])).toBeCloseTo(
      (logLossScore(0.9, 1) + logLossScore(0.1, 0)) / 2,
      10,
    );
  });

  it("attaches telemetry fields onto prospective rows", () => {
    const row = attachTelemetryToProspectiveCase(
      {
        caseId: "mock_a",
        forecastCutoff: "2020-01-01T00:00:00.000Z",
        phase: "III",
        therapeuticArea: "oncology",
        primaryEndpointMet: true,
        applicationFiled: true,
        resolvedApproved: true,
        executableYesAsk: 0.5,
        executableNoAsk: 0.52,
        evidenceConfidence: "high",
        supportingEvidenceCount: 2,
      },
      buildEnrichmentAbCaseResult(mockCorpus.cases[0]!, {
        runId: "orch_a",
        pInitial: 0.6,
        pEnriched: 0.7,
        probabilityDelta: 0.1,
        initialAction: "WAIT",
        enrichedAction: "BET_YES",
        evidenceAdded: 1,
        researchIterations: 1,
        stopReason: "done",
      }),
    );

    expect(row.pInitial).toBe(0.6);
    expect(row.pEnriched).toBe(0.7);
    expect(row.enrichmentRunId).toBe("orch_a");
  });

  it("runs fixture corpus enrichment A/B with mocked research", async () => {
    const corpus = await loadEnrichmentAbCorpus();
    const report = await runEnrichmentAbReport(corpus, async (abCase) => {
      const profile = getFixtureProfile(abCase.profileId);
      const ctx = createOrchestrationContext({
        config: { enabled: true, maxResearchIterations: 2 },
        overrides: {
          research: createFixtureResearchAdapter(),
          evidenceWriter: createInMemoryEvidenceWriter(),
          runStore: createMemoryRunStore(),
        },
      });
      const baseline = await runDeterministicPipeline(ctx, {
        profile,
        verifyFrozenFingerprint: false,
      });
      const enriched = await runEnrichmentGraph(ctx, { profile });
      return {
        runId: enriched.runId,
        pInitial: enriched.diff.initialProbability,
        pEnriched: enriched.diff.finalProbability,
        probabilityDelta: enriched.diff.probabilityDelta,
        initialAction: baseline.recommendation.action,
        enrichedAction: enriched.recommendation?.action ?? baseline.recommendation.action,
        evidenceAdded: enriched.diff.evidenceAdded,
        researchIterations: enriched.diff.researchIterations,
        stopReason: enriched.diff.stopReason,
      };
    });

    expect(report.caseCount).toBe(2);
    expect(report.cases.some((c) => c.evidenceAdded > 0)).toBe(true);
    expect(report.meanAbsoluteProbabilityDelta).toBeGreaterThanOrEqual(0);
  });
});
