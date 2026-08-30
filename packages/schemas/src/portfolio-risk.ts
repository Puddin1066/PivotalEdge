import { z } from "zod";

import { IsoDateTimeSchema } from "./common.js";

export const PortfolioRiskScenarioIdSchema = z.enum([
  "base_independent",
  "fda_delay_year",
  "ta_oncology_risk",
  "same_quarter_cluster",
  "adverse_p",
]);
export type PortfolioRiskScenarioId = z.infer<typeof PortfolioRiskScenarioIdSchema>;

export const PortfolioRiskSummarySchema = z.object({
  stake: z.number().nonnegative(),
  expectedPnl: z.number(),
  expectedReturnOnStake: z.number(),
  pLoss: z.number().min(0).max(1),
  scenarioId: PortfolioRiskScenarioIdSchema.optional(),
});
export type PortfolioRiskSummary = z.infer<typeof PortfolioRiskSummarySchema>;

export const PortfolioRiskBucketSchema = z.object({
  id: z.string(),
  label: z.string(),
  probability: z.number().min(0).max(1),
  minReturn: z.number(),
  maxReturn: z.number().nullable(),
});
export type PortfolioRiskBucket = z.infer<typeof PortfolioRiskBucketSchema>;

export const PortfolioRiskDistributionSchema = z.object({
  stake: z.number().nonnegative(),
  method: z.enum(["independent_bernoulli", "scenario_mixture"]),
  scenarioId: PortfolioRiskScenarioIdSchema.nullable(),
  meanPnl: z.number(),
  pLoss: z.number().min(0).max(1),
  pLossHalf: z.number().min(0).max(1),
  p05Pnl: z.number(),
  p95Pnl: z.number(),
  buckets: z.array(PortfolioRiskBucketSchema),
});
export type PortfolioRiskDistribution = z.infer<typeof PortfolioRiskDistributionSchema>;

export const PortfolioRiskLineSchema = z.object({
  marketId: z.string(),
  slug: z.string(),
  question: z.string(),
  side: z.enum(["YES", "NO"]),
  href: z.string(),
  stake: z.number().nonnegative(),
  ask: z.number().min(0).max(1),
  askSize: z.number().nullable(),
  pWin: z.number().min(0).max(1),
  netEdge: z.number(),
  breakEvenP: z.number(),
  cushionPp: z.number(),
  naiveEv: z.number(),
  stressEv: z.number(),
  fragile: z.boolean(),
  liquidityFlags: z.array(z.string()),
  fillable: z.boolean(),
  therapeuticArea: z.string(),
  deadlineCluster: z.string(),
  eventDeadline: z.string().nullable(),
});
export type PortfolioRiskLine = z.infer<typeof PortfolioRiskLineSchema>;

export const PortfolioRiskScenarioRowSchema = z.object({
  id: PortfolioRiskScenarioIdSchema,
  label: z.string(),
  expectedPnl: z.number(),
  pLoss: z.number().min(0).max(1),
  note: z.string(),
  worstLine: z.string().nullable(),
});
export type PortfolioRiskScenarioRow = z.infer<typeof PortfolioRiskScenarioRowSchema>;

export const PortfolioRiskReportSchema = z.object({
  kind: z.literal("ops_portfolio_risk_report"),
  riskVersion: z.literal("portfolio-risk@1"),
  generatedAt: IsoDateTimeSchema,
  portfolioRef: z.object({
    policyVersion: z.string(),
    deployed: z.number(),
    deployBudget: z.number(),
    bankroll: z.number(),
    lineCount: z.number().int(),
  }),
  probabilityMode: z.enum(["conservative", "model"]),
  clinicalConviction: z.enum(["demo", "calibrated"]),
  asksFresh: z.boolean(),
  evaluationStake: z.number().nonnegative(),
  naive: PortfolioRiskSummarySchema,
  stress: PortfolioRiskSummarySchema,
  scenarios: z.array(PortfolioRiskScenarioRowSchema),
  distribution: PortfolioRiskDistributionSchema,
  lines: z.array(PortfolioRiskLineSchema),
  fragileCount: z.number().int().nonnegative(),
  liquidityOkCount: z.number().int().nonnegative(),
  excluded: z.array(
    z.object({
      marketId: z.string(),
      slug: z.string().optional(),
      question: z.string().optional(),
      reason: z.string(),
    }),
  ),
  notes: z.array(z.string()),
  riskStatement: z.string(),
});
export type PortfolioRiskReport = z.infer<typeof PortfolioRiskReportSchema>;
