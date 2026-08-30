import type { CatalystEvent } from "../schemas/event.js";

/** Conditional CAR means by historical outcome (Model 1–3 precursor). */
export function estimateConditionalCar(
  event: CatalystEvent,
  precedents: Array<{ outcomeLabel: string | null; carM1P1: number | null }>,
): { rSuccess: number; rFailure: number } {
  const pos = precedents.filter(
    (p) => p.outcomeLabel === "positive" && p.carM1P1 != null,
  );
  const neg = precedents.filter(
    (p) => p.outcomeLabel === "negative" && p.carM1P1 != null,
  );

  const mean = (xs: number[], fallback: number) =>
    xs.length === 0 ? fallback : xs.reduce((a, b) => a + b, 0) / xs.length;

  let rSuccess = mean(
    pos.map((p) => p.carM1P1!),
    0.25,
  );
  let rFailure = mean(
    neg.map((p) => p.carM1P1!),
    -0.35,
  );

  // Scale by company size: microcaps move more
  const mcap = event.companyMarketCapPreEvent ?? 2_000_000_000;
  const scale = mcap < 1_000_000_000 ? 1.4 : mcap < 5_000_000_000 ? 1.1 : 0.85;
  rSuccess *= scale;
  rFailure *= scale;

  if (event.pipelineConcentration != null && event.pipelineConcentration > 0.6) {
    rSuccess *= 1.15;
    rFailure *= 1.15;
  }

  return { rSuccess, rFailure };
}
