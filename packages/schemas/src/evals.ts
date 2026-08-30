import { z } from "zod";

import { ConfidenceLevelSchema } from "./common.js";
import { HoldoutCaseSchema } from "./fixtures.js";

export const BacktestCaseSchema = HoldoutCaseSchema.extend({
  executableYesAsk: z.number().min(0).max(1),
  executableNoAsk: z.number().min(0).max(1),
  evidenceConfidence: ConfidenceLevelSchema,
  supportingEvidenceCount: z.number().int().nonnegative(),
});
export type BacktestCase = z.infer<typeof BacktestCaseSchema>;

export const BacktestCorpusSchema = z.object({
  kind: z.literal("backtest_chrono_corpus"),
  description: z.string(),
  initialBankroll: z.number().positive(),
  cases: z.array(BacktestCaseSchema).min(6),
});
export type BacktestCorpus = z.infer<typeof BacktestCorpusSchema>;

export const BacktestTradeSchema = z.object({
  caseId: z.string(),
  forecastCutoff: z.string(),
  action: z.enum(["BET_YES", "BET_NO", "WAIT", "NO_BET"]),
  modelProbability: z.number(),
  conservativeProbability: z.number(),
  executablePrice: z.number().nullable(),
  stake: z.number(),
  grossPnL: z.number(),
  feesPaid: z.number(),
  netPnL: z.number(),
  resolvedYes: z.boolean(),
  marketBaselineNetPnL: z.number(),
});
export type BacktestTrade = z.infer<typeof BacktestTradeSchema>;

export const EdgeVsMarketReportSchema = z.object({
  kind: z.literal("edge_vs_market_report"),
  generatedAt: z.string(),
  policyVersion: z.string(),
  modelVersion: z.string(),
  initialBankroll: z.number(),
  finalBankroll: z.number(),
  modelNetPnL: z.number(),
  marketBaselineNetPnL: z.number(),
  edgeVsMarket: z.number(),
  totalTrades: z.number().int(),
  winningTrades: z.number().int(),
  hitRate: z.number().nullable(),
  modelBrier: z.number(),
  marketBrier: z.number(),
  beatsMarketAfterCosts: z.boolean(),
  trades: z.array(BacktestTradeSchema),
});
export type EdgeVsMarketReport = z.infer<typeof EdgeVsMarketReportSchema>;

export const ClinicalCalibrationCaseSchema = HoldoutCaseSchema.extend({
  applicationNumber: z.string().optional(),
  brandName: z.string().optional(),
  sponsorName: z.string().optional(),
  dataProvenance: z.string().optional(),
});
export type ClinicalCalibrationCase = z.infer<typeof ClinicalCalibrationCaseSchema>;

export const ClinicalCalibrationCorpusSchema = z.object({
  kind: z.literal("clinical_calibration_corpus"),
  description: z.string(),
  dataSource: z.string(),
  cases: z.array(ClinicalCalibrationCaseSchema).min(20),
});
export type ClinicalCalibrationCorpus = z.infer<typeof ClinicalCalibrationCorpusSchema>;

export const ReliabilityBinSchema = z.object({
  binLow: z.number(),
  binHigh: z.number(),
  meanPredicted: z.number(),
  empiricalRate: z.number(),
  count: z.number().int().nonnegative(),
});
export type ReliabilityBin = z.infer<typeof ReliabilityBinSchema>;

export const CalibrationStratumSchema = z.object({
  stratumKey: z.string(),
  stratumLabel: z.string(),
  dimension: z.enum(["phase", "therapeuticArea", "applicationFiled", "phase_x_ta"]),
  n: z.number().int().nonnegative(),
  baseRateBrier: z.number(),
  calibratedBrier: z.number(),
  reliability: z.array(ReliabilityBinSchema),
});
export type CalibrationStratum = z.infer<typeof CalibrationStratumSchema>;

export const ClinicalCalibrationCaseResultSchema = z.object({
  caseId: z.string(),
  forecastCutoff: z.string(),
  phase: z.string(),
  therapeuticArea: z.string(),
  applicationFiled: z.boolean(),
  primaryEndpointMet: z.boolean(),
  resolvedApproved: z.boolean(),
  baselineProbability: z.number(),
  calibratedProbability: z.number(),
  applicationNumber: z.string().optional(),
  brandName: z.string().optional(),
});
export type ClinicalCalibrationCaseResult = z.infer<typeof ClinicalCalibrationCaseResultSchema>;

export const ClinicalCalibrationReportSchema = z.object({
  kind: z.literal("clinical_calibration_report"),
  generatedAt: z.string(),
  modelVersion: z.string(),
  corpusKind: z.literal("clinical_calibration_corpus"),
  dataSource: z.string(),
  totalCases: z.number().int(),
  trainCases: z.number().int(),
  testCases: z.number().int(),
  baseRateBrier: z.number(),
  calibratedBrier: z.number(),
  beatsBaseRate: z.boolean(),
  weights: z.object({
    endpointBoost: z.number(),
    filingBoost: z.number(),
    cohortWeight: z.number(),
    biomarkerBoost: z.number().optional(),
    orphanBoost: z.number().optional(),
    priorApprovalBoost: z.number().optional(),
    designationBoost: z.number().optional(),
    underEnrollmentPenalty: z.number().optional(),
  }),
  globalReliability: z.array(ReliabilityBinSchema),
  strata: z.array(CalibrationStratumSchema),
  cases: z.array(ClinicalCalibrationCaseResultSchema),
});
export type ClinicalCalibrationReport = z.infer<typeof ClinicalCalibrationReportSchema>;

export const ResolvedMarketCaseResultSchema = z.object({
  caseId: z.string(),
  forecastCutoff: z.string(),
  resolvedApproved: z.boolean(),
  modelProbability: z.number(),
  conservativeProbability: z.number(),
  marketImpliedProbability: z.number(),
  executableYesAsk: z.number(),
  executableNoAsk: z.number(),
  action: z.enum(["BET_YES", "BET_NO", "WAIT", "NO_BET"]),
  netPnL: z.number(),
  marketBaselineNetPnL: z.number(),
  trainCasesUsed: z.number().int().nonnegative(),
});
export type ResolvedMarketCaseResult = z.infer<typeof ResolvedMarketCaseResultSchema>;

export const ResolvedMarketRetroReportSchema = z.object({
  kind: z.literal("resolved_market_retro_report"),
  generatedAt: z.string(),
  modelVersion: z.string(),
  policyVersion: z.string(),
  askProvenance: z.string(),
  marketCases: z.number().int(),
  clinicalTrainPool: z.number().int(),
  scoredCases: z.number().int(),
  modelBrier: z.number(),
  marketBrier: z.number(),
  beatsMarketBrier: z.boolean(),
  modelNetPnL: z.number(),
  marketBaselineNetPnL: z.number(),
  edgeVsMarket: z.number(),
  beatsMarketAfterCosts: z.boolean(),
  cases: z.array(ResolvedMarketCaseResultSchema),
});
export type ResolvedMarketRetroReport = z.infer<typeof ResolvedMarketRetroReportSchema>;

export const RetrospectiveGateReportSchema = z.object({
  kind: z.literal("retrospective_gate_report"),
  generatedAt: z.string(),
  passed: z.boolean(),
  clinical: z.object({
    passed: z.boolean(),
    totalCases: z.number().int(),
    testCases: z.number().int(),
    baseRateBrier: z.number(),
    calibratedBrier: z.number(),
    beatsBaseRate: z.boolean(),
  }),
  resolvedMarkets: z.object({
    passed: z.boolean(),
    scoredCases: z.number().int(),
    modelBrier: z.number(),
    marketBrier: z.number(),
    beatsMarketBrier: z.boolean(),
    edgeVsMarket: z.number(),
    beatsMarketAfterCosts: z.boolean(),
    askProvenance: z.string(),
    edgeInformational: z.boolean(),
  }),
  syntheticEdgeSmoke: z.object({
    passed: z.boolean(),
    beatsMarketAfterCosts: z.boolean(),
    edgeVsMarket: z.number(),
    totalTrades: z.number().int(),
  }),
  blockers: z.array(z.string()),
});
export type RetrospectiveGateReport = z.infer<typeof RetrospectiveGateReportSchema>;
