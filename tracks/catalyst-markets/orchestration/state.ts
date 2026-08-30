import type { AgentResponse } from "../schemas/agent-outputs.js";
import type { CatalystEvent, StructuredTrialFeatures } from "../schemas/event.js";
import type { FieldEmbeddings } from "../embeddings/trial.js";
import type { EventStudyResult } from "../event-study/abnormal-returns.js";

export type PipelineMode = "historical" | "backtest" | "live";

export type ProvenanceRef = {
  url: string | null;
  firstPublicAt: string | null;
  agent: string;
};

/**
 * Shared multi-agent state (Notion §5).
 * Stores compact fields — not full document blobs.
 */
export type CatalystPipelineState = {
  mode: PipelineMode;
  event: CatalystEvent;
  informationCutoff: string;
  trialFeatures: StructuredTrialFeatures | null;
  trialEmbeddings: FieldEmbeddings | null;
  assetLineage: Record<string, unknown> | null;
  companyFeatures: Record<string, unknown> | null;
  marketFeatures: Record<string, unknown> | null;
  literatureEvidence: unknown[];
  graphPrecedents: Array<Record<string, unknown>>;
  historicalOutcome: Record<string, unknown> | null;
  abnormalReturns: EventStudyResult | null;
  pSuccess: number | null;
  pSuccessInterval: [number, number] | null;
  rSuccess: number | null;
  rFailure: number | null;
  expectedReturn: number | null;
  marketImpliedProbability: number | null;
  probabilityEdge: number | null;
  edgeScore: number | null;
  auditStatus: "pass" | "fail" | "pending";
  auditFindings: string[];
  provenance: ProvenanceRef[];
  agentLog: AgentResponse[];
  thesis: string | null;
  stopReason: string | null;
};

export function initialState(
  event: CatalystEvent,
  mode: PipelineMode,
): CatalystPipelineState {
  return {
    mode,
    event,
    informationCutoff: event.informationCutoff,
    trialFeatures: null,
    trialEmbeddings: null,
    assetLineage: null,
    companyFeatures: null,
    marketFeatures: null,
    literatureEvidence: [],
    graphPrecedents: [],
    historicalOutcome: null,
    abnormalReturns: null,
    pSuccess: null,
    pSuccessInterval: null,
    rSuccess: null,
    rFailure: null,
    expectedReturn: null,
    marketImpliedProbability: event.marketImpliedProbability ?? null,
    probabilityEdge: null,
    edgeScore: null,
    auditStatus: "pending",
    auditFindings: [],
    provenance: [],
    agentLog: [],
    thesis: null,
    stopReason: null,
  };
}
