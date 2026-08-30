/** Biological cluster exposure from graph features (Notion). */
export function biologicalClusterExposures(
  positions: Array<{ weight: number; target: string | null; indication: string | null }>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of positions) {
    if (p.target) out[p.target] = (out[p.target] ?? 0) + Math.abs(p.weight);
    if (p.indication) {
      out[p.indication] = (out[p.indication] ?? 0) + Math.abs(p.weight);
    }
  }
  return out;
}
