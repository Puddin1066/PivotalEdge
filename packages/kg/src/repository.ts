import type { KnowledgeGraphQueryPlan, PrecedentBundle } from "@pivotaledge/schemas";

import { executeQueryPlan } from "./execute.js";
import type { InMemoryKnowledgeGraph } from "./graph.js";

/** Repository contract — PostgreSQL implementation deferred; in-memory for S4. */
export interface KnowledgeGraphRepository {
  executePlan(plan: KnowledgeGraphQueryPlan): PrecedentBundle;
}

export class InMemoryKnowledgeGraphRepository implements KnowledgeGraphRepository {
  constructor(private readonly graph: InMemoryKnowledgeGraph) {}

  executePlan(plan: KnowledgeGraphQueryPlan): PrecedentBundle {
    return executeQueryPlan(plan, { graph: this.graph });
  }
}
