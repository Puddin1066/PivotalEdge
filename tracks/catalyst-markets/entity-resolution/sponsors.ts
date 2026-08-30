export type SponsorMap = {
  sponsorName: string;
  companyId: string;
  ticker: string;
};

const MAP: SponsorMap[] = [
  { sponsorName: "Example Bio Inc", companyId: "co_abcd", ticker: "ABCD" },
  { sponsorName: "Cascade Therapeutics", companyId: "co_cdef", ticker: "CDEF" },
];

export function resolveSponsor(name: string): SponsorMap | null {
  const key = name.trim().toLowerCase();
  return MAP.find((m) => m.sponsorName.toLowerCase() === key) ?? null;
}

export function resolveTicker(ticker: string): SponsorMap | null {
  return MAP.find((m) => m.ticker.toUpperCase() === ticker.toUpperCase()) ?? null;
}
