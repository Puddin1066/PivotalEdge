import { END, MemorySaver, START, StateGraph } from "@langchain/langgraph";

import type { OrchestrationContext } from "../context.js";
import type { FixtureProfile } from "../fixtures/profiles.js";
import { EnrichmentGraphState } from "./graph-state.js";
import { createEnrichmentNodes } from "./nodes.js";
import { routeAfterEvaluateGaps, routeAfterHumanReview, routeAfterValidate } from "./routing.js";
import { routeResearchParallel } from "./research-routing.js";

export type CompiledEnrichmentGraph = ReturnType<typeof compileEnrichmentGraph>;

export function compileEnrichmentGraph(
  ctx: OrchestrationContext,
  profile: FixtureProfile,
  checkpointer?: MemorySaver,
) {
  const nodes = createEnrichmentNodes({ ctx, profile });

  const graph = new StateGraph(EnrichmentGraphState)
    .addNode("bootstrap", nodes.bootstrap)
    .addNode("evaluate_gaps", nodes.evaluateGaps)
    .addNode("plan_research", nodes.planResearch)
    .addNode("research_clinical", nodes.researchClinical)
    .addNode("research_regulatory", nodes.researchRegulatory)
    .addNode("research_company", nodes.researchCompany)
    .addNode("validate_evidence", nodes.validateEvidence)
    .addNode("human_review_gate", nodes.humanReviewGate)
    .addNode("write_evidence", nodes.writeEvidence)
    .addNode("rerun_prediction", nodes.rerunPrediction)
    .addNode("finalize", nodes.finalize)
    .addEdge(START, "bootstrap")
    .addEdge("bootstrap", "evaluate_gaps")
    .addConditionalEdges("evaluate_gaps", routeAfterEvaluateGaps, {
      plan_research: "plan_research",
      finalize: "finalize",
    })
    .addConditionalEdges("plan_research", routeResearchParallel, [
      "research_clinical",
      "research_regulatory",
      "research_company",
      "validate_evidence",
    ])
    .addEdge("research_clinical", "validate_evidence")
    .addEdge("research_regulatory", "validate_evidence")
    .addEdge("research_company", "validate_evidence")
    .addConditionalEdges("validate_evidence", routeAfterValidate, {
      human_review_gate: "human_review_gate",
      finalize: "finalize",
    })
    .addConditionalEdges("human_review_gate", routeAfterHumanReview, {
      write_evidence: "write_evidence",
      finalize: "finalize",
    })
    .addEdge("write_evidence", "rerun_prediction")
    .addEdge("rerun_prediction", "evaluate_gaps")
    .addEdge("finalize", END);

  return graph.compile({
    checkpointer: checkpointer ?? new MemorySaver(),
  });
}
