import { assessContractEvidence } from "./contract-checklist.js";
import { compileQueryPlan } from "./query-plan.js";
import { InMemoryKnowledgeGraphRepository } from "./repository.js";
import { loadGraphFromProgramFixtures } from "./loader.js";
import type {
  ContractCoverage,
  ContractEvidenceAssessment,
  MarketEventType,
  MarketQuestion,
  ProgramFixture,
} from "@pivotaledge/schemas";

/** Build a minimal MarketQuestion for contract assessment from a program fixture. */
export function marketQuestionForProgram(
  fixture: ProgramFixture,
  eventType: MarketEventType,
  marketId = "pm_contract_assess",
): MarketQuestion {
  return {
    marketId,
    eventType,
    drugAssetId: fixture.drugAsset.id,
    drugAliases: [fixture.drugAsset.preferredName],
    sponsorId: fixture.sponsor.id,
    indicationId: fixture.indication.id,
    population: null,
    applicationId: fixture.application?.id ?? null,
    linkedTrialIds: fixture.trials.map((t) => t.id),
    endpointIds: fixture.endpoints.map((e) => e.id),
    eventDeadline: "2027-12-31T23:59:00.000Z",
    resolutionSource: "contract_assessment",
    resolutionDefinition: "Contract checklist assessment for enriched program fixture.",
    conditionalApprovalCounts: true,
    ambiguityFlags: [],
    parserConfidence: 0.9,
  };
}

export function assessProgramContractCoverage(
  fixture: ProgramFixture,
  eventType: MarketEventType,
  forecastCutoff?: string,
): ContractEvidenceAssessment {
  const graph = loadGraphFromProgramFixtures([fixture]);
  const repo = new InMemoryKnowledgeGraphRepository(graph);
  const marketQuestion = marketQuestionForProgram(fixture, eventType);
  const cutoff = forecastCutoff ?? new Date().toISOString();
  const plan = compileQueryPlan(marketQuestion, {
    forecastCutoff: cutoff,
    therapeuticArea: fixture.indication.therapeuticArea,
  });
  const bundle = repo.executePlan(plan);
  return assessContractEvidence(marketQuestion, bundle);
}

/** Worst coverage across event types linked to a seed program. */
export function worstContractCoverageForSeed(
  fixture: ProgramFixture,
  eventTypes: MarketEventType[],
  forecastCutoff?: string,
): ContractCoverage {
  if (!eventTypes.length) eventTypes = ["FDA_APPROVAL_BY_DATE"];

  let worst: ContractCoverage = "complete";
  for (const eventType of eventTypes) {
    const assessment = assessProgramContractCoverage(fixture, eventType, forecastCutoff);
    if (assessment.contractCoverage === "blocked") return "blocked";
    if (assessment.contractCoverage === "partial") worst = "partial";
  }
  return worst;
}

export function eventTypesFromSeed(seed: {
  marketEventTypes?: Record<string, MarketEventType>;
}): MarketEventType[] {
  if (!seed.marketEventTypes) return ["FDA_APPROVAL_BY_DATE"];
  return [...new Set(Object.values(seed.marketEventTypes))];
}
