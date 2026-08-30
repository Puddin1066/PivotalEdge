import { runAuditAgent } from "../agents/audit.js";
import { runClinicalPredictionAgent } from "../agents/clinical-prediction.js";
import { runCompanyAgent } from "../agents/company.js";
import { runEnsembleAgent } from "../agents/ensemble.js";
import { runEventStudyAgent } from "../agents/event-study.js";
import { runEquityResponseAgent } from "../agents/equity-response.js";
import { runGraphRetrievalAgent } from "../agents/graph-retrieval.js";
import { runLineageAgent } from "../agents/lineage.js";
import { runLiteratureAgent } from "../agents/literature.js";
import { runMarketAgent } from "../agents/market.js";
import { runOutcomeAgent } from "../agents/outcomes.js";
import { runThesisAgent } from "../agents/thesis.js";
import { runTrialAgent } from "../agents/trial.js";
import { buildEnsemblePrediction } from "../models/ensemble.js";
import type { StructuredTrialFeatures } from "../schemas/event.js";
import type { CatalystEvent } from "../schemas/event.js";
import type { CatalystPrediction } from "../schemas/prediction.js";
import type { FieldEmbeddings } from "../embeddings/trial.js";
import type { EventStudyResult } from "../event-study/abnormal-returns.js";
import { checkpointState, persistFrozenForecast } from "./checkpoints.js";
import { routeAfterAudit } from "./routing.js";
import { initialState, type CatalystPipelineState, type PipelineMode } from "./state.js";

export type PipelineResult = {
  state: CatalystPipelineState;
  prediction: CatalystPrediction | null;
  frozenPath: string | null;
};

function appendLog(state: CatalystPipelineState, response: ReturnType<typeof runTrialAgent>) {
  state.agentLog.push(response);
  for (const s of response.sources) {
    state.provenance.push({
      url: s.url,
      firstPublicAt: s.firstPublicAt,
      agent: response.agent,
    });
  }
}

/**
 * Multi-agent assembly (Notion §5 flowchart).
 * Deterministic sequential graph — no Polymarket, no free-form agent chat.
 */
export async function runCatalystPipeline(
  event: CatalystEvent,
  opts?: { mode?: PipelineMode; runId?: string; freeze?: boolean },
): Promise<PipelineResult> {
  const mode = opts?.mode ?? "historical";
  const runId = opts?.runId ?? `${event.eventId}_${Date.now()}`;
  const state = initialState(event, mode);

  const trial = runTrialAgent(event);
  appendLog(state, trial);
  state.trialFeatures = trial.data.features as StructuredTrialFeatures;
  state.trialEmbeddings = trial.data.embeddings as FieldEmbeddings;
  await checkpointState(runId, "01_trial", state);

  const lineage = runLineageAgent(event);
  appendLog(state, lineage);
  state.assetLineage = lineage.data;
  await checkpointState(runId, "02_lineage", state);

  const company = runCompanyAgent(event);
  appendLog(state, company);
  state.companyFeatures = company.data;
  await checkpointState(runId, "03_company", state);

  const market = await runMarketAgent(event);
  appendLog(state, market);
  state.marketFeatures = market.data;
  await checkpointState(runId, "04_market", state);

  const literature = await runLiteratureAgent(event);
  appendLog(state, literature);
  state.literatureEvidence = (literature.data.evidence as unknown[]) ?? [];

  const graph = await runGraphRetrievalAgent(event);
  appendLog(state, graph);
  state.graphPrecedents = (graph.data.precedents as Array<Record<string, unknown>>) ?? [];

  const histMode = mode === "live" ? "live" : "historical";
  const outcome = runOutcomeAgent(event, histMode);
  appendLog(state, outcome);
  if (outcome.status === "success") state.historicalOutcome = outcome.data;

  const eventStudy = await runEventStudyAgent(event, histMode);
  appendLog(state, eventStudy);
  if (eventStudy.status === "success") {
    state.abnormalReturns = eventStudy.data as unknown as EventStudyResult;
  }

  const clinical = runClinicalPredictionAgent(event, state.trialFeatures!, {
    sameTargetSuccessRate: graph.data.sameTargetSuccessRate as number | undefined,
    nearestAnalogCount: graph.data.nearestAnalogCount as number | undefined,
  });
  appendLog(state, clinical);
  state.pSuccess = clinical.data.pSuccess as number;
  state.pSuccessInterval = clinical.data.pSuccessInterval as [number, number];

  const equity = runEquityResponseAgent(
    event,
    state.graphPrecedents as Array<{
      outcomeLabel: string | null;
      carM1P1: number | null;
    }>,
  );
  appendLog(state, equity);
  state.rSuccess = equity.data.rSuccess as number;
  state.rFailure = equity.data.rFailure as number;

  const ensemble = runEnsembleAgent(event, {
    pSuccess: state.pSuccess!,
    rSuccess: state.rSuccess!,
    rFailure: state.rFailure!,
    nearestAnalogCount: state.graphPrecedents.length,
  });
  appendLog(state, ensemble);
  state.expectedReturn = ensemble.data.expectedCatalystReturn as number;
  state.probabilityEdge = ensemble.data.probabilityEdge as number | null;
  state.edgeScore = ensemble.data.edgeScore as number;
  state.marketImpliedProbability =
    (ensemble.data.marketImpliedProbability as number | null) ?? null;
  await checkpointState(runId, "10_ensemble", state);

  const audit = runAuditAgent(event, state);
  appendLog(state, audit);
  state.auditStatus = audit.data.auditStatus as "pass" | "fail";
  state.auditFindings = (audit.data.findings as string[]) ?? [];

  const route = routeAfterAudit(state);
  if (route.next === "reject") {
    state.stopReason = route.reason;
    await checkpointState(runId, "11_reject", state);
    return { state, prediction: null, frozenPath: null };
  }

  const thesis = runThesisAgent(event, state);
  appendLog(state, thesis);
  state.thesis = thesis.data.thesis as string;
  state.stopReason = "complete";
  await checkpointState(runId, "12_thesis", state);

  const prediction = buildEnsemblePrediction({
    eventId: event.eventId,
    asOf: new Date().toISOString(),
    informationCutoff: event.informationCutoff,
    pSuccess: state.pSuccess!,
    rSuccess: state.rSuccess!,
    rFailure: state.rFailure!,
    marketImpliedProbability: state.marketImpliedProbability,
    nearestAnalogCount: state.graphPrecedents.length,
    contradictoryCaseCount: 0,
    auditStatus: state.auditStatus,
    frozen: Boolean(opts?.freeze),
  });

  let frozenPath: string | null = null;
  if (opts?.freeze) {
    frozenPath = await persistFrozenForecast({
      ...prediction,
      frozenAt: new Date().toISOString(),
      thesis: state.thesis,
    });
  }

  return { state, prediction, frozenPath };
}
