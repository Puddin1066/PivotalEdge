import { Send } from "@langchain/langgraph";

import type { EnrichmentGraphStateType } from "./graph-state.js";
import { groupTasksByDomain } from "../gaps/research-domain.js";

export type ResearchParallelRoute = Send[] | "validate_evidence";

/** Fan-out independent research tasks to domain branches (Phase 4). */
export function routeResearchParallel(state: EnrichmentGraphStateType): ResearchParallelRoute {
  const tasks = state.researchTasks;
  if (!tasks.length) return "validate_evidence";

  const grouped = groupTasksByDomain(tasks);
  const sends: Send[] = [];
  const shared = {
    marketQuestion: state.marketQuestion,
    forecastCutoff: state.forecastCutoff,
  };

  if (grouped.clinical.length) {
    sends.push(new Send("research_clinical", { ...shared, batchTasks: grouped.clinical }));
  }
  if (grouped.regulatory.length) {
    sends.push(new Send("research_regulatory", { ...shared, batchTasks: grouped.regulatory }));
  }
  if (grouped.company.length) {
    sends.push(new Send("research_company", { ...shared, batchTasks: grouped.company }));
  }

  return sends.length ? sends : "validate_evidence";
}
