import type { FdaRegulatoryClockExtract } from "../openfda/regulatory-clock.js";
import type { EnrichSeedProgram } from "./enrich-program.js";

export type RetrospectiveClockOverlay = {
  kind: "retrospective_regulatory_clocks";
  description?: string;
  clocks: Record<
    string,
    NonNullable<EnrichSeedProgram["regulatoryClock"]> & {
      /** openFDA / press / FDA review doc URL backing clock facts */
      clockSourceUrl?: string | null;
      clockFirstPublicAt?: string | null;
      clockPassage?: string | null;
    }
  >;
};

function toIso(value: string | null | undefined): string | null {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return `${value}T00:00:00.000Z`;
  return value;
}

/** Merge seed, curated overlay, and openFDA extract into one regulatoryClock for fixture build. */
export function mergeRetrospectiveRegulatoryClock(input: {
  seed: EnrichSeedProgram;
  overlay?: RetrospectiveClockOverlay["clocks"][string] | null;
  fda?: FdaRegulatoryClockExtract | null;
}): EnrichSeedProgram["regulatoryClock"] | undefined {
  const { seed, overlay, fda } = input;
  const seedClock = seed.regulatoryClock;
  const merged = {
    filedAt: toIso(overlay?.filedAt ?? seedClock?.filedAt ?? null),
    acceptedAt: toIso(overlay?.acceptedAt ?? seedClock?.acceptedAt ?? null),
    pdufaDate: toIso(
      overlay?.pdufaDate ?? seedClock?.pdufaDate ?? fda?.pdufaDate ?? seed.regulatoryActionDate ?? null,
    ),
    expectedFilingAt: toIso(overlay?.expectedFilingAt ?? seedClock?.expectedFilingAt ?? null),
    reviewProgram:
      overlay?.reviewProgram ??
      seedClock?.reviewProgram ??
      fda?.reviewProgram ??
      "unknown",
    clockSourceUrl:
      overlay?.clockSourceUrl ??
      seedClock?.clockSourceUrl ??
      fda?.openFdaSourceUrl ??
      null,
    clockFirstPublicAt: toIso(
      overlay?.clockFirstPublicAt ??
        seedClock?.clockFirstPublicAt ??
        overlay?.filedAt ??
        overlay?.acceptedAt ??
        fda?.pdufaDate ??
        null,
    ),
    clockPassage:
      overlay?.clockPassage ??
      seedClock?.clockPassage ??
      (fda?.pdufaDate
        ? `Drugs@FDA ORIG approval ${fda.pdufaDate.slice(0, 10)} for ${seed.applicationNumber ?? seed.preferredName}.`
        : null),
  };

  const hasDates =
    merged.filedAt ||
    merged.acceptedAt ||
    merged.pdufaDate ||
    merged.expectedFilingAt;
  if (!hasDates) return seedClock;

  return merged;
}
