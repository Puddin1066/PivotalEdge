import { readFile } from "node:fs/promises";
import path from "node:path";

import { CatalystEventSchema, type CatalystEvent } from "../schemas/event.js";
import { FIXTURES_ROOT } from "./prices.js";

/** MOCK: load curated catalyst events from fixtures (offline). */
export async function loadEventFixtures(): Promise<CatalystEvent[]> {
  const file = path.join(FIXTURES_ROOT, "events", "corpus.json");
  const raw = JSON.parse(await readFile(file, "utf8")) as unknown[];
  return raw.map((row) => CatalystEventSchema.parse(row));
}

export async function loadEventById(eventId: string): Promise<CatalystEvent> {
  const all = await loadEventFixtures();
  const hit = all.find((e) => e.eventId === eventId);
  if (!hit) throw new Error(`Unknown eventId: ${eventId}`);
  return hit;
}

/**
 * AACT / CT.gov ingestion — stub for Milestone 1+.
 * Real snapshots stay offline/staged; only event-scoped rows enter working DB.
 */
export async function ingestAactSnapshot(_path: string): Promise<{ stagedRows: number }> {
  return { stagedRows: 0 };
}
