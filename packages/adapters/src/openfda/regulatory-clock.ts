/**
 * Extract regulatory clock milestones from openFDA Drugs@FDA submission history.
 * Filing dates are often absent from the API; pair with curated retrospective overlays.
 */
import type { FdaApplicationSummary } from "./drugsfda.js";

function fdaDateToIso(value: string): string {
  if (/^\d{8}$/.test(value)) {
    return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T00:00:00.000Z`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return `${value}T00:00:00.000Z`;
  }
  return value;
}

export type FdaRegulatoryClockExtract = {
  applicationNumber: string;
  pdufaDate: string | null;
  reviewProgram: "standard" | "priority" | "accelerated" | "cnpv" | "unknown";
  openFdaSourceUrl: string;
  /** Earliest ORIG submission_status_date when status is AP (approval action). */
  originalApprovalDate: string | null;
};

function reviewProgramFromPriority(
  reviewPriority: string | null | undefined,
): FdaRegulatoryClockExtract["reviewProgram"] {
  const p = String(reviewPriority ?? "").toUpperCase();
  if (p === "PRIORITY") return "priority";
  if (p === "STANDARD") return "standard";
  return "unknown";
}

/** Parse ORIG submission approval date and review priority from a Drugs@FDA raw record. */
export function extractOrigRegulatoryClockFromRaw(
  raw: Record<string, unknown>,
  applicationNumber: string,
): FdaRegulatoryClockExtract {
  const submissions = (raw.submissions as unknown[]) ?? [];
  let pdufaDate: string | null = null;
  let reviewProgram: FdaRegulatoryClockExtract["reviewProgram"] = "unknown";

  for (const sub of submissions) {
    if (!sub || typeof sub !== "object") continue;
    const s = sub as Record<string, unknown>;
    if (String(s.submission_type ?? "").toUpperCase() !== "ORIG") continue;
    const status = String(s.submission_status ?? "").toUpperCase();
    if (status !== "AP" || !s.submission_status_date) continue;
    const iso = fdaDateToIso(String(s.submission_status_date));
    if (!pdufaDate || iso < pdufaDate) pdufaDate = iso;
    reviewProgram = reviewProgramFromPriority(String(s.review_priority ?? ""));
  }

  return {
    applicationNumber,
    pdufaDate,
    reviewProgram,
    originalApprovalDate: pdufaDate,
    openFdaSourceUrl: `https://api.fda.gov/drug/drugsfda.json?search=application_number:"${applicationNumber}"`,
  };
}

export function extractOrigRegulatoryClock(
  fda: FdaApplicationSummary,
): FdaRegulatoryClockExtract {
  return extractOrigRegulatoryClockFromRaw(fda.raw, fda.applicationNumber);
}
