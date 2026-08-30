/**
 * Soft-fail live Polymarket discovery for radar UI.
 * Does not score markets — only surfaces buyable / closable links.
 */
import {
  classifyBiotechMarket,
  fetchGammaMarketById,
  searchGammaMarkets,
  type GammaMarket,
} from "@pivotaledge/adapters";

export type LivePolymarketRow = {
  gammaId: string;
  question: string;
  slug: string | null;
  endDate: string | null;
  acceptingOrders: boolean;
  active: boolean;
  closed: boolean;
  url: string | null;
};

export type LiveDiscoveryResult = {
  markets: LivePolymarketRow[];
  note: string | null;
};

function toIsoOrNull(value: string | null): string | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed).toISOString();
}

function toRow(m: GammaMarket): LivePolymarketRow {
  const slug = m.slug || null;
  const endDate = toIsoOrNull(m.endDate);
  return {
    gammaId: m.id,
    question: m.question,
    slug,
    endDate,
    acceptingOrders: m.acceptingOrders && m.active && !m.closed,
    active: m.active,
    closed: m.closed,
    url: slug ? `https://polymarket.com/event/${encodeURIComponent(slug)}` : null,
  };
}

export async function discoverLivePolymarketRows(
  options: { limit?: number; fetchImpl?: typeof fetch } = {},
): Promise<LiveDiscoveryResult> {
  const limit = options.limit ?? 10;
  try {
    const found: GammaMarket[] = [];
    for (const query of ["FDA approval", "PDUFA", "clinical trial", "biotech"]) {
      const batch = await searchGammaMarkets(query, {
        limitPerType: 20,
        fetchImpl: options.fetchImpl,
      });
      for (const m of batch) {
        if (classifyBiotechMarket(m).isBiotech) found.push(m);
      }
      if (found.length >= limit * 2) break;
    }

    for (const id of ["1162139", "2253151"]) {
      const m = await fetchGammaMarketById(id, { fetchImpl: options.fetchImpl });
      if (m && classifyBiotechMarket(m).isBiotech) found.push(m);
    }

    const unique = [...new Map(found.map((m) => [m.id, m])).values()]
      .filter((m) => m.active && !m.closed)
      .slice(0, limit)
      .map(toRow);

    return {
      markets: unique,
      note:
        unique.length === 0
          ? "No active biotech Polymarket markets matched discovery queries right now."
          : null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      markets: [],
      note: `Live Polymarket discovery unavailable (${message}). Fixture and paper lanes still shown.`,
    };
  }
}
