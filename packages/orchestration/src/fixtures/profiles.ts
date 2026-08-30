/** Bundled fixture paths for a reproducible pipeline profile. */
export type FixtureProfile = {
  id: string;
  marketFixturePath: string;
  snapshotPath: string;
  programFixturePaths: string[];
  yesOrderBookPath: string;
  noOrderBookPath: string | null;
  forecastCutoff: string;
  therapeuticArea?: string;
  /** Live book: load market + order books from frozen live snapshot only. */
  liveSnapshotPath?: string;
};

export const SYNALPHIMAB_PROFILE: FixtureProfile = {
  id: "synalphimab",
  marketFixturePath: "market-cases/synalphimab-approval-by-date.json",
  snapshotPath: "opportunities/synalphimab-frozen.json",
  programFixturePaths: ["approved/synalphimab-nsclc.json", "crl/synbetalib-ra.json"],
  yesOrderBookPath: "orderbooks/synalphimab-yes.json",
  noOrderBookPath: "orderbooks/synalphimab-no.json",
  forecastCutoff: "2024-06-01T00:00:00.000Z",
  therapeuticArea: "oncology",
};

export const SYNBETALIB_PROFILE: FixtureProfile = {
  id: "synbetalib",
  marketFixturePath: "market-cases/synbetalib-approval-by-date.json",
  snapshotPath: "opportunities/synbetalib-frozen.json",
  programFixturePaths: ["crl/synbetalib-ra.json"],
  yesOrderBookPath: "orderbooks/synbetalib-yes.json",
  noOrderBookPath: "orderbooks/synbetalib-no.json",
  forecastCutoff: "2022-05-19T15:00:00.000Z",
  therapeuticArea: "rheumatology",
};

export const ENRICHMENT_AB_PROFILE_IDS = ["synalphimab", "synbetalib"] as const;

export function getFixtureProfile(id: string): FixtureProfile {
  if (id === "synalphimab") return SYNALPHIMAB_PROFILE;
  if (id === "synbetalib") return SYNBETALIB_PROFILE;
  throw new Error(`Unknown fixture profile: ${id}`);
}
