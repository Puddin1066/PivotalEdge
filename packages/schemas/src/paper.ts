import { z } from "zod";

import { BetActionSchema, BettingPolicyConfigSchema } from "./bet.js";
import { ConfidenceLevelSchema, IdSchema, IsoDateTimeSchema } from "./common.js";

/** Same fields as BacktestCase — standalone to avoid fixtures↔evals↔paper cycles. */
export const ProspectiveCaseSchema = z.object({
  caseId: z.string().min(1),
  forecastCutoff: z.string().min(1),
  phase: z.string().min(1),
  therapeuticArea: z.string().min(1),
  primaryEndpointMet: z.boolean(),
  applicationFiled: z.boolean(),
  resolvedApproved: z.boolean(),
  executableYesAsk: z.number().min(0).max(1),
  executableNoAsk: z.number().min(0).max(1),
  evidenceConfidence: ConfidenceLevelSchema,
  supportingEvidenceCount: z.number().int().nonnegative(),
  /** Enrichment A/B telemetry — populated when LangGraph run completes (Phase 5). */
  pInitial: z.number().min(0).max(1).optional(),
  pEnriched: z.number().min(0).max(1).optional(),
  enrichmentRunId: IdSchema.optional(),
});
export type ProspectiveCase = z.infer<typeof ProspectiveCaseSchema>;

export const PaperTradeSchema = z.object({
  id: IdSchema,
  caseId: z.string().min(1),
  marketId: IdSchema.nullable(),
  openedAt: IsoDateTimeSchema,
  closedAt: IsoDateTimeSchema.nullable(),
  action: BetActionSchema,
  executablePrice: z.number().min(0).max(1).nullable(),
  stake: z.number().nonnegative(),
  modelProbability: z.number().min(0).max(1),
  conservativeProbability: z.number().min(0).max(1),
  status: z.enum(["open", "resolved", "cancelled"]),
  resolvedYes: z.boolean().nullable(),
  netPnL: z.number().nullable(),
  feesPaid: z.number().nonnegative(),
  simulation: z.literal(true),
});
export type PaperTrade = z.infer<typeof PaperTradeSchema>;

export const PaperPortfolioSchema = z.object({
  id: IdSchema,
  label: z.string().min(1),
  policyVersion: z.string().min(1),
  modelVersion: z.string().min(1),
  initialBankroll: z.number().positive(),
  cash: z.number(),
  openTrades: z.array(PaperTradeSchema),
  closedTrades: z.array(PaperTradeSchema),
  realizedNetPnL: z.number(),
  updatedAt: IsoDateTimeSchema,
  liveTradingEnabled: z.literal(false),
});
export type PaperPortfolio = z.infer<typeof PaperPortfolioSchema>;

export const ProspectiveSampleReportSchema = z.object({
  kind: z.literal("prospective_sample_report"),
  generatedAt: IsoDateTimeSchema,
  freezeCutoff: IsoDateTimeSchema,
  policyVersion: z.string().min(1),
  modelVersion: z.string().min(1),
  calibrationStatus: z.literal("prospective"),
  trainCases: z.number().int().nonnegative(),
  prospectiveCases: z.number().int().nonnegative(),
  paperTrades: z.number().int().nonnegative(),
  winningTrades: z.number().int().nonnegative(),
  hitRate: z.number().nullable(),
  modelBrier: z.number(),
  marketBrier: z.number(),
  calibrated: z.boolean(),
  simulatedNetPnL: z.number(),
  finalBankroll: z.number(),
  initialBankroll: z.number(),
  gatePass: z.boolean(),
  trades: z.array(PaperTradeSchema),
});
export type ProspectiveSampleReport = z.infer<typeof ProspectiveSampleReportSchema>;

/** Provenance lane for radar/dossier UI — clinical demo vs live market vs paper. */
export const RadarDataLaneSchema = z.enum([
  "live_polymarket",
  "fixture_demo",
  "retrospective_paper",
]);
export type RadarDataLane = z.infer<typeof RadarDataLaneSchema>;

export const RadarTradabilitySchema = z.enum([
  "purchasable_now",
  "not_purchasable",
  "simulation_only",
]);
export type RadarTradability = z.infer<typeof RadarTradabilitySchema>;

export const RadarOpportunitySchema = z.object({
  id: IdSchema,
  marketId: IdSchema,
  question: z.string().min(1),
  action: BetActionSchema,
  modelProbability: z.number().min(0).max(1),
  conservativeProbability: z.number().min(0).max(1),
  executablePrice: z.number().min(0).max(1),
  netEdge: z.number(),
  recommendedStake: z.number().nonnegative(),
  evidenceConfidence: ConfidenceLevelSchema,
  opportunityScore: z.number(),
  dossierPath: z.string().min(1),
  orderBooksAreMock: z.boolean(),
  generatedAt: IsoDateTimeSchema,
  dataLane: RadarDataLaneSchema.default("fixture_demo"),
  tradability: RadarTradabilitySchema.default("simulation_only"),
});
export type RadarOpportunity = z.infer<typeof RadarOpportunitySchema>;

export const RadarSnapshotSchema = z.object({
  kind: z.literal("opportunity_radar"),
  generatedAt: IsoDateTimeSchema,
  opportunities: z.array(RadarOpportunitySchema),
  paperPortfolio: PaperPortfolioSchema.nullable(),
});
export type RadarSnapshot = z.infer<typeof RadarSnapshotSchema>;

export const ProspectiveCorpusSchema = z.object({
  kind: z.literal("prospective_paper_corpus"),
  description: z.string(),
  freezeCutoff: IsoDateTimeSchema,
  initialBankroll: z.number().positive(),
  policyConfig: BettingPolicyConfigSchema.optional(),
  cases: z.array(ProspectiveCaseSchema).min(8),
});
export type ProspectiveCorpus = z.infer<typeof ProspectiveCorpusSchema>;
