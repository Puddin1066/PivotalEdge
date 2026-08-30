import type {
  BetAction,
  EnrichmentAbCase,
  EnrichmentAbCaseResult,
  EnrichmentAbCorpus,
  EnrichmentAbReport,
  ProspectiveCase,
  ProspectiveCorpus,
} from "@pivotaledge/schemas";
import { EnrichmentAbReportSchema } from "@pivotaledge/schemas";
import { meanBrier } from "@pivotaledge/models";

const LOG_EPS = 1e-15;

export function logLossScore(predicted: number, observed: 0 | 1): number {
  const p = Math.min(1 - LOG_EPS, Math.max(LOG_EPS, predicted));
  return -(observed * Math.log(p) + (1 - observed) * Math.log(1 - p));
}

export function meanLogLoss(predictions: number[], outcomes: (0 | 1)[]): number {
  if (predictions.length !== outcomes.length || predictions.length === 0) {
    throw new Error("predictions and outcomes must be same non-empty length");
  }
  const total = predictions.reduce((sum, p, i) => sum + logLossScore(p, outcomes[i]!), 0);
  return total / predictions.length;
}

/** Whether a betting action aligns with the resolved binary outcome. WAIT/NO BET are neutral (not scored). */
export function actionMatchesOutcome(action: BetAction, resolvedApproved: boolean): boolean | null {
  if (action === "BET_YES") return resolvedApproved;
  if (action === "BET_NO") return !resolvedApproved;
  return null;
}

export function actionAccuracy(actions: BetAction[], outcomes: boolean[]): number {
  let scored = 0;
  let correct = 0;
  for (let i = 0; i < actions.length; i++) {
    const match = actionMatchesOutcome(actions[i]!, outcomes[i]!);
    if (match == null) continue;
    scored += 1;
    if (match) correct += 1;
  }
  return scored > 0 ? correct / scored : 0;
}

export type EnrichmentRunOutcome = {
  runId: string;
  pInitial: number;
  pEnriched: number;
  probabilityDelta: number;
  initialAction: BetAction;
  enrichedAction: BetAction;
  evidenceAdded: number;
  researchIterations: number;
  stopReason: string;
};

export function buildEnrichmentAbCaseResult(
  abCase: EnrichmentAbCase,
  run: EnrichmentRunOutcome,
): EnrichmentAbCaseResult {
  const initialActionCorrect = actionMatchesOutcome(run.initialAction, abCase.resolvedApproved) ?? false;
  const enrichedActionCorrect = actionMatchesOutcome(run.enrichedAction, abCase.resolvedApproved) ?? false;

  return {
    caseId: abCase.caseId,
    profileId: abCase.profileId,
    enrichmentRunId: run.runId,
    resolvedApproved: abCase.resolvedApproved,
    pInitial: run.pInitial,
    pEnriched: run.pEnriched,
    probabilityDelta: run.probabilityDelta,
    initialAction: run.initialAction,
    enrichedAction: run.enrichedAction,
    evidenceAdded: run.evidenceAdded,
    researchIterations: run.researchIterations,
    stopReason: run.stopReason,
    initialActionCorrect,
    enrichedActionCorrect,
  };
}

export function buildEnrichmentAbReport(
  corpus: EnrichmentAbCorpus,
  caseResults: EnrichmentAbCaseResult[],
): EnrichmentAbReport {
  if (caseResults.length === 0) {
    throw new Error("Enrichment A/B report requires at least one case result");
  }

  const outcomes = caseResults.map((c) => (c.resolvedApproved ? 1 : 0) as 0 | 1);
  const initialPreds = caseResults.map((c) => c.pInitial);
  const enrichedPreds = caseResults.map((c) => c.pEnriched);

  const initialBrier = meanBrier(initialPreds, outcomes);
  const enrichedBrier = meanBrier(enrichedPreds, outcomes);
  const initialLogLoss = meanLogLoss(initialPreds, outcomes);
  const enrichedLogLoss = meanLogLoss(enrichedPreds, outcomes);

  const initialActionAccuracy = actionAccuracy(
    caseResults.map((c) => c.initialAction),
    caseResults.map((c) => c.resolvedApproved),
  );
  const enrichedActionAccuracy = actionAccuracy(
    caseResults.map((c) => c.enrichedAction),
    caseResults.map((c) => c.resolvedApproved),
  );

  const meanAbsoluteProbabilityDelta =
    caseResults.reduce((sum, c) => sum + Math.abs(c.probabilityDelta), 0) / caseResults.length;

  const casesWithEnrichmentSignal = caseResults.filter(
    (c) => c.evidenceAdded > 0 && Math.abs(c.probabilityDelta) > 0,
  ).length;

  return EnrichmentAbReportSchema.parse({
    kind: "enrichment_ab_report",
    generatedAt: new Date().toISOString(),
    corpusDescription: corpus.description,
    caseCount: caseResults.length,
    initialBrier,
    enrichedBrier,
    brierImprovement: initialBrier - enrichedBrier,
    initialLogLoss,
    enrichedLogLoss,
    logLossImprovement: initialLogLoss - enrichedLogLoss,
    initialActionAccuracy,
    enrichedActionAccuracy,
    actionAccuracyDelta: enrichedActionAccuracy - initialActionAccuracy,
    meanAbsoluteProbabilityDelta,
    casesWithEnrichmentSignal,
    enrichmentHelpsCalibration: enrichedBrier <= initialBrier,
    cases: caseResults,
  });
}

/** Attach enrichment telemetry onto prospective corpus rows when caseIds align. */
export function attachEnrichmentTelemetryToProspectiveCorpus(
  corpus: ProspectiveCorpus,
  caseResults: EnrichmentAbCaseResult[],
  caseIdByProfileId: Record<string, string> = {},
): ProspectiveCorpus {
  const byCaseId = new Map(caseResults.map((r) => [r.caseId, r]));
  const byProfileId = new Map(caseResults.map((r) => [r.profileId, r]));

  return {
    ...corpus,
    cases: corpus.cases.map((c) => {
      const match =
        byCaseId.get(c.caseId) ??
        (caseIdByProfileId[c.caseId]
          ? byCaseId.get(caseIdByProfileId[c.caseId]!)
          : undefined) ??
        byProfileId.get(c.caseId);
      if (!match) return c;
      return attachTelemetryToProspectiveCase(c, match);
    }),
  };
}

export function attachTelemetryToProspectiveCase(
  row: ProspectiveCase,
  result: EnrichmentAbCaseResult,
): ProspectiveCase {
  return {
    ...row,
    pInitial: result.pInitial,
    pEnriched: result.pEnriched,
    enrichmentRunId: result.enrichmentRunId,
  };
}

export async function runEnrichmentAbReport(
  corpus: EnrichmentAbCorpus,
  runCase: (abCase: EnrichmentAbCase) => Promise<EnrichmentRunOutcome>,
): Promise<EnrichmentAbReport> {
  const caseResults: EnrichmentAbCaseResult[] = [];
  for (const abCase of corpus.cases) {
    const run = await runCase(abCase);
    caseResults.push(buildEnrichmentAbCaseResult(abCase, run));
  }
  return buildEnrichmentAbReport(corpus, caseResults);
}
