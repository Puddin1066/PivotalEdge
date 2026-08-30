import {
  compileQueryPlan,
  InMemoryKnowledgeGraphRepository,
  loadGraphFromProgramFixtures,
} from "@pivotaledge/kg";
import { loadMarketFixture, loadProgramFixture } from "@pivotaledge/schemas";

import type { KgExecuteInput, KgPort, MarketPort } from "../ports/index.js";

export function createFixtureMarketAdapter(): MarketPort {
  return {
    async loadMarketFixture(relativePath) {
      const fixture = await loadMarketFixture(relativePath);
      return { market: fixture.market, marketQuestion: fixture.marketQuestion };
    },
  };
}

export function createFixtureKgAdapter(): KgPort {
  return {
    async executePlan(input: KgExecuteInput) {
      const fixtures = await Promise.all(
        input.programFixturePaths.map((p) => loadProgramFixture(p)),
      );
      const graph = loadGraphFromProgramFixtures(fixtures);
      const repo = new InMemoryKnowledgeGraphRepository(graph);
      const plan = compileQueryPlan(input.marketQuestion, {
        forecastCutoff: input.forecastCutoff,
        therapeuticArea: input.therapeuticArea ?? "oncology",
      });
      return repo.executePlan(plan);
    },
  };
}
