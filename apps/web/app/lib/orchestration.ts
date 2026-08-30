import path from "node:path";

import {
  getLatestOrchestrationTraceForMarket,
  resolveOrchestrationMarketIdsForOps,
} from "@pivotaledge/orchestration";

import { resolveRepoRoot } from "./repo-root";

export function orchestrationDataDir(): string {
  return path.join(resolveRepoRoot(), "data/orchestration");
}

export async function loadResearchTraceForMarket(marketId: string | string[]) {
  return getLatestOrchestrationTraceForMarket(marketId, orchestrationDataDir());
}

export async function loadResearchTraceForOpsMarket(polymarketId: string) {
  return loadResearchTraceForMarket(resolveOrchestrationMarketIdsForOps(polymarketId));
}
