import {
  classifyBiotechMarket,
  fetchGammaMarketById,
  fetchGammaMarkets,
  filterBiotechMarkets,
  searchGammaMarkets,
  type GammaMarket,
} from "@pivotaledge/adapters";
import { PredictionMarketSchema } from "@pivotaledge/schemas";

import {
  AmbiguityQueue,
  heuristicParseMarketQuestion,
  parseMarketQuestion,
  requiresHumanReview,
  type AmbiguityQueueItem,
} from "./market-parser.js";

export type DiscoveredMarket = {
  gamma: GammaMarket;
  predictionMarket: ReturnType<typeof PredictionMarketSchema.parse>;
  marketQuestion: Awaited<ReturnType<typeof parseMarketQuestion>>["question"];
  usedLlm: boolean;
  needsReview: boolean;
};

export type DiscoverBiotechMarketsOptions = {
  limit?: number;
  maxPages?: number;
  useLlm?: boolean;
  apiKey?: string;
  fetchImpl?: typeof fetch;
  /** Include closed/archived markets to reach parser validation sample size. */
  includeClosed?: boolean;
  /** When true, only open active markets accepting CLOB orders. */
  tradableOnly?: boolean;
};

export type DiscoverBiotechMarketsStats = {
  totalMatched: number;
  openActive: number;
  tradable: number;
};

export type DiscoverBiotechMarketsResult = {
  markets: DiscoveredMarket[];
  stats: DiscoverBiotechMarketsStats;
};

/** Dedupe and bucket Gamma markets before parser pass. */
export function biotechDiscoveryPoolStats(markets: GammaMarket[]): DiscoverBiotechMarketsStats & {
  unique: GammaMarket[];
} {
  const unique = [...new Map(markets.map((m) => [m.id, m])).values()];
  const openActive = unique.filter((m) => !m.closed && m.active);
  const tradable = openActive.filter((m) => m.acceptingOrders);
  return {
    unique,
    totalMatched: unique.length,
    openActive: openActive.length,
    tradable: tradable.length,
  };
}

function filterDiscoveryPool(
  markets: GammaMarket[],
  options: Pick<DiscoverBiotechMarketsOptions, "includeClosed" | "tradableOnly">,
): GammaMarket[] {
  let pool = markets;
  if (options.includeClosed === false) {
    pool = pool.filter((m) => !m.closed && m.active);
  }
  if (options.tradableOnly) {
    pool = pool.filter((m) => m.acceptingOrders);
  }
  return pool;
}

export async function discoverBiotechMarketsDetailed(
  options: DiscoverBiotechMarketsOptions = {},
): Promise<DiscoverBiotechMarketsResult> {
  const pageSize = 100;
  const maxPages = options.maxPages ?? 5;
  const target = options.limit ?? 50;
  const all: GammaMarket[] = [];

  const queries = [
    "FDA approval",
    "FDA approves",
    "clinical trial",
    "PDUFA",
    "NDA BLA",
    "biotech drug",
    "retatrutide",
    "lecanemab",
    "alzheimer drug",
    "obesity drug",
    "glp-1",
    "biosimilar",
    "adcom",
    "phase 3 trial",
    "complete response letter",
  ];
  for (const query of queries) {
    const found = await searchGammaMarkets(query, {
      limitPerType: 30,
      fetchImpl: options.fetchImpl,
    });
    all.push(...filterBiotechMarkets(found));
    if (all.length >= target * 2) break;
  }

  if (options.includeClosed !== false) {
    const closedBatch = await fetchGammaMarkets({
      limit: 200,
      closed: true,
      fetchImpl: options.fetchImpl,
    });
    all.push(...filterBiotechMarkets(closedBatch));
  }

  const tagSlugs = ["science", "biotech", "health", "fda"];
  for (const tagSlug of tagSlugs) {
    for (let page = 0; page < maxPages && all.length < target * 3; page++) {
      const batch = await fetchGammaMarkets({
        limit: pageSize,
        offset: page * pageSize,
        active: true,
        closed: false,
        tagSlug,
        fetchImpl: options.fetchImpl,
      });
      if (!batch.length) break;
      all.push(...filterBiotechMarkets(batch));
    }
  }

  // Fallback: scan general active markets if tag search is sparse
  if (all.length < target) {
    for (let page = 0; page < maxPages && all.length < target * 3; page++) {
      const batch = await fetchGammaMarkets({
        limit: pageSize,
        offset: page * pageSize,
        active: true,
        closed: false,
        fetchImpl: options.fetchImpl,
      });
      if (!batch.length) break;
      all.push(...filterBiotechMarkets(batch));
    }
  }

  // Seed known biotech market IDs (Polymarket ladder + seed-programs.json)
  const seedIds = ["1162139", "2253151", "3725541", "3741934", "3727493"];
  for (const id of seedIds) {
    const m = await fetchGammaMarketById(id, { fetchImpl: options.fetchImpl });
    if (m && classifyBiotechMarket(m).isBiotech) all.push(m);
  }

  const { unique, ...stats } = biotechDiscoveryPoolStats(all);
  const filtered = filterDiscoveryPool(unique, options).slice(0, target);
  const results: DiscoveredMarket[] = [];

  for (const gamma of filtered) {
    const tokens = gamma.clobTokenIds;
    const predictionMarket = PredictionMarketSchema.parse({
      id: `pm_${gamma.id}`,
      platform: "polymarket",
      eventId: gamma.eventId,
      question: gamma.question,
      resolutionRules: gamma.description || gamma.question,
      closesAt: gamma.endDate,
      tokenYesId: tokens[0] ?? null,
      tokenNoId: tokens[1] ?? null,
      active: gamma.active && !gamma.closed,
    });

    const parsed =
      options.useLlm === false
        ? { question: heuristicParseMarketQuestion(gamma), usedLlm: false, modelCallId: null }
        : await parseMarketQuestion(gamma, {
            apiKey: options.apiKey,
            useHeuristicFallback: options.useLlm !== true,
          });

    results.push({
      gamma,
      predictionMarket,
      marketQuestion: parsed.question,
      usedLlm: parsed.usedLlm,
      needsReview: requiresHumanReview(parsed.question),
    });
  }

  return { markets: results, stats };
}

export async function discoverBiotechMarkets(
  options: DiscoverBiotechMarketsOptions = {},
): Promise<DiscoveredMarket[]> {
  return (await discoverBiotechMarketsDetailed(options)).markets;
}

export function buildAmbiguityQueue(markets: DiscoveredMarket[]): AmbiguityQueue {
  const queue = new AmbiguityQueue();
  for (const m of markets) {
    if (!m.needsReview) continue;
    queue.enqueue({
      marketId: m.gamma.id,
      question: m.gamma.question,
      reason: m.marketQuestion.ambiguityFlags.join(", ") || "low_confidence",
      ambiguityFlags: m.marketQuestion.ambiguityFlags,
      parserConfidence: m.marketQuestion.parserConfidence,
    });
  }
  return queue;
}

export type { AmbiguityQueueItem };
export {
  AmbiguityQueue,
  heuristicParseMarketQuestion,
  parseMarketQuestion,
  requiresHumanReview,
} from "./market-parser.js";

export { auditRegulatoryExtraction, auditTrialExtraction } from "./extraction/citation-audit.js";
export {
  extractTrialAssessment,
  heuristicExtractTrial,
  type ExtractTrialInput,
} from "./extraction/trial-extractor.js";
export {
  extractRegulatoryAssessment,
  heuristicExtractRegulatory,
  type ExtractRegulatoryInput,
} from "./extraction/regulatory-extractor.js";
export { ExtractionReviewQueue, type ExtractionReviewItem } from "./extraction/review-queue.js";
export {
  runGoldEval,
  loadGoldCases,
  evaluateGoldCase,
  summarizeGoldEval,
} from "./extraction/gold-eval.js";
