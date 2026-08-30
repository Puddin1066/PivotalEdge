/** Shared day-diff helpers (no ModelFeatures import — avoids cycles). */

import { readFileSync } from "node:fs";
import path from "node:path";

import { defaultFixturesRoot } from "@pivotaledge/schemas";

const MS_PER_DAY = 86_400_000;

type ReviewDurationPriors = {
  windowsDays: Record<string, number>;
};

type PeFilingLagPriorsFile = {
  strata: Record<string, { medianDays: number; sampleSize?: number; source?: string }>;
};

let cachedPriors: ReviewDurationPriors | null = null;
let cachedPeFilingPriors: PeFilingLagPriorsFile | null = null;

function loadReviewDurationPriors(): ReviewDurationPriors | null {
  if (cachedPriors) return cachedPriors;
  try {
    const p = path.join(defaultFixturesRoot(), "calibration/fda-review-duration-priors.json");
    cachedPriors = JSON.parse(readFileSync(p, "utf8")) as ReviewDurationPriors;
    return cachedPriors;
  } catch {
    return null;
  }
}

export function daysBetween(aIso: string | null | undefined, bIso: string | null | undefined): number | null {
  if (!aIso || !bIso) return null;
  const a = Date.parse(aIso);
  const b = Date.parse(bIso);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return (b - a) / MS_PER_DAY;
}

const FALLBACK_WINDOWS: Record<string, number> = {
  cnpv: 45,
  priority: 180,
  accelerated: 180,
  standard: 300,
  unknown: 240,
};

export function inferredReviewWindowDays(reviewProgram: string | null | undefined): number {
  const key = reviewProgram && reviewProgram in FALLBACK_WINDOWS ? reviewProgram : "unknown";
  const priors = loadReviewDurationPriors();
  if (priors?.windowsDays?.[key] != null) return priors.windowsDays[key]!;
  return FALLBACK_WINDOWS[key] ?? 240;
}

const FALLBACK_PE_FILING_LAG: Record<string, number> = {
  "oncology:III": 540,
  "metabolic:III": 315,
  "default:III": 365,
};

function loadPeToFilingLagPriors(): PeFilingLagPriorsFile | null {
  if (cachedPeFilingPriors) return cachedPeFilingPriors;
  try {
    const p = path.join(defaultFixturesRoot(), "calibration/pe-to-filing-lag-priors.json");
    cachedPeFilingPriors = JSON.parse(readFileSync(p, "utf8")) as PeFilingLagPriorsFile;
    return cachedPeFilingPriors;
  } catch {
    return null;
  }
}

/** Median PE→filing lag days for a therapeutic area × phase stratum. */
export function inferredPeToFilingLagDays(
  therapeuticArea: string | null | undefined,
  phase: string | null | undefined,
): number {
  const key = `${therapeuticArea ?? "default"}:${phase ?? "III"}`;
  const priors = loadPeToFilingLagPriors();
  const fromFile = priors?.strata?.[key]?.medianDays;
  if (fromFile != null) return fromFile;
  const fallback = priors?.strata?.["default:III"]?.medianDays;
  if (fallback != null) return fallback;
  return FALLBACK_PE_FILING_LAG[key] ?? FALLBACK_PE_FILING_LAG["default:III"]!;
}
