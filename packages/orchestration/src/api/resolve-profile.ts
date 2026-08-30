import { SYNALPHIMAB_PROFILE, SYNBETALIB_PROFILE, type FixtureProfile } from "../fixtures/profiles.js";
import { resolveLiveProfileForMarket, listLiveMarketIds } from "../services/live-market.js";

const PROFILES_BY_MARKET: Record<string, FixtureProfile> = {
  pm_poly_syn_001: SYNALPHIMAB_PROFILE,
  pm_poly_syn_002: SYNBETALIB_PROFILE,
  synalphimab: SYNALPHIMAB_PROFILE,
  synbetalib: SYNBETALIB_PROFILE,
};

/** Resolve a fixture profile from API marketId (fixtures + live seeded markets). */
export async function resolveProfileForMarket(
  marketId: string,
  forecastCutoff?: string,
): Promise<FixtureProfile> {
  const fixture = PROFILES_BY_MARKET[marketId];
  if (fixture) {
    if (!forecastCutoff) return fixture;
    return { ...fixture, forecastCutoff };
  }

  const live = await resolveLiveProfileForMarket(marketId);
  if (live) {
    if (!forecastCutoff) return live;
    return { ...live, forecastCutoff };
  }

  const fallback = SYNALPHIMAB_PROFILE;
  if (!forecastCutoff) return fallback;
  return { ...fallback, forecastCutoff };
}

/** @deprecated Use async resolveProfileForMarket — sync resolver for fixture ids only. */
export function resolveFixtureProfileSync(marketId: string, forecastCutoff?: string): FixtureProfile {
  const profile = PROFILES_BY_MARKET[marketId] ?? SYNALPHIMAB_PROFILE;
  if (!forecastCutoff) return profile;
  return { ...profile, forecastCutoff };
}

export async function listSupportedMarketIds(): Promise<string[]> {
  const live = await listLiveMarketIds();
  return [...new Set([...Object.keys(PROFILES_BY_MARKET), ...live])];
}

/** Map Ops `/ops/market/[polymarketId]` route param to orchestration run ledger ids. */
export function resolveOrchestrationMarketIdsForOps(polymarketId: string): string[] {
  const ids = new Set<string>([polymarketId, `pm_${polymarketId}`]);
  return [...ids];
}
