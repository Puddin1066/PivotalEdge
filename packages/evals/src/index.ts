import { readdir } from "node:fs/promises";
import path from "node:path";

import { loadProgramFixture, defaultFixturesRoot, type ProgramFixture } from "@pivotaledge/schemas";

export async function loadCorpusPrograms(
  corpusDir = "corpus",
  fixturesRoot = defaultFixturesRoot(),
): Promise<ProgramFixture[]> {
  const dir = path.join(fixturesRoot, corpusDir);
  const entries = await readdir(dir);
  const jsonFiles = entries.filter((f) => f.endsWith(".json")).sort();
  return Promise.all(jsonFiles.map((f) => loadProgramFixture(`${corpusDir}/${f}`, fixturesRoot)));
}

export { runChronologicalBacktest, type ChronologicalBacktestOptions } from "./backtest.js";
export { simulateTradePnL, simulateMarketBaselinePnL } from "./pnl.js";
export { runProspectivePaperSample, portfolioFromProspectiveReport } from "./paper.js";
export {
  runClinicalChronoCalibration,
  type ClinicalChronoCalibrationOptions,
  type StratumDimension,
} from "./calibration.js";
export { buildReliabilityBins, brierForPairs, brierScore } from "./reliability.js";
export { holdoutCaseFromProgram, holdoutCorpusFromPrograms } from "./kg-holdout.js";
export { clinicalCalibrationCaseFromProgram } from "./kg-holdout.js";
export {
  runResolvedMarketRetrospective,
  buildRetrospectiveGateReport,
  type ResolvedMarketRetroOptions,
  type RetrospectiveValidateOptions,
} from "./retrospective.js";
export {
  logLossScore,
  meanLogLoss,
  actionMatchesOutcome,
  actionAccuracy,
  buildEnrichmentAbCaseResult,
  buildEnrichmentAbReport,
  attachEnrichmentTelemetryToProspectiveCorpus,
  attachTelemetryToProspectiveCase,
  runEnrichmentAbReport,
  type EnrichmentRunOutcome,
} from "./enrichment-ab.js";
