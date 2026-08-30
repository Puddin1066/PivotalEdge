/** Polymarket Gamma API — read-only market discovery (no API key). */

const DEFAULT_GAMMA_URL = "https://gamma-api.polymarket.com";

export type GammaMarket = {
  id: string;
  question: string;
  slug: string;
  description: string;
  endDate: string | null;
  active: boolean;
  closed: boolean;
  acceptingOrders: boolean;
  clobTokenIds: string[];
  outcomes: string[];
  eventId: string | null;
  tags: string[];
};

function asList(value: unknown): unknown[] {
  if (value == null) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function eventId(raw: Record<string, unknown>): string | null {
  if (raw.eventId != null) return String(raw.eventId);
  const events = raw.events;
  if (Array.isArray(events) && events[0] && typeof events[0] === "object") {
    const id = (events[0] as Record<string, unknown>).id;
    if (id != null) return String(id);
  }
  return null;
}

function parseTags(raw: Record<string, unknown>): string[] {
  const tags: string[] = [];
  for (const t of asList(raw.tags)) {
    if (typeof t === "string" && t.trim()) tags.push(t.trim());
    else if (t && typeof t === "object") {
      const obj = t as Record<string, unknown>;
      const label = obj.label ?? obj.slug ?? obj.name;
      if (label) tags.push(String(label));
    }
  }
  return tags;
}

export function normalizeGammaMarket(raw: Record<string, unknown>): GammaMarket {
  const tokens = asList(raw.clobTokenIds).map(String);
  const outcomes = asList(raw.outcomes).map(String);
  return {
    id: String(raw.id ?? ""),
    question: String(raw.question ?? ""),
    slug: String(raw.slug ?? ""),
    description: String(raw.description ?? ""),
    endDate: raw.endDate != null ? String(raw.endDate) : null,
    active: Boolean(raw.active),
    closed: Boolean(raw.closed),
    acceptingOrders: Boolean(raw.acceptingOrders),
    clobTokenIds: tokens,
    outcomes,
    eventId: eventId(raw),
    tags: parseTags(raw),
  };
}

export type FetchGammaMarketsOptions = {
  baseUrl?: string;
  limit?: number;
  offset?: number;
  active?: boolean;
  closed?: boolean;
  tagSlug?: string;
  fetchImpl?: typeof fetch;
};

export async function fetchGammaMarkets(
  options: FetchGammaMarketsOptions = {},
): Promise<GammaMarket[]> {
  const baseUrl = options.baseUrl ?? process.env.POLYMARKET_GAMMA_URL ?? DEFAULT_GAMMA_URL;
  const params = new URLSearchParams();
  params.set("limit", String(options.limit ?? 100));
  if (options.offset != null) params.set("offset", String(options.offset));
  if (options.active != null) params.set("active", String(options.active));
  if (options.closed != null) params.set("closed", String(options.closed));
  if (options.tagSlug) params.set("tag_slug", options.tagSlug);

  const fetchFn = options.fetchImpl ?? fetch;
  const url = `${baseUrl.replace(/\/$/, "")}/markets?${params}`;
  const res = await fetchFn(url, {
    headers: { Accept: "application/json", "User-Agent": "PivotalEdge/0.1 (research)" },
  });
  if (!res.ok) {
    throw new Error(`Gamma API ${res.status}: ${await res.text()}`);
  }
  const data: unknown = await res.json();
  if (!Array.isArray(data)) return [];
  return data
    .filter((row): row is Record<string, unknown> => row != null && typeof row === "object")
    .map(normalizeGammaMarket)
    .filter((m) => m.id && m.question);
}

export type SearchGammaMarketsOptions = {
  baseUrl?: string;
  limitPerType?: number;
  fetchImpl?: typeof fetch;
};

/** Gamma public search — better for biotech discovery than paging all markets. */
export async function searchGammaMarkets(
  query: string,
  options: SearchGammaMarketsOptions = {},
): Promise<GammaMarket[]> {
  const baseUrl = options.baseUrl ?? process.env.POLYMARKET_GAMMA_URL ?? DEFAULT_GAMMA_URL;
  const params = new URLSearchParams({
    q: query,
    limit_per_type: String(options.limitPerType ?? 25),
  });
  const fetchFn = options.fetchImpl ?? fetch;
  const url = `${baseUrl.replace(/\/$/, "")}/public-search?${params}`;
  const res = await fetchFn(url, {
    headers: { Accept: "application/json", "User-Agent": "PivotalEdge/0.1 (research)" },
  });
  if (!res.ok) throw new Error(`Gamma search ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { events?: Record<string, unknown>[] };
  const markets: GammaMarket[] = [];

  for (const event of data.events ?? []) {
    const nested = event.markets;
    if (Array.isArray(nested)) {
      for (const m of nested) {
        if (m && typeof m === "object") {
          markets.push(normalizeGammaMarket(m as Record<string, unknown>));
        }
      }
      continue;
    }
    // Event-only payload: synthesize minimal market row
    markets.push(
      normalizeGammaMarket({
        id: event.id,
        question: event.title ?? event.ticker,
        slug: event.slug,
        description: event.description ?? "",
        endDate: event.endDate,
        active: event.active ?? true,
        closed: event.closed ?? false,
        acceptingOrders: true,
        clobTokenIds: "[]",
        outcomes: "[]",
        events: [{ id: event.id }],
        tags: event.tags,
      }),
    );
  }

  return markets.filter((m) => m.id && m.question);
}

export async function fetchGammaMarketById(
  marketId: string,
  options: { baseUrl?: string; fetchImpl?: typeof fetch } = {},
): Promise<GammaMarket | null> {
  const baseUrl = options.baseUrl ?? process.env.POLYMARKET_GAMMA_URL ?? DEFAULT_GAMMA_URL;
  const fetchFn = options.fetchImpl ?? fetch;
  const url = `${baseUrl.replace(/\/$/, "")}/markets/${marketId}`;
  const res = await fetchFn(url, {
    headers: { Accept: "application/json", "User-Agent": "PivotalEdge/0.1 (research)" },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Gamma API ${res.status}: ${await res.text()}`);
  const raw: unknown = await res.json();
  if (!raw || typeof raw !== "object") return null;
  return normalizeGammaMarket(raw as Record<string, unknown>);
}
