import { isAvailableAtCutoff } from "@pivotaledge/schemas";

export type LeakageFinding = {
  code: string;
  detail: string;
};

/** Fail closed if any evidence firstPublicAt > informationCutoff. */
export function auditLeakage(input: {
  informationCutoff: string;
  evidence: Array<{ id?: string; firstPublicAt: string | null }>;
  marketDataThrough?: string;
  eventDate: string;
}): { ok: boolean; findings: LeakageFinding[] } {
  const findings: LeakageFinding[] = [];

  for (const e of input.evidence) {
    if (e.firstPublicAt == null) {
      findings.push({
        code: "unknown_public_at",
        detail: e.id ?? "evidence",
      });
      continue;
    }
    if (!isAvailableAtCutoff(e.firstPublicAt, input.informationCutoff)) {
      findings.push({
        code: "post_cutoff_evidence",
        detail: `${e.id ?? "evidence"} @ ${e.firstPublicAt}`,
      });
    }
  }

  if (input.marketDataThrough) {
    // Market features may use data through T-1 only
    if (input.marketDataThrough >= input.eventDate) {
      findings.push({
        code: "market_data_not_t_minus_1",
        detail: `marketThrough=${input.marketDataThrough} event=${input.eventDate}`,
      });
    }
  }

  return { ok: findings.length === 0, findings };
}
