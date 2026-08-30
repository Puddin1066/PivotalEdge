/**
 * Competitor approval dates from local Orange Book + retrospective KG fixtures.
 * Prefer Orange Book for small-molecule ANDA rows; fall back to retrospective
 * regulatoryAction dates for biologics / branded products not in Orange Book;
 * then curated overrides for known gaps (e.g. semaglutide).
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { defaultFixturesRoot, type ProgramFixture } from "@pivotaledge/schemas";

import { lookupOrangeBookApproval, type OrangeBookLookupHit } from "../orangebook/local-csv.js";

export type CompetitorApprovalHit = {
  drugName: string;
  approvedAt: string;
  sourceSystem: "fda.orange_book_local" | "kg.retrospective" | "enrichment_override";
  sourceUrl: string;
  productLabel: string;
  applicationNumber: string | null;
  fixturePath?: string;
};

type RetrospectiveIndexEntry = {
  preferredName: string;
  tokens: string[];
  approvedAt: string;
  applicationNumber: string | null;
  fixtureRel: string;
};

type OverrideEntry = {
  names: string[];
  approvedAt: string;
  productLabel: string;
  applicationNumber: string | null;
  sourceUrl: string;
  passage: string;
};

let retroIndex: RetrospectiveIndexEntry[] | null = null;
let overrideCache: OverrideEntry[] | null = null;
let aliasCache: Record<string, string[]> | null = null;

function normalizeTokens(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 4);
}

function nameMatches(query: string, preferredName: string, tokens: string[]): boolean {
  const q = query.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const pref = preferredName.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  if (!q) return false;
  if (pref.includes(q) || q.includes(pref.split(" ")[0] ?? "")) return true;
  const qTokens = normalizeTokens(query);
  return qTokens.some((t) => tokens.includes(t) || pref.includes(t));
}

async function loadRetrospectiveApprovalIndex(
  fixturesRoot = defaultFixturesRoot(),
): Promise<RetrospectiveIndexEntry[]> {
  if (retroIndex) return retroIndex;
  const dir = path.join(fixturesRoot, "corpus/retrospective");
  const files = (await readdir(dir)).filter((f) => f.endsWith(".json"));
  const entries: RetrospectiveIndexEntry[] = [];

  for (const file of files) {
    const raw = JSON.parse(await readFile(path.join(dir, file), "utf8")) as ProgramFixture;
    if (raw.program?.status !== "approved") continue;
    if (raw.regulatoryAction?.actionType !== "approval") continue;
    if (!raw.regulatoryAction.actionDate) continue;
    const preferredName = raw.drugAsset.preferredName;
    entries.push({
      preferredName,
      tokens: normalizeTokens(preferredName),
      approvedAt: raw.regulatoryAction.actionDate,
      applicationNumber: raw.application?.applicationNumber ?? null,
      fixtureRel: `corpus/retrospective/${file}`,
    });
  }

  retroIndex = entries;
  return entries;
}

type OverrideFile = {
  orangeBookAliases?: Record<string, string[]>;
  entries?: OverrideEntry[];
};

async function loadOverrideFile(fixturesRoot = defaultFixturesRoot()): Promise<OverrideFile> {
  try {
    return JSON.parse(
      await readFile(
        path.join(fixturesRoot, "enrichment/competitor-approval-overrides.json"),
        "utf8",
      ),
    ) as OverrideFile;
  } catch {
    return {};
  }
}

async function loadApprovalOverrides(
  fixturesRoot = defaultFixturesRoot(),
): Promise<OverrideEntry[]> {
  if (overrideCache) return overrideCache;
  const raw = await loadOverrideFile(fixturesRoot);
  overrideCache = raw.entries ?? [];
  aliasCache = raw.orangeBookAliases ?? {};
  return overrideCache;
}

async function loadOrangeBookAliases(
  fixturesRoot = defaultFixturesRoot(),
): Promise<Record<string, string[]>> {
  if (aliasCache) return aliasCache;
  await loadApprovalOverrides(fixturesRoot);
  return aliasCache ?? {};
}

export async function lookupRetrospectiveApproval(
  drugName: string,
  fixturesRoot = defaultFixturesRoot(),
): Promise<CompetitorApprovalHit | null> {
  const index = await loadRetrospectiveApprovalIndex(fixturesRoot);
  let best: RetrospectiveIndexEntry | null = null;
  for (const entry of index) {
    if (!nameMatches(drugName, entry.preferredName, entry.tokens)) continue;
    if (!best || entry.approvedAt < best.approvedAt) best = entry;
  }
  if (!best) return null;
  return {
    drugName,
    approvedAt: best.approvedAt,
    sourceSystem: "kg.retrospective",
    sourceUrl: `fixture://${best.fixtureRel}`,
    productLabel: best.preferredName,
    applicationNumber: best.applicationNumber,
    fixturePath: best.fixtureRel,
  };
}

async function lookupOverrideApproval(
  drugName: string,
  fixturesRoot = defaultFixturesRoot(),
): Promise<CompetitorApprovalHit | null> {
  const overrides = await loadApprovalOverrides(fixturesRoot);
  const q = drugName.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  for (const entry of overrides) {
    const hit = entry.names.some((n) => {
      const nn = n.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      return q === nn || q.includes(nn) || nn.includes(q);
    });
    if (!hit) continue;
    return {
      drugName,
      approvedAt: entry.approvedAt,
      sourceSystem: "enrichment_override",
      sourceUrl: entry.sourceUrl,
      productLabel: entry.productLabel,
      applicationNumber: entry.applicationNumber,
    };
  }
  return null;
}

function fromOrangeBook(
  drugName: string,
  hit: OrangeBookLookupHit,
  csvPath: string | null,
): CompetitorApprovalHit {
  return {
    drugName,
    approvedAt: `${hit.approvalDate}T12:00:00.000Z`,
    sourceSystem: "fda.orange_book_local",
    sourceUrl: csvPath
      ? `file://${csvPath}`
      : "https://www.fda.gov/drugs/drug-approvals-and-databases/approved-drug-products-therapeutic-equivalence-evaluations-orange-book",
    productLabel: hit.productName,
    applicationNumber: hit.applNo || null,
  };
}

/**
 * Resolve competitor approval: Orange Book (incl. brand aliases) → retrospective → overrides.
 */
export async function lookupCompetitorApproval(
  drugName: string,
  options: {
    orangeBookCsvPath?: string | null;
    fixturesRoot?: string;
  } = {},
): Promise<CompetitorApprovalHit | null> {
  const fixturesRoot = options.fixturesRoot ?? defaultFixturesRoot();
  const csv = options.orangeBookCsvPath ?? undefined;

  const ob = await lookupOrangeBookApproval(drugName, csv);
  if (ob?.approvalDate) {
    return fromOrangeBook(drugName, ob, options.orangeBookCsvPath ?? null);
  }

  const aliases = await loadOrangeBookAliases(fixturesRoot);
  const aliasKeys = Object.keys(aliases);
  const q = drugName.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  for (const key of aliasKeys) {
    const kn = key.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (q !== kn && !q.includes(kn) && !kn.includes(q)) continue;
    for (const alias of aliases[key] ?? []) {
      const aliasHit = await lookupOrangeBookApproval(alias, csv);
      if (aliasHit?.approvalDate) {
        return fromOrangeBook(drugName, aliasHit, options.orangeBookCsvPath ?? null);
      }
    }
  }

  const retro = await lookupRetrospectiveApproval(drugName, fixturesRoot);
  if (retro) return retro;
  return lookupOverrideApproval(drugName, fixturesRoot);
}

export async function resolveCompetitorApprovals(
  names: string[],
  options: {
    orangeBookCsvPath?: string | null;
    fixturesRoot?: string;
  } = {},
): Promise<Record<string, CompetitorApprovalHit>> {
  const out: Record<string, CompetitorApprovalHit> = {};
  for (const name of names) {
    const hit = await lookupCompetitorApproval(name, options);
    if (hit) out[name] = hit;
  }
  return out;
}
