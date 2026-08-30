import { loadProgramFixture, type ProgramFixture } from "@pivotaledge/schemas";

import { InMemoryKnowledgeGraph } from "./graph.js";

export async function loadGraphFromFixtures(
  relativePaths: string[],
  fixturesRoot?: string,
): Promise<InMemoryKnowledgeGraph> {
  const graph = new InMemoryKnowledgeGraph();
  for (const rel of relativePaths) {
    const fixture = await loadProgramFixture(rel, fixturesRoot);
    graph.addProgram(fixture);
  }
  return graph;
}

export function loadGraphFromProgramFixtures(fixtures: ProgramFixture[]): InMemoryKnowledgeGraph {
  const graph = new InMemoryKnowledgeGraph();
  for (const fixture of fixtures) {
    graph.addProgram(fixture);
  }
  return graph;
}
