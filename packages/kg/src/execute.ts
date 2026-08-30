import type {
  AnalogueComparison,
  CohortSummary,
  KnowledgeGraphQueryPlan,
  PrecedentBundle,
  PrecedentProgram,
  ProgramSnapshot,
} from "@pivotaledge/schemas";
import { PrecedentBundleSchema } from "@pivotaledge/schemas";

import { type GraphProgram, InMemoryKnowledgeGraph } from "./graph.js";
import {
  computePeToFilingLag,
  endpointFamilyMatches,
  matchesPeToFilingLagCohort,
  medianLagDays,
  primaryEndpointPublicAt,
} from "./filing-lag.js";

function asOfStatus(
  gp: GraphProgram,
  features: ReturnType<InMemoryKnowledgeGraph["clinicalFeaturesAtCutoff"]>,
): string {
  if (features.resolvedApproved === true) return "approved";
  if (features.resolvedApproved === false) return "crl";
  // Hide terminal fixture labels until the action is public at cutoff (no future leakage).
  if (gp.program.status === "approved" || gp.program.status === "crl") return "active";
  return gp.program.status;
}

function programSnapshot(
  gp: GraphProgram,
  forecastCutoff: string,
  graph: InMemoryKnowledgeGraph,
): ProgramSnapshot {
  const features = graph.clinicalFeaturesAtCutoff(gp, forecastCutoff);
  return {
    programId: gp.program.id,
    drugAssetId: gp.drug.id,
    drugName: gp.drug.preferredName,
    sponsorId: gp.sponsor.id,
    sponsorName: gp.sponsor.name,
    indicationId: gp.indication.id,
    indicationName: gp.indication.name,
    therapeuticArea: gp.indication.therapeuticArea,
    status: asOfStatus(gp, features),
    trialIds: gp.trials.map((t) => t.id),
    applicationId: gp.application?.id ?? null,
    primaryEndpointMet: features.primaryEndpointMet,
    endpointFamily: features.endpointFamily,
    trialStatus: features.trialStatus,
    plannedEnrollment: features.plannedEnrollment,
    actualEnrollment: features.actualEnrollment,
    biomarkerEnriched: features.biomarkerEnriched,
    designationTypes: features.designationTypes,
    orphanDesignated: features.orphanDesignated,
    approvedTherapyCount: features.approvedTherapyCount,
    priorApprovalCount: features.priorApprovalCount,
    applicationFiled: features.applicationFiled,
    applicationAccepted: features.applicationAccepted,
    filedAt: features.filedAt,
    acceptedAt: features.acceptedAt,
    pdufaDate: features.pdufaDate,
    expectedFilingAt: features.expectedFilingAt,
    reviewProgram: features.reviewProgram,
    registeredAt: features.registeredAt,
    studyStartAt: features.studyStartAt,
    primaryCompletionAt: features.primaryCompletionAt,
    completionAt: features.completionAt,
    actionDate: features.actionDate,
    daysRegistrationToPrimaryCompletion: features.daysRegistrationToPrimaryCompletion,
    daysPrimaryCompletionToAcceptance: features.daysPrimaryCompletionToAcceptance,
    daysAcceptanceToPdufa: features.daysAcceptanceToPdufa,
    daysAcceptanceToAction: features.daysAcceptanceToAction,
    inferredReviewWindowDays: features.inferredReviewWindowDays,
    primaryResultPublicAt: primaryEndpointPublicAt(gp, forecastCutoff),
  };
}

function toPrecedentProgram(
  gp: GraphProgram,
  forecastCutoff: string,
  graph: InMemoryKnowledgeGraph,
): PrecedentProgram {
  const evidence = graph.evidenceAtCutoff(gp, forecastCutoff);
  return {
    programId: gp.program.id,
    drugName: gp.drug.preferredName,
    indicationName: gp.indication.name,
    therapeuticArea: gp.indication.therapeuticArea,
    phase: gp.trials[0]?.phase ?? null,
    outcome: graph.outcomeLabel(gp),
    primaryEndpointMet: graph.primaryEndpointMetAtCutoff(gp, forecastCutoff),
    sponsorName: gp.sponsor.name,
    evidenceIds: evidence.included,
  };
}

function matchesCohort(
  gp: GraphProgram,
  filters: Record<string, unknown>,
  targetTherapeuticArea: string | null | undefined,
  forecastCutoff: string,
  graph: InMemoryKnowledgeGraph,
): boolean {
  if (filters.lagType === "pe_to_filing") {
    return matchesPeToFilingLagCohort(gp, filters, forecastCutoff, graph);
  }
  if (filters.therapeuticArea && gp.indication.therapeuticArea !== filters.therapeuticArea) {
    return false;
  }
  if (filters.sameTherapeuticArea === true && targetTherapeuticArea) {
    if (gp.indication.therapeuticArea !== targetTherapeuticArea) return false;
  }
  if (filters.phase && gp.trials[0]?.phase !== filters.phase) return false;
  if (filters.outcome === "crl" && gp.program.status !== "crl") return false;
  if (filters.outcome === "rtf" && gp.program.status !== "rtf") return false;
  if (filters.includeApprovals === true && gp.program.status !== "approved") return false;
  if (filters.adcom === true) {
    const features = graph.clinicalFeaturesAtCutoff(gp, forecastCutoff);
    if (!features.designationTypes?.includes("adcom_scheduled")) return false;
  }
  if (filters.reviewProgram) {
    const features = graph.clinicalFeaturesAtCutoff(gp, forecastCutoff);
    if (features.reviewProgram !== filters.reviewProgram) return false;
  }
  if (filters.endpointFamily) {
    const features = graph.clinicalFeaturesAtCutoff(gp, forecastCutoff);
    if (!endpointFamilyMatches(features.endpointFamily, String(filters.endpointFamily))) {
      return false;
    }
  }
  return true;
}

function buildAnalogueComparison(
  target: GraphProgram,
  analogue: GraphProgram,
  forecastCutoff: string,
  graph: InMemoryKnowledgeGraph,
): AnalogueComparison {
  const similarities: string[] = [];
  const differences: string[] = [];

  if (target.indication.therapeuticArea === analogue.indication.therapeuticArea) {
    similarities.push(`Same therapeutic area: ${target.indication.therapeuticArea}`);
  } else {
    differences.push(
      `Therapeutic area ${target.indication.therapeuticArea} vs ${analogue.indication.therapeuticArea}`,
    );
  }
  if (target.trials[0]?.phase === analogue.trials[0]?.phase) {
    similarities.push(`Same phase: ${target.trials[0]?.phase}`);
  }
  if (target.sponsor.id === analogue.sponsor.id) {
    similarities.push("Same sponsor");
  } else {
    differences.push(`Sponsor ${target.sponsor.name} vs ${analogue.sponsor.name}`);
  }

  const evidence = graph.evidenceAtCutoff(analogue, forecastCutoff);
  const cutoffCompliant = evidence.excluded.length === 0 || evidence.included.length > 0;

  return {
    programId: analogue.program.id,
    similarities,
    differences,
    outcome: graph.outcomeLabel(analogue),
    cutoffCompliant,
  };
}

function summarizeCohort(
  label: string,
  programs: PrecedentProgram[],
  lagDays?: number[],
): CohortSummary {
  const approvals = programs.filter((p) => p.outcome === "approval").length;
  const crls = programs.filter((p) => p.outcome === "crl").length;
  const withdrawals = programs.filter((p) => p.outcome === "withdrawn").length;
  const unresolved = programs.filter((p) => p.outcome === "unresolved").length;
  const decided = approvals + crls + withdrawals;
  const empiricalRate = decided > 0 ? approvals / decided : null;
  return {
    cohortDefinition: label,
    programs,
    approvals,
    crls,
    withdrawals,
    unresolved,
    empiricalRate,
    ...(lagDays && lagDays.length > 0
      ? {
          peToFilingLagDaysMedian: medianLagDays(lagDays),
          peToFilingLagSampleSize: lagDays.length,
        }
      : {}),
  };
}

export type ExecutePlanOptions = {
  graph: InMemoryKnowledgeGraph;
};

export function executeQueryPlan(
  plan: KnowledgeGraphQueryPlan,
  options: ExecutePlanOptions,
): PrecedentBundle {
  const { graph } = options;
  const cutoff = plan.forecastCutoff;
  const q = plan.targetQuestion;

  const current: GraphProgram | null =
    (q.drugAssetId ? graph.findProgramByDrugAssetId(q.drugAssetId) : null) ??
    graph
      .listPrograms()
      .find((p) =>
        q.drugAliases.some((a) => p.drug.preferredName.toLowerCase() === a.toLowerCase()),
      ) ??
    null;

  const allPrograms = graph.listPrograms();
  const cohorts: CohortSummary[] = [];

  const targetTa = current?.indication.therapeuticArea ?? null;

  for (const cohortQuery of plan.analogueCohorts) {
    const matchedPrograms = allPrograms
      .filter((gp) => gp.program.id !== current?.program.id)
      .filter((gp) => matchesCohort(gp, cohortQuery.filters, targetTa, cutoff, graph))
      .slice(0, cohortQuery.maxPrograms);
    const matched = matchedPrograms.map((gp) => toPrecedentProgram(gp, cutoff, graph));
    const lagDays =
      cohortQuery.filters.lagType === "pe_to_filing"
        ? matchedPrograms
            .map((gp) => computePeToFilingLag(gp, cutoff)?.days)
            .filter((d): d is number => d != null)
        : undefined;
    cohorts.push(summarizeCohort(cohortQuery.label, matched, lagDays));
  }

  const negativePrograms = plan.negativeControlQueries.flatMap((nq) =>
    allPrograms
      .filter((gp) => gp.program.id !== current?.program.id)
      .filter((gp) => matchesCohort(gp, nq.filters, targetTa, cutoff, graph))
      .slice(0, nq.maxPrograms),
  );

  const exactAnalogues: AnalogueComparison[] = current
    ? negativePrograms
        .concat(allPrograms.filter((p) => p.program.id !== current.program.id))
        .filter((gp, idx, arr) => arr.findIndex((x) => x.program.id === gp.program.id) === idx)
        .slice(0, 5)
        .map((gp) => buildAnalogueComparison(current, gp, cutoff, graph))
    : [];

  const includedAssertionIds: string[] = [];
  const excludedAssertionIds: string[] = [];

  for (const gp of allPrograms) {
    const ev = graph.evidenceAtCutoff(gp, cutoff);
    includedAssertionIds.push(...ev.included);
    excludedAssertionIds.push(...ev.excluded);
  }

  const leakageDetected = false;

  const supportingEvidenceIds = current ? graph.evidenceAtCutoff(current, cutoff).included : [];

  const contradictoryEvidenceIds = negativePrograms.flatMap(
    (gp) => graph.evidenceAtCutoff(gp, cutoff).included,
  );

  const missingHighValueEvidence: string[] = [];
  if (current && !current.application) missingHighValueEvidence.push("regulatory_application");
  if (current?.application && !current.application.acceptedAt && !current.application.expectedFilingAt) {
    missingHighValueEvidence.push("regulatory_acceptance_or_filing_guidance");
  }
  if (
    current?.application?.acceptedAt &&
    !current.application.pdufaDate &&
    current.application.reviewProgram !== "cnpv"
  ) {
    missingHighValueEvidence.push("pdufa_or_target_action_date");
  }
  if (current && current.trialResults.length === 0) {
    missingHighValueEvidence.push("trial_results");
  }

  return PrecedentBundleSchema.parse({
    marketQuestionId: q.marketId,
    currentProgram: current ? programSnapshot(current, cutoff, graph) : null,
    cohorts,
    exactAnalogues,
    supportingEvidenceIds,
    contradictoryEvidenceIds: [...new Set(contradictoryEvidenceIds)],
    missingHighValueEvidence,
    cutoffCompliance: {
      forecastCutoff: cutoff,
      checkedAt: new Date().toISOString(),
      includedAssertionIds: [...new Set(includedAssertionIds)],
      excludedAssertionIds: [...new Set(excludedAssertionIds)],
      leakageDetected,
      notes: leakageDetected ? ["Future evidence excluded from bundle inputs"] : [],
    },
  });
}
