import { isAvailableAtCutoff } from "@pivotaledge/schemas";

import { daysBetween } from "./clock-metrics.js";
import type { GraphProgram, InMemoryKnowledgeGraph } from "./graph.js";

/** Normalize endpoint family tokens for cohort matching. */
export function endpointFamilyMatches(
  programFamily: string | null | undefined,
  filterFamily: string,
): boolean {
  if (!programFamily) return false;
  const norm = programFamily.toLowerCase();
  const filter = filterFamily.toLowerCase();
  if (norm === filter) return true;
  if (filter === "overall_survival" && (norm === "os" || norm.includes("survival"))) {
    return true;
  }
  return false;
}

export type PeToFilingLag = {
  days: number;
  pePublicAt: string;
  filingAt: string;
  /** True when lag uses expectedFilingAt (guidance) rather than actual filedAt/acceptedAt. */
  guidanceProxy: boolean;
  /** True when lag uses acceptedAt without filedAt or filing guidance (retrospective cohort). */
  acceptanceProxy: boolean;
};

/** Earliest cutoff-safe public date for a positive primary endpoint readout. */
export function primaryEndpointPublicAt(
  program: GraphProgram,
  forecastCutoff: string,
): string | null {
  let pePublicAt: string | null = null;
  for (const r of program.trialResults) {
    if (r.primaryEndpointMet !== true) continue;
    if (!isAvailableAtCutoff(r.provenance.firstPublicAt, forecastCutoff)) continue;
    if (pePublicAt == null || Date.parse(r.provenance.firstPublicAt) < Date.parse(pePublicAt)) {
      pePublicAt = r.provenance.firstPublicAt;
    }
  }
  return pePublicAt;
}

/** Days from first public primary-endpoint result to filing milestone at cutoff. */
export function computePeToFilingLag(
  program: GraphProgram,
  forecastCutoff: string,
): PeToFilingLag | null {
  const pePublicAt = primaryEndpointPublicAt(program, forecastCutoff);
  if (!pePublicAt) return null;

  const app = program.application;
  const clockPublic =
    app?.clockProvenance == null ||
    isAvailableAtCutoff(app.clockProvenance.firstPublicAt, forecastCutoff);

  const filedAt = clockPublic ? app?.filedAt ?? null : null;
  const acceptedAt = clockPublic ? app?.acceptedAt ?? null : null;
  const expectedFilingAt = clockPublic ? app?.expectedFilingAt ?? null : null;

  const filingAt = filedAt ?? acceptedAt ?? expectedFilingAt;
  if (!filingAt) return null;

  const guidanceProxy = filedAt == null && acceptedAt == null && expectedFilingAt != null;
  const acceptanceProxy = filedAt == null && acceptedAt != null && expectedFilingAt == null;
  if (filedAt && !isAvailableAtCutoff(filedAt, forecastCutoff)) return null;
  if (acceptedAt && !isAvailableAtCutoff(acceptedAt, forecastCutoff)) return null;
  if (!filedAt && !acceptedAt && expectedFilingAt && !clockPublic) return null;

  const days = daysBetween(pePublicAt, filingAt);
  if (days == null || days < 0) return null;

  return {
    days,
    pePublicAt,
    filingAt,
    guidanceProxy,
    acceptanceProxy,
  };
}

export function matchesPeToFilingLagCohort(
  gp: GraphProgram,
  filters: Record<string, unknown>,
  forecastCutoff: string,
  graph: InMemoryKnowledgeGraph,
): boolean {
  const features = graph.clinicalFeaturesAtCutoff(gp, forecastCutoff);
  if (features.primaryEndpointMet !== true) return false;
  if (filters.phase && gp.trials[0]?.phase !== filters.phase) return false;
  if (
    filters.endpointFamily &&
    !endpointFamilyMatches(features.endpointFamily, String(filters.endpointFamily))
  ) {
    return false;
  }
  return computePeToFilingLag(gp, forecastCutoff) != null;
}

export function medianLagDays(lags: number[]): number | null {
  if (!lags.length) return null;
  const sorted = [...lags].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1]! + sorted[mid]!) / 2)
    : sorted[mid]!;
}
