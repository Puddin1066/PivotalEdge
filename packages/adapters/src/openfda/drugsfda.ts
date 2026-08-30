/**
 * openFDA drugsfda endpoint — Drugs@FDA-derived application metadata (no license).
 * https://open.fda.gov/apis/drug/drugsfda/
 */

const DEFAULT_BASE = "https://api.fda.gov/drug/drugsfda.json";

function fdaDateToIso(value: string): string {
  if (/^\d{8}$/.test(value)) {
    return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
  }
  return value;
}

export type FdaApplicationSummary = {
  applicationNumber: string;
  sponsorName: string | null;
  brandNames: string[];
  genericNames: string[];
  substanceNames: string[];
  approvalDate: string | null;
  products: { brandName: string; dosageForm: string | null; route: string | null }[];
  raw: Record<string, unknown>;
};

export function normalizeDrugsFdaResult(
  raw: Record<string, unknown>,
): FdaApplicationSummary | null {
  const appNum = raw.application_number != null ? String(raw.application_number) : null;
  if (!appNum) return null;

  const sponsor = raw.sponsor_name != null ? String(raw.sponsor_name) : null;
  const openfda = (raw.openfda as Record<string, unknown>) ?? {};
  const products = ((raw.products as unknown[]) ?? []).map((p) => {
    const prod = p as Record<string, unknown>;
    return {
      brandName: String(prod.brand_name ?? ""),
      dosageForm: prod.dosage_form != null ? String(prod.dosage_form) : null,
      route: prod.route != null ? String(prod.route) : null,
    };
  });

  const submissions = (raw.submissions as unknown[]) ?? [];
  let approvalDate: string | null = null;
  for (const sub of submissions) {
    if (!sub || typeof sub !== "object") continue;
    const s = sub as Record<string, unknown>;
    if (String(s.submission_type ?? "").toUpperCase() !== "ORIG") continue;
    const status = String(s.submission_status ?? "").toUpperCase();
    if (status !== "AP" || !s.submission_status_date) continue;
    const iso = fdaDateToIso(String(s.submission_status_date));
    if (!approvalDate || iso < approvalDate) approvalDate = iso;
  }

  return {
    applicationNumber: appNum,
    sponsorName: sponsor,
    brandNames: ((openfda.brand_name as unknown[]) ?? []).map(String),
    genericNames: ((openfda.generic_name as unknown[]) ?? []).map(String),
    substanceNames: ((openfda.substance_name as unknown[]) ?? []).map(String),
    approvalDate,
    products,
    raw,
  };
}

export type FetchDrugsFdaOptions = {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
};

export async function searchDrugsFda(
  search: string,
  options: FetchDrugsFdaOptions & { limit?: number } = {},
): Promise<FdaApplicationSummary[]> {
  const base = options.baseUrl ?? DEFAULT_BASE;
  const fetchFn = options.fetchImpl ?? fetch;
  const params = new URLSearchParams({
    search,
    limit: String(options.limit ?? 5),
  });
  const url = `${base}?${params}`;
  const res = await fetchFn(url, {
    headers: { Accept: "application/json", "User-Agent": "PivotalEdge/0.1 (research)" },
  });
  if (!res.ok) throw new Error(`openFDA drugsfda ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { results?: Record<string, unknown>[] };
  return (data.results ?? [])
    .map((r) => normalizeDrugsFdaResult(r))
    .filter((r): r is FdaApplicationSummary => r != null);
}

export async function fetchDrugsFdaByApplicationNumber(
  applicationNumber: string,
  options: FetchDrugsFdaOptions = {},
): Promise<FdaApplicationSummary | null> {
  const results = await searchDrugsFda(`application_number:"${applicationNumber}"`, {
    ...options,
    limit: 1,
  });
  return results[0] ?? null;
}

/** Best-effort openFDA search by substance, generic, or brand name. */
export async function searchDrugsFdaByDrugName(
  drugName: string,
  options: FetchDrugsFdaOptions & { limit?: number } = {},
): Promise<FdaApplicationSummary[]> {
  const q = drugName.replace(/"/g, "").trim();
  if (!q) return [];
  const fields = [
    `openfda.substance_name:"${q}"`,
    `openfda.generic_name:"${q}"`,
    `products.brand_name:"${q}"`,
  ];
  for (const search of fields) {
    try {
      const results = await searchDrugsFda(search, { ...options, limit: options.limit ?? 5 });
      if (results.length) return results;
    } catch {
      /* try next field */
    }
  }
  return [];
}
