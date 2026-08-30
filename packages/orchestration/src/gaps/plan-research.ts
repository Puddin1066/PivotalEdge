import type { ModelInformationGap, OrchestrationConfig, ResearchTask } from "@pivotaledge/schemas";

import { inferResearchDomain } from "./research-domain.js";

/** Fields that must not be synthetic-filled — fail closed until real source affirms. */
export const FAIL_CLOSED_GAP_FEATURES = new Set(["expectedFilingAt"]);

/** Pure research planning — selects tasks above threshold. */
export function planTargetedResearch(
  gaps: ModelInformationGap[],
  config: OrchestrationConfig,
): ResearchTask[] {
  const tasks: ResearchTask[] = [];

  for (const gap of gaps.slice(0, config.maxParallelResearchTasks)) {
    const priorityScore = gap.featureImportance * (gap.uncertainty ?? 1);
    if (priorityScore < config.minHighValueGapScore) continue;

    tasks.push({
      taskId: `task_${gap.featureName}`,
      gapFeature: gap.featureName,
      researchQuestion: gap.researchQuestion,
      sourcePriority: gap.sourcePriority,
      priorityScore,
      domain: inferResearchDomain(gap),
    });
  }

  return tasks.sort((a, b) => b.priorityScore - a.priorityScore);
}

export function hasMaterialGaps(
  gaps: ModelInformationGap[],
  config: OrchestrationConfig,
): boolean {
  return planTargetedResearch(gaps, config).length > 0;
}
