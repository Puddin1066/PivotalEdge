import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

import {
  ClinicalProgramSchema,
  DocumentSchema,
  DrugAssetSchema,
  IndicationSchema,
  RegulatoryActionSchema,
  RegulatoryApplicationSchema,
  SponsorSchema,
  TrialResultSchema,
  ClinicalTrialSchema,
  EndpointSchema,
  MechanismSchema,
  DesignationSchema,
  ApprovedTherapyLinkSchema,
  PriorApprovalLinkSchema,
} from "./entities.js";
import { MarketQuestionSchema, OrderBookSnapshotSchema, PredictionMarketSchema } from "./market.js";
import { BacktestCorpusSchema, ClinicalCalibrationCorpusSchema } from "./evals.js";
import { FrozenOpportunitySnapshotSchema } from "./opportunity.js";
import { ProspectiveCorpusSchema } from "./paper.js";
import { EnrichmentAbCorpusSchema } from "./orchestration.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Default fixtures root: repo `/fixtures` (two levels up from packages/schemas/src). */
export function defaultFixturesRoot(): string {
  return path.resolve(__dirname, "../../../fixtures");
}

export const ProgramFixtureSchema = z.object({
  kind: z.literal("clinical_program"),
  drugAsset: DrugAssetSchema,
  sponsor: SponsorSchema,
  indication: IndicationSchema,
  program: ClinicalProgramSchema,
  mechanisms: z.array(MechanismSchema).default([]),
  trials: z.array(ClinicalTrialSchema).default([]),
  endpoints: z.array(EndpointSchema).default([]),
  trialResults: z.array(TrialResultSchema).default([]),
  application: RegulatoryApplicationSchema.nullable(),
  regulatoryAction: RegulatoryActionSchema.nullable(),
  designations: z.array(DesignationSchema).default([]),
  approvedTherapiesInIndication: z.array(ApprovedTherapyLinkSchema).default([]),
  priorApprovals: z.array(PriorApprovalLinkSchema).default([]),
  documents: z.array(DocumentSchema).default([]),
});
export type ProgramFixture = z.output<typeof ProgramFixtureSchema>;

export const MarketFixtureSchema = z.object({
  kind: z.literal("prediction_market"),
  market: PredictionMarketSchema,
  marketQuestion: MarketQuestionSchema,
});
export type MarketFixture = z.output<typeof MarketFixtureSchema>;

export async function loadJsonFixture<S extends z.ZodTypeAny>(
  filePath: string,
  schema: S,
): Promise<z.output<S>> {
  const raw = await readFile(filePath, "utf8");
  const data: unknown = JSON.parse(raw);
  return schema.parse(data);
}

export async function loadProgramFixture(
  relativePath: string,
  fixturesRoot = defaultFixturesRoot(),
): Promise<ProgramFixture> {
  return loadJsonFixture(path.join(fixturesRoot, relativePath), ProgramFixtureSchema);
}

export async function loadMarketFixture(
  relativePath: string,
  fixturesRoot = defaultFixturesRoot(),
): Promise<MarketFixture> {
  return loadJsonFixture(path.join(fixturesRoot, relativePath), MarketFixtureSchema);
}

export const HoldoutCaseSchema = z.object({
  caseId: z.string().min(1),
  forecastCutoff: z.string().min(1),
  phase: z.string().min(1),
  therapeuticArea: z.string().min(1),
  primaryEndpointMet: z.boolean(),
  applicationFiled: z.boolean(),
  resolvedApproved: z.boolean(),
  biomarkerEnriched: z.boolean().optional(),
  orphanDesignated: z.boolean().optional(),
  priorApprovalCount: z.number().int().nonnegative().optional(),
  designationCount: z.number().int().nonnegative().optional(),
  enrollmentRatio: z.number().nullable().optional(),
  trialStatus: z.string().nullable().optional(),
  endpointFamily: z.string().nullable().optional(),
});
export type HoldoutCase = z.output<typeof HoldoutCaseSchema>;

export const HoldoutCorpusSchema = z.object({
  kind: z.literal("forecast_holdout_corpus"),
  description: z.string(),
  cases: z.array(HoldoutCaseSchema).min(3),
});
export type HoldoutCorpus = z.output<typeof HoldoutCorpusSchema>;

export async function loadHoldoutCorpus(
  relativePath = "holdout/chrono-corpus.json",
  fixturesRoot = defaultFixturesRoot(),
): Promise<HoldoutCorpus> {
  return loadJsonFixture(path.join(fixturesRoot, relativePath), HoldoutCorpusSchema);
}

export const OrderBookFixtureSchema = z.object({
  kind: z.literal("orderbook_snapshot"),
  orderBook: OrderBookSnapshotSchema,
});
export type OrderBookFixture = z.output<typeof OrderBookFixtureSchema>;

export async function loadOrderBookFixture(
  relativePath: string,
  fixturesRoot = defaultFixturesRoot(),
): Promise<z.output<typeof OrderBookSnapshotSchema>> {
  const fixture = await loadJsonFixture(
    path.join(fixturesRoot, relativePath),
    OrderBookFixtureSchema,
  );
  return fixture.orderBook;
}

export async function loadFrozenOpportunitySnapshot(
  relativePath: string,
  fixturesRoot = defaultFixturesRoot(),
) {
  return loadJsonFixture(path.join(fixturesRoot, relativePath), FrozenOpportunitySnapshotSchema);
}

export async function loadBacktestCorpus(
  relativePath = "backtest/chrono-corpus.json",
  fixturesRoot = defaultFixturesRoot(),
) {
  return loadJsonFixture(path.join(fixturesRoot, relativePath), BacktestCorpusSchema);
}

export async function loadProspectiveCorpus(
  relativePath = "paper/prospective-corpus.json",
  fixturesRoot = defaultFixturesRoot(),
) {
  return loadJsonFixture(path.join(fixturesRoot, relativePath), ProspectiveCorpusSchema);
}

export async function loadEnrichmentAbCorpus(
  relativePath = "orchestration/enrichment-ab-corpus.json",
  fixturesRoot = defaultFixturesRoot(),
) {
  return loadJsonFixture(path.join(fixturesRoot, relativePath), EnrichmentAbCorpusSchema);
}

export async function loadClinicalCalibrationCorpus(
  relativePath = "calibration/fda-chrono-corpus.json",
  fixturesRoot = defaultFixturesRoot(),
) {
  return loadJsonFixture(path.join(fixturesRoot, relativePath), ClinicalCalibrationCorpusSchema);
}

export async function loadResolvedMarketBacktestCorpus(
  relativePath = "backtest/resolved-fda-july2025.json",
  fixturesRoot = defaultFixturesRoot(),
) {
  return loadJsonFixture(path.join(fixturesRoot, relativePath), BacktestCorpusSchema);
}
