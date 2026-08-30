import { z } from "zod";

import { IsoDateTimeSchema } from "./common.js";

export const PortfolioPolicyConfigSchema = z.object({
  policyVersion: z.literal("portfolio-policy@1"),
  minNetEdge: z.number().min(0).max(1).default(0.05),
  maxDeployFraction: z.number().min(0).max(1).default(0.1),
  maxNameFraction: z.number().min(0).max(1).default(0.02),
  maxSlugFractionOfDeploy: z.number().min(0).max(1).default(0.25),
  maxTherapeuticAreaFractionOfDeploy: z.number().min(0).max(1).default(0.4),
  maxDeadlineClusterFractionOfDeploy: z.number().min(0).max(1).default(0.4),
  maxSponsorFractionOfDeploy: z.number().min(0).max(1).default(0.3),
  minLineNotional: z.number().positive().default(25),
  minAskSize: z.number().nonnegative().default(50),
  staleAskHaircut: z.number().min(0).max(1).default(0.5),
  demoConvictionHaircut: z.number().min(0).max(1).default(0.5),
  missingLiquidityFactor: z.number().min(0).max(1).default(0.75),
});
export type PortfolioPolicyConfig = z.infer<typeof PortfolioPolicyConfigSchema>;

export const DEFAULT_PORTFOLIO_POLICY: PortfolioPolicyConfig =
  PortfolioPolicyConfigSchema.parse({
    policyVersion: "portfolio-policy@1",
  });

export const PortfolioLineSchema = z.object({
  marketId: z.string().min(1),
  slug: z.string().min(1),
  question: z.string().min(1),
  side: z.enum(["YES", "NO"]),
  action: z.enum(["BET_YES", "BET_NO"]),
  netEdge: z.number(),
  score: z.number().nonnegative(),
  uncappedNotional: z.number().nonnegative(),
  suggestedNotional: z.number().nonnegative(),
  weightOfDeploy: z.number().min(0).max(1),
  therapeuticArea: z.string(),
  sponsor: z.string().nullable(),
  deadlineCluster: z.string(),
  eventDeadline: z.string().nullable(),
  haircuts: z.array(z.string()),
  evidenceConfidence: z.string(),
  href: z.string().min(1),
});
export type PortfolioLine = z.infer<typeof PortfolioLineSchema>;

export const PortfolioExclusionSchema = z.object({
  marketId: z.string().min(1),
  slug: z.string().optional(),
  question: z.string().optional(),
  reason: z.string().min(1),
});
export type PortfolioExclusion = z.infer<typeof PortfolioExclusionSchema>;

export const PortfolioSuggestionSchema = z.object({
  kind: z.literal("ops_portfolio_suggestion"),
  policyVersion: z.literal("portfolio-policy@1"),
  generatedAt: IsoDateTimeSchema,
  bankroll: z.number().positive(),
  deployBudget: z.number().nonnegative(),
  deployed: z.number().nonnegative(),
  cashReserve: z.number().nonnegative(),
  clinicalConviction: z.enum(["demo", "calibrated"]),
  asksFresh: z.boolean(),
  lineCount: z.number().int().nonnegative(),
  lines: z.array(PortfolioLineSchema),
  excluded: z.array(PortfolioExclusionSchema),
  notes: z.array(z.string()),
  riskStatement: z.string().min(1),
});
export type PortfolioSuggestion = z.infer<typeof PortfolioSuggestionSchema>;
