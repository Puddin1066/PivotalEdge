import type {
  BetRecommendation,
  Forecast,
  OrderBookSnapshot,
  PrecedentBundle,
  PredictionMarket,
} from "@pivotaledge/schemas";
import type { MarketQuestion } from "@pivotaledge/schemas";
import type { RecommendationFingerprint } from "@pivotaledge/scoring";

export type OpportunityDossier = {
  market: PredictionMarket;
  marketQuestion: MarketQuestion;
  precedentBundle: PrecedentBundle;
  forecast: Forecast;
  recommendation: BetRecommendation;
  fingerprint: RecommendationFingerprint;
  yesOrderBook: OrderBookSnapshot;
  noOrderBook: OrderBookSnapshot | null;
  metadata: {
    snapshotPath: string;
    fixtureSource: string;
    evaluatedAt: string;
    orderBooksAreMock: boolean;
  };
};
