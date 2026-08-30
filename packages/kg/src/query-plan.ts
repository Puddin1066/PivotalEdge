import type { MarketEventType, MarketQuestion, KnowledgeGraphQueryPlan } from "@pivotaledge/schemas";
import { KnowledgeGraphQueryPlanSchema } from "@pivotaledge/schemas";
import type { AnalogueCohortQuery, EvidenceQuery } from "@pivotaledge/schemas";

export type CompileQueryPlanOptions = {
  forecastCutoff?: string;
  modelCallId?: string | null;
  therapeuticArea?: string | null;
};

const BASE_TRAVERSAL = (question: MarketQuestion) => [
  {
    fromNodeType: "DrugAsset",
    fromNodeId: question.drugAssetId,
    relationship: "DEVELOPS",
    toNodeType: "ClinicalProgram",
    filters: { indicationId: question.indicationId ?? "" },
  },
  {
    fromNodeType: "ClinicalProgram",
    fromNodeId: null,
    relationship: "CONTAINS",
    toNodeType: "ClinicalTrial",
    filters: {},
  },
  {
    fromNodeType: "ClinicalProgram",
    fromNodeId: null,
    relationship: "SUPPORTS",
    toNodeType: "RegulatoryApplication",
    filters: { applicationId: question.applicationId ?? "" },
  },
];

function cohortsForEventType(
  eventType: MarketEventType,
  therapeuticArea: string,
): AnalogueCohortQuery[] {
  const taCohort: AnalogueCohortQuery = {
    cohortId: "cohort_same_therapeutic_area",
    label: "Same therapeutic area and phase III",
    filters: { therapeuticArea, phase: "III", includeApprovals: true },
    includeNegativeOutcomes: true,
    maxPrograms: 25,
  };

  switch (eventType) {
    case "NDA_BLA_SUBMISSION":
      return [
        taCohort,
        {
          cohortId: "cohort_filing_lag",
          label: "PE public → historical filing lag",
          filters: { phase: "III", lagType: "pe_to_filing" },
          includeNegativeOutcomes: true,
          maxPrograms: 20,
        },
      ];
    case "FILING_ACCEPTANCE":
      return [
        taCohort,
        {
          cohortId: "cohort_refuse_to_file",
          label: "Refuse-to-file analogues",
          filters: { outcome: "rtf", sameTherapeuticArea: true },
          includeNegativeOutcomes: true,
          maxPrograms: 15,
        },
      ];
    case "FDA_APPROVAL":
    case "FDA_APPROVAL_BY_DATE":
      return [
        taCohort,
        {
          cohortId: "cohort_filing_lag",
          label: "PE public → historical filing lag",
          filters: { phase: "III", lagType: "pe_to_filing" },
          includeNegativeOutcomes: true,
          maxPrograms: 20,
        },
        {
          cohortId: "cohort_review_duration",
          label: "Review-duration analogues (acceptance → action)",
          filters: { reviewProgram: "priority", phase: "III" },
          includeNegativeOutcomes: true,
          maxPrograms: 20,
        },
        {
          cohortId: "cohort_same_endpoint_family",
          label: "Same endpoint family (overall survival)",
          filters: { endpointFamily: "overall_survival", phase: "III" },
          includeNegativeOutcomes: true,
          maxPrograms: 25,
        },
      ];
    case "TRIAL_PRIMARY_ENDPOINT":
    case "TRIAL_POSITIVE_TOPLINE":
      return [
        {
          cohortId: "cohort_same_endpoint_family",
          label: "Same endpoint family pivotal trials",
          filters: { endpointFamily: "overall_survival", phase: "III" },
          includeNegativeOutcomes: true,
          maxPrograms: 25,
        },
        taCohort,
      ];
    case "ADVISORY_COMMITTEE_VOTE":
      return [
        {
          cohortId: "cohort_adcom_history",
          label: "AdCom vote history in therapeutic area",
          filters: { therapeuticArea, adcom: true },
          includeNegativeOutcomes: true,
          maxPrograms: 15,
        },
        taCohort,
      ];
    default:
      return [taCohort];
  }
}

function evidenceQueriesForEventType(question: MarketQuestion): EvidenceQuery[] {
  const baseIds = [
    question.drugAssetId,
    question.applicationId,
    ...question.linkedTrialIds,
  ].filter((id): id is string => Boolean(id));

  switch (question.eventType) {
    case "NDA_BLA_SUBMISSION":
      return [
        {
          queryId: "evidence_filing_guidance",
          entityIds: baseIds,
          documentTypes: ["sec_filing", "company_ir", "results"],
        },
      ];
    case "FILING_ACCEPTANCE":
      return [
        {
          queryId: "evidence_filing_acceptance",
          entityIds: baseIds,
          documentTypes: ["openfda", "sec_filing"],
        },
      ];
    case "FDA_APPROVAL":
    case "FDA_APPROVAL_BY_DATE":
      return [
        {
          queryId: "evidence_regulatory_clock",
          entityIds: baseIds,
          documentTypes: ["openfda", "review", "sec_filing"],
        },
      ];
    case "TRIAL_PRIMARY_ENDPOINT":
    case "TRIAL_POSITIVE_TOPLINE":
      return [
        {
          queryId: "evidence_trial_results",
          entityIds: baseIds,
          documentTypes: ["results", "publication", "clinicaltrials.gov"],
        },
      ];
    case "ADVISORY_COMMITTEE_VOTE":
      return [
        {
          queryId: "evidence_adcom",
          entityIds: baseIds,
          documentTypes: ["fda", "company_ir"],
        },
      ];
    default:
      return [
        {
          queryId: "evidence_current_program",
          entityIds: baseIds,
          documentTypes: ["results", "review", "sec_filing"],
        },
      ];
  }
}

/**
 * Deterministic MarketQuestion → KG query plan (S4 thin).
 * Branches analogue cohorts and evidence queries by contract eventType (ADR / ENRICHMENT_PRIORITY P0).
 */
export function compileQueryPlan(
  question: MarketQuestion,
  options: CompileQueryPlanOptions = {},
): KnowledgeGraphQueryPlan {
  const forecastCutoff = options.forecastCutoff ?? question.eventDeadline;
  const therapeuticArea = options.therapeuticArea ?? "oncology";

  const plan = KnowledgeGraphQueryPlanSchema.parse({
    targetQuestion: question,
    exactEntityTraversal: BASE_TRAVERSAL(question),
    analogueCohorts: cohortsForEventType(question.eventType, therapeuticArea),
    currentEvidenceQueries: evidenceQueriesForEventType(question),
    negativeControlQueries: [
      {
        cohortId: "cohort_crl_negative",
        label: "Closest CRL and failure analogues",
        filters: { outcome: "crl", sameTherapeuticArea: true },
        includeNegativeOutcomes: true,
        maxPrograms: 10,
      },
    ],
    forecastCutoff,
    maximumHops: 4,
    minimumEvidenceGrade: "moderate",
    generatedByModelCallId: options.modelCallId ?? null,
    reviewed: question.ambiguityFlags.length === 0,
  });

  return plan;
}

export function validateQueryPlan(plan: KnowledgeGraphQueryPlan): string[] {
  const issues: string[] = [];
  if (!plan.targetQuestion.drugAssetId && plan.targetQuestion.drugAliases.length === 0) {
    issues.push("missing_drug_identifier");
  }
  if (plan.analogueCohorts.length === 0) {
    issues.push("missing_analogue_cohorts");
  }
  if (!plan.negativeControlQueries.length) {
    issues.push("missing_negative_controls");
  }
  if (Date.parse(plan.forecastCutoff) !== Date.parse(plan.forecastCutoff)) {
    issues.push("invalid_forecast_cutoff");
  }
  return issues;
}
