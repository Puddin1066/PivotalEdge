import type { GraphProgram, InMemoryKnowledgeGraph } from "./graph.js";
import { computePeToFilingLag, medianLagDays } from "./filing-lag.js";

export type PeFilingLagStratum = {
  medianDays: number;
  sampleSize: number;
  source: "measured" | "default_prior";
  p25Days?: number;
  p75Days?: number;
};

export type PeToFilingLagPriors = {
  kind: "pe_to_filing_lag_priors";
  version: number;
  description: string;
  strata: Record<string, PeFilingLagStratum>;
  measuredPrograms: Array<{
    programId: string;
    drugName: string;
    therapeuticArea: string | null;
    phase: string | null;
    lagDays: number;
    guidanceProxy: boolean;
    acceptanceProxy?: boolean;
  }>;
  updatedAt: string;
};

const DEFAULT_STRATA: Record<string, Omit<PeFilingLagStratum, "sampleSize"> & { sampleSize: 0 }> = {
  "oncology:III": { medianDays: 540, sampleSize: 0, source: "default_prior" },
  "metabolic:III": { medianDays: 315, sampleSize: 0, source: "default_prior" },
  "default:III": { medianDays: 365, sampleSize: 0, source: "default_prior" },
};

function stratumKey(therapeuticArea: string | null | undefined, phase: string | null | undefined): string {
  return `${therapeuticArea ?? "default"}:${phase ?? "III"}`;
}

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo]!;
  return Math.round(sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (idx - lo));
}

/** Build PE→filing lag priors from an in-memory KG at a fixed cutoff. */
export function buildPeToFilingLagPriors(
  graph: InMemoryKnowledgeGraph,
  forecastCutoff: string,
): PeToFilingLagPriors {
  const measuredPrograms: PeToFilingLagPriors["measuredPrograms"] = [];
  const byStratum = new Map<string, number[]>();

  for (const gp of graph.listPrograms()) {
    const lag = computePeToFilingLag(gp, forecastCutoff);
    // Submission priors: filedAt, sponsor filing guidance, or FDA acceptance (retrospective).
    if (
      !lag ||
      (!lag.guidanceProxy && !gp.application?.filedAt && !lag.acceptanceProxy)
    ) {
      continue;
    }
    const key = stratumKey(gp.indication.therapeuticArea, gp.trials[0]?.phase ?? null);
    const bucket = byStratum.get(key) ?? [];
    bucket.push(lag.days);
    byStratum.set(key, bucket);
    measuredPrograms.push({
      programId: gp.program.id,
      drugName: gp.drug.preferredName,
      therapeuticArea: gp.indication.therapeuticArea,
      phase: gp.trials[0]?.phase ?? null,
      lagDays: lag.days,
      guidanceProxy: lag.guidanceProxy,
      acceptanceProxy: lag.acceptanceProxy,
    });
  }

  const strata: Record<string, PeFilingLagStratum> = {};
  for (const [key, defaults] of Object.entries(DEFAULT_STRATA)) {
    const lags = byStratum.get(key) ?? [];
    if (lags.length > 0) {
      const sorted = [...lags].sort((a, b) => a - b);
      strata[key] = {
        medianDays: medianLagDays(sorted) ?? defaults.medianDays,
        sampleSize: sorted.length,
        source: "measured",
        p25Days: percentile(sorted, 0.25),
        p75Days: percentile(sorted, 0.75),
      };
      strata[key]!.medianDays = Math.round(strata[key]!.medianDays);
    } else {
      strata[key] = { ...defaults };
    }
  }

  for (const [key, lags] of byStratum) {
    if (strata[key]) continue;
    const sorted = [...lags].sort((a, b) => a - b);
    strata[key] = {
      medianDays: medianLagDays(sorted) ?? DEFAULT_STRATA["default:III"]!.medianDays,
      sampleSize: sorted.length,
      source: "measured",
      p25Days: percentile(sorted, 0.25),
      p75Days: percentile(sorted, 0.75),
    };
  }

  return {
    kind: "pe_to_filing_lag_priors",
    version: 1,
    description:
      "Median days from public primary-endpoint readout to filing milestone (filedAt, acceptance, or sponsor guidance). Default strata used when measured n=0.",
    strata,
    measuredPrograms,
    updatedAt: forecastCutoff.slice(0, 10),
  };
}

export function stratumKeyForProgram(gp: GraphProgram): string {
  return stratumKey(gp.indication.therapeuticArea, gp.trials[0]?.phase ?? null);
}

/** Calibration prior median PE→filing lag (days) when cohort n=0. */
export function defaultPeToFilingLagDays(
  therapeuticArea: string | null | undefined,
  phase: string | null | undefined = "III",
): number {
  const key = stratumKey(therapeuticArea, phase);
  return DEFAULT_STRATA[key]?.medianDays ?? DEFAULT_STRATA["default:III"]!.medianDays;
}
