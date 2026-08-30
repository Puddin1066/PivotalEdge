/**
 * Local FDA Orange Book CSV lookup (public domain; no license).
 * CSV schema: product_name, applicant, approval_date, te_code, appl_no
 */
import { createReadStream } from "node:fs";
import { access } from "node:fs/promises";
import path from "node:path";

import { createInterface } from "node:readline";

import { defaultFixturesRoot } from "@pivotaledge/schemas";

export type OrangeBookRow = {
  productName: string;
  applicant: string;
  approvalDate: string | null;
  teCode: string;
  applNo: string;
};

export type OrangeBookLookupHit = OrangeBookRow & {
  matchKind: "product" | "applicant";
};

let cachedRows: OrangeBookRow[] | null = null;
let cachedPath: string | null = null;

function normalizeName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ");
}

function parseApprovalDate(raw: string): string | null {
  const s = raw.trim();
  if (!s || /prior to/i.test(s)) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (m) {
    const months: Record<string, string> = {
      jan: "01",
      feb: "02",
      mar: "03",
      apr: "04",
      may: "05",
      jun: "06",
      jul: "07",
      aug: "08",
      sep: "09",
      oct: "10",
      nov: "11",
      dec: "12",
    };
    const mo = months[m[2]!.toLowerCase()];
    if (mo) return `${m[3]}-${mo}-${m[1]!.padStart(2, "0")}`;
  }
  return null;
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

/** Resolve Orange Book CSV path (env → fixtures → common local paths). */
export async function resolveOrangeBookCsvPath(): Promise<string | null> {
  const fixturesRoot = defaultFixturesRoot();
  const home = process.env.HOME ?? "";
  const candidates = [
    process.env.ORANGE_BOOK_CSV,
    path.join(fixturesRoot, "regulatory/orange_book_products.csv"),
    path.join(fixturesRoot, "regulatory/orange_book_products_2026.csv"),
    home
      ? path.join(
          home,
          "iaip_2/iaip-comparative-platform/data/raw/orange_book/orange_book_products_2026.csv",
        )
      : null,
  ].filter((p): p is string => Boolean(p));

  for (const p of candidates) {
    try {
      await access(p);
      return p;
    } catch {
      /* try next */
    }
  }
  return null;
}

export async function loadOrangeBookCsv(csvPath?: string): Promise<OrangeBookRow[]> {
  const resolved = csvPath ?? (await resolveOrangeBookCsvPath());
  if (!resolved) return [];
  if (cachedRows && cachedPath === resolved) return cachedRows;

  const rows: OrangeBookRow[] = [];
  const rl = createInterface({ input: createReadStream(resolved, { encoding: "utf8" }) });
  let header: string[] | null = null;

  for await (const line of rl) {
    if (!line.trim()) continue;
    const cols = parseCsvLine(line);
    if (!header) {
      header = cols.map((h) => h.trim().toLowerCase());
      continue;
    }
    const get = (name: string) => {
      const idx = header!.indexOf(name);
      return idx >= 0 ? (cols[idx] ?? "").trim() : "";
    };
    const productName = get("product_name");
    if (!productName) continue;
    rows.push({
      productName,
      applicant: get("applicant"),
      approvalDate: parseApprovalDate(get("approval_date")),
      teCode: get("te_code"),
      applNo: get("appl_no"),
    });
  }

  cachedRows = rows;
  cachedPath = resolved;
  return rows;
}

/** Earliest known approval for a trade/generic name (competitor enrichment). */
export async function lookupOrangeBookApproval(
  drugName: string,
  csvPath?: string,
): Promise<OrangeBookLookupHit | null> {
  const rows = await loadOrangeBookCsv(csvPath);
  if (!rows.length) return null;
  const needle = normalizeName(drugName);
  let best: OrangeBookLookupHit | null = null;

  for (const row of rows) {
    const productNorm = normalizeName(row.productName);
    if (!productNorm.includes(needle) && !needle.includes(productNorm)) continue;
    if (!row.approvalDate) continue;
    if (!best || !best.approvalDate || row.approvalDate < best.approvalDate) {
      best = { ...row, matchKind: "product" };
    }
  }
  return best;
}

/** All rows matching drug name (for disambiguation / logging). */
export async function searchOrangeBookByDrugName(
  drugName: string,
  csvPath?: string,
): Promise<OrangeBookLookupHit[]> {
  const rows = await loadOrangeBookCsv(csvPath);
  const needle = normalizeName(drugName);
  return rows
    .filter((row) => {
      const productNorm = normalizeName(row.productName);
      return productNorm.includes(needle) || needle.includes(productNorm);
    })
    .map((row) => ({ ...row, matchKind: "product" as const }));
}
