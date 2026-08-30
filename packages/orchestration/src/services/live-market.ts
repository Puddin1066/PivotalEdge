import { readFile } from "node:fs/promises";
import path from "node:path";

import { defaultFixturesRoot, loadProgramFixture } from "@pivotaledge/schemas";

import type { FixtureProfile } from "../fixtures/profiles.js";

type SeedFile = {
  programs: {
    slug: string;
    preferredName: string;
    polymarketMarketIds: string[];
    marketEventTypes?: Record<string, string>;
  }[];
};

/** Normalize API marketId → Polymarket numeric id. */
export function polymarketIdFromMarketId(marketId: string): string {
  if (marketId.startsWith("pm_poly_")) return marketId.replace("pm_poly_", "");
  if (marketId.startsWith("pm_")) return marketId.slice(3);
  return marketId;
}

/**
 * Resolve a live-book FixtureProfile from Polymarket market id + seed registry.
 * Uses frozen snapshots from kg-score-live when present.
 */
export async function resolveLiveProfileForMarket(
  marketId: string,
  fixturesRoot = defaultFixturesRoot(),
): Promise<FixtureProfile | null> {
  const polyId = polymarketIdFromMarketId(marketId);
  const seedRaw = JSON.parse(
    await readFile(path.join(fixturesRoot, "enrichment/seed-programs.json"), "utf8"),
  ) as SeedFile;

  const seed = seedRaw.programs.find((p) => p.polymarketMarketIds.includes(polyId));
  if (!seed) return null;

  const fixturePath = `corpus/live/${seed.slug}.json`;
  try {
    const fixture = await loadProgramFixture(fixturePath, fixturesRoot);
    const snapshotPath = `opportunities/live/${seed.slug}-${polyId}.json`;

    return {
      id: `live_${seed.slug}_${polyId}`,
      marketFixturePath: snapshotPath,
      snapshotPath,
      liveSnapshotPath: snapshotPath,
      programFixturePaths: [fixturePath],
      yesOrderBookPath: snapshotPath,
      noOrderBookPath: snapshotPath,
      forecastCutoff: new Date().toISOString(),
      therapeuticArea: fixture.indication.therapeuticArea ?? undefined,
    };
  } catch {
    return null;
  }
}

export async function listLiveMarketIds(
  fixturesRoot = defaultFixturesRoot(),
): Promise<string[]> {
  const seedRaw = JSON.parse(
    await readFile(path.join(fixturesRoot, "enrichment/seed-programs.json"), "utf8"),
  ) as SeedFile;
  return seedRaw.programs.flatMap((p) =>
    p.polymarketMarketIds.map((id) => `pm_${id}`),
  );
}
