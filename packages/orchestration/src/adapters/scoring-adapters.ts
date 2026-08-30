import { buildForecast } from "@pivotaledge/models";
import {
  buildBetRecommendation,
  fingerprintRecommendation,
} from "@pivotaledge/scoring";

import type { ForecastPort, ScoringPort } from "../ports/index.js";

export function createDefaultForecastAdapter(): ForecastPort {
  return {
    async buildForecast(input) {
      return buildForecast({
        marketQuestion: input.marketQuestion,
        precedentBundle: input.precedentBundle,
        forecastCutoff: input.forecastCutoff,
        forecastId: input.forecastId,
        generatedAt: input.generatedAt,
      });
    },
  };
}

export function createDefaultScoringAdapter(): ScoringPort {
  return {
    async buildRecommendation(input) {
      return buildBetRecommendation(input);
    },
    fingerprintRecommendation,
  };
}
