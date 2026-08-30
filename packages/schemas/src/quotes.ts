import { z } from "zod";

import { IsoDateTimeSchema } from "./common.js";

/** Append-only CLOB best-ask snapshot (outside clinical KG). */
export const ArchivedQuoteRowSchema = z.object({
  kind: z.literal("archived_clob_quote"),
  capturedAt: IsoDateTimeSchema,
  marketId: z.string().min(1),
  tokenYesId: z.string().min(1),
  tokenNoId: z.string().min(1),
  bestAskYes: z.number().min(0).max(1).nullable(),
  bestAskNo: z.number().min(0).max(1).nullable(),
  bestAskYesSize: z.number().nonnegative(),
  bestAskNoSize: z.number().nonnegative(),
  source: z.enum(["polymarket_clob", "quotes_snapshot", "kg_score_live"]),
  slug: z.string().optional(),
  question: z.string().optional(),
});
export type ArchivedQuoteRow = z.infer<typeof ArchivedQuoteRowSchema>;

export const QuoteVaultSummarySchema = z.object({
  kind: z.literal("quote_vault_summary"),
  generatedAt: IsoDateTimeSchema,
  archivePath: z.string(),
  totalRows: z.number().int().nonnegative(),
  distinctMarkets: z.number().int().nonnegative(),
  latestCapturedAt: IsoDateTimeSchema.nullable(),
  markets: z.array(
    z.object({
      marketId: z.string(),
      slug: z.string().optional(),
      rows: z.number().int().nonnegative(),
      latestCapturedAt: IsoDateTimeSchema,
      latestBestAskYes: z.number().nullable(),
      latestBestAskNo: z.number().nullable(),
    }),
  ),
});
export type QuoteVaultSummary = z.infer<typeof QuoteVaultSummarySchema>;

/** Bar A graduation checklist for trading-stack readiness (paper, not live execution). */
export const TradingReadinessReportSchema = z.object({
  kind: z.literal("trading_readiness_report"),
  generatedAt: IsoDateTimeSchema,
  clinicalConviction: z.enum(["demo", "calibrated"]),
  liveTradingEnabled: z.literal(false),
  checks: z.object({
    clinicalBeatsBaseRate: z.boolean(),
    clinicalCases: z.number().int(),
    clinicalOos: z.number().int(),
    kgHoldoutBeatsBaseRate: z.boolean(),
    kgHoldoutCases: z.number().int(),
    quoteVaultRows: z.number().int(),
    quoteVaultMarkets: z.number().int(),
    quoteVaultMinRows: z.boolean(),
    quoteVaultDistinctDays: z.number().int().nonnegative().optional(),
    quoteVaultSpanDays: z.number().int().nonnegative().optional(),
    quoteVaultFresh: z.boolean().optional(),
    openPaperPositions: z.number().int(),
    openBetActions: z.number().int(),
  }),
  blockers: z.array(z.string()),
  paperReady: z.boolean(),
  notes: z.string(),
});
export type TradingReadinessReport = z.infer<typeof TradingReadinessReportSchema>;
