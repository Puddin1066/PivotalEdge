/** Illustrative phase × therapeutic-area approval priors (synthetic MVP table). */
export const BASE_RATE_TABLE: ReadonlyArray<{
  phase: string;
  therapeuticArea: string;
  approvalRate: number;
  sampleSize: number;
}> = [
  { phase: "III", therapeuticArea: "oncology", approvalRate: 0.52, sampleSize: 240 },
  { phase: "III", therapeuticArea: "rheumatology", approvalRate: 0.48, sampleSize: 110 },
  { phase: "III", therapeuticArea: "neurology", approvalRate: 0.41, sampleSize: 95 },
  { phase: "III", therapeuticArea: "cardiology", approvalRate: 0.46, sampleSize: 80 },
  { phase: "II", therapeuticArea: "oncology", approvalRate: 0.22, sampleSize: 60 },
  { phase: "II", therapeuticArea: "rheumatology", approvalRate: 0.2, sampleSize: 45 },
  { phase: "II", therapeuticArea: "neurology", approvalRate: 0.18, sampleSize: 40 },
];

const DEFAULT_PHASE = "III";
const DEFAULT_THERAPEUTIC_AREA = "other";
const FALLBACK_RATE = 0.4;

export type BaseRateLookup = {
  phase: string;
  therapeuticArea: string;
  approvalRate: number;
  sampleSize: number;
  matched: boolean;
};

export function lookupBaseRate(
  phase: string | null | undefined,
  therapeuticArea: string | null | undefined,
): BaseRateLookup {
  const p = phase ?? DEFAULT_PHASE;
  const ta = therapeuticArea ?? DEFAULT_THERAPEUTIC_AREA;

  const exact = BASE_RATE_TABLE.find((r) => r.phase === p && r.therapeuticArea === ta);
  if (exact) return { ...exact, matched: true };

  const phaseOnly = BASE_RATE_TABLE.find((r) => r.phase === p);
  if (phaseOnly) {
    return {
      phase: p,
      therapeuticArea: ta,
      approvalRate: phaseOnly.approvalRate,
      sampleSize: phaseOnly.sampleSize,
      matched: false,
    };
  }

  return {
    phase: p,
    therapeuticArea: ta,
    approvalRate: FALLBACK_RATE,
    sampleSize: 50,
    matched: false,
  };
}
