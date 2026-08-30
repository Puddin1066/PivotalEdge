/** Stub — SEC EDGAR company context (cash, runway, ownership). */
export async function fetchSecCompanyContext(_ticker: string): Promise<{
  source: "mock";
  cashMillions: number | null;
  notes: string[];
}> {
  return { source: "mock", cashMillions: null, notes: ["SEC adapter not wired; use fixture company features"] };
}
