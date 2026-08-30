const INDICATION_ALIASES: Record<string, string> = {
  nsclc: "NSCLC",
  "non-small cell lung cancer": "NSCLC",
  pdac: "PDAC",
  "pancreatic adenocarcinoma": "PDAC",
};

export function normalizeIndication(raw: string): string {
  const key = raw.trim().toLowerCase();
  return INDICATION_ALIASES[key] ?? raw.trim();
}
