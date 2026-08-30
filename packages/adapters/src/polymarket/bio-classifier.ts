import type { GammaMarket } from "./gamma.js";

/** Heuristic biotech / clinical-regulatory market classifier (S1 thin). */
const BIO_KEYWORDS = [
  "fda",
  "approval",
  "approved",
  "nda",
  "bla",
  "pdufa",
  "clinical trial",
  "phase 1",
  "phase 2",
  "phase 3",
  "phase i",
  "phase ii",
  "phase iii",
  "topline",
  "endpoint",
  "adcom",
  "advisory committee",
  "crl",
  "complete response",
  "biologics",
  "drug",
  "therapy",
  "indication",
  "oncology",
  "alzheimer",
  "diabetes",
  "obesity",
  "glp-1",
  "peptide",
  "antibody",
  "biosimilar",
  "gene therapy",
  "cell therapy",
  "vaccine",
  "pfizer",
  "moderna",
  "novo nordisk",
  "eli lilly",
  "merck",
  "roche",
  "astrazeneca",
  "biogen",
  "amgen",
  "gilead",
  "regeneron",
  "vertex",
  "bristol",
  "sanofi",
  "gsk",
];

const EXCLUDE_KEYWORDS = [
  "president",
  "election",
  "senate",
  "congress",
  "bitcoin",
  "ethereum",
  "crypto",
  "fdv",
  "launch",
  "opensea",
  "metamask",
  "nba",
  "nfl",
  "ufc",
  "oscar",
  "grammy",
  "taylor swift",
  "xi jinping",
  "putin",
  "ukraine war",
  "fed rate",
  "interest rate",
  "approval rating",
  "trump",
  "ipo",
  "market cap",
];

export type BioClassification = {
  isBiotech: boolean;
  score: number;
  matchedKeywords: string[];
  excludedBy: string | null;
};

function haystack(market: GammaMarket): string {
  return [market.question, market.description, market.slug, ...market.tags].join(" ").toLowerCase();
}

function exclusionHaystack(market: GammaMarket): string {
  return [market.question, market.slug, ...market.tags].join(" ").toLowerCase();
}

export function classifyBiotechMarket(market: GammaMarket): BioClassification {
  const excludeText = exclusionHaystack(market);
  for (const ex of EXCLUDE_KEYWORDS) {
    if (excludeText.includes(ex)) {
      return { isBiotech: false, score: 0, matchedKeywords: [], excludedBy: ex };
    }
  }
  const text = haystack(market);
  const matched = BIO_KEYWORDS.filter((kw) => text.includes(kw));
  const score = matched.length;

  const hasFda = matched.includes("fda") || matched.includes("pdufa");
  const hasClinical =
    matched.some((k) => k.includes("trial") || k.includes("phase") || k.includes("endpoint")) ||
    matched.includes("nda") ||
    matched.includes("bla");
  const hasDrugContext =
    matched.includes("drug") ||
    matched.includes("therapy") ||
    matched.includes("antibody") ||
    matched.includes("biosimilar") ||
    matched.includes("vaccine") ||
    /\b[a-z]{3,}(mab|lib|tinib|ciclib|glutide|tide)\b/i.test(market.question);

  const isBiotech =
    (hasFda && hasDrugContext) ||
    (hasFda && hasClinical) ||
    (hasClinical && hasDrugContext && score >= 2) ||
    score >= 3;

  return {
    isBiotech,
    score,
    matchedKeywords: matched,
    excludedBy: null,
  };
}

export function filterBiotechMarkets(markets: GammaMarket[]): GammaMarket[] {
  return markets.filter((m) => classifyBiotechMarket(m).isBiotech);
}
