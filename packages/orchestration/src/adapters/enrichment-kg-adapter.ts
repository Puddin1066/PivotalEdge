import type { KgPort } from "../ports/index.js";
import { applyFieldOverrides } from "../enrichment/field-overrides.js";

/** Wraps a KG port and applies in-memory field overrides after executePlan. */
export function createEnrichmentKgAdapter(
  base: KgPort,
  getOverrides: () => Record<string, unknown>,
): KgPort {
  return {
    async executePlan(input) {
      const bundle = await base.executePlan(input);
      return applyFieldOverrides(bundle, getOverrides());
    },
  };
}
