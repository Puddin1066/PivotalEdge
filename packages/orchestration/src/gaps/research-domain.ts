import type { ModelInformationGap, ResearchTask } from "@pivotaledge/schemas";

export type ResearchDomain = "clinical" | "regulatory" | "company";

/** Map gap source priority to research branch (Phase 4 parallel routing). */
export function inferResearchDomain(gap: ModelInformationGap): ResearchDomain {
  const sources = gap.sourcePriority.map((s) => s.toLowerCase());
  if (sources.some((s) => s.includes("openfda") || s.includes("fda") || s.includes("regulatory"))) {
    return "regulatory";
  }
  if (sources.some((s) => s.includes("sec") || s.includes("company_ir") || s.includes("ir"))) {
    return "company";
  }
  return "clinical";
}

export function groupTasksByDomain(tasks: ResearchTask[]): Record<ResearchDomain, ResearchTask[]> {
  const grouped: Record<ResearchDomain, ResearchTask[]> = {
    clinical: [],
    regulatory: [],
    company: [],
  };
  for (const task of tasks) {
    const domain = task.domain ?? "clinical";
    grouped[domain].push(task);
  }
  return grouped;
}
