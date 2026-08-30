import {
  InMemoryKnowledgeGraph,
  loadGraphFromProgramFixtures,
  type ClinicalFeatureSnapshot,
} from "@pivotaledge/kg";
import type {
  ClinicalCalibrationCase,
  HoldoutCase,
  HoldoutCorpus,
  ProgramFixture,
} from "@pivotaledge/schemas";

function dayBefore(iso: string): string {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString();
}

/**
 * Build a chronological holdout case from a program fixture.
 * Forecast cutoff is the day before the regulatory action (or, for result-only
 * failure paths, the result disclosure time so PE is available at cutoff).
 */
export function holdoutCaseFromProgram(fixture: ProgramFixture): HoldoutCase | null {
  const graph = new InMemoryKnowledgeGraph();
  graph.addProgram(fixture);
  const gp = graph.getProgram(fixture.program.id);
  if (!gp) return null;

  const actionAt =
    fixture.regulatoryAction?.actionDate ?? fixture.regulatoryAction?.provenance.firstPublicAt;
  const resultAt = fixture.trialResults
    .map((r) => r.provenance.firstPublicAt)
    .filter((x): x is string => x != null)
    .sort()
    .at(-1);

  let forecastCutoff: string | null = null;
  if (actionAt && resultAt && actionAt > resultAt) {
    // Decision after PE known — score day before action (no outcome leakage).
    forecastCutoff = dayBefore(actionAt);
  } else if (actionAt && !resultAt) {
    forecastCutoff = dayBefore(actionAt);
  } else if (resultAt) {
    // Trial-failure / disclosure path: features include PE at disclosure time.
    forecastCutoff = resultAt;
  }
  if (!forecastCutoff) return null;

  const snap: ClinicalFeatureSnapshot = graph.clinicalFeaturesAtCutoff(gp, forecastCutoff);

  if (snap.phase == null || snap.therapeuticArea == null) return null;
  if (snap.primaryEndpointMet == null) return null;

  const resolvedApproved =
    fixture.program.status === "approved"
      ? true
      : fixture.program.status === "crl" || fixture.program.status === "discontinued"
        ? false
        : fixture.regulatoryAction?.actionType === "approval";

  if (resolvedApproved !== true && resolvedApproved !== false) return null;

  const enrollmentRatio =
    snap.plannedEnrollment != null && snap.plannedEnrollment > 0 && snap.actualEnrollment != null
      ? snap.actualEnrollment / snap.plannedEnrollment
      : null;

  return {
    caseId: `kg_${fixture.program.id}`,
    forecastCutoff,
    phase: snap.phase,
    therapeuticArea: snap.therapeuticArea,
    primaryEndpointMet: snap.primaryEndpointMet,
    applicationFiled: snap.applicationFiled,
    resolvedApproved,
    biomarkerEnriched: snap.biomarkerEnriched,
    orphanDesignated: snap.orphanDesignated,
    priorApprovalCount: snap.priorApprovalCount,
    designationCount: snap.designationTypes.length,
    enrollmentRatio,
    trialStatus: snap.trialStatus,
    endpointFamily: snap.endpointFamily,
  };
}

export function clinicalCalibrationCaseFromProgram(
  fixture: ProgramFixture,
  options?: { calibrationCaseId?: string; dataProvenance?: string },
): ClinicalCalibrationCase | null {
  const holdout = holdoutCaseFromProgram(fixture);
  if (!holdout) return null;
  return {
    ...holdout,
    caseId: options?.calibrationCaseId ?? holdout.caseId,
    applicationNumber: fixture.application?.applicationNumber ?? undefined,
    brandName: fixture.drugAsset.preferredName,
    sponsorName: fixture.sponsor.name,
    dataProvenance: options?.dataProvenance ?? "kg_retrospective_trial",
  };
}

export function holdoutCorpusFromPrograms(
  fixtures: ProgramFixture[],
  description = "Holdout cases derived from local clinical KG program fixtures.",
): HoldoutCorpus {
  void loadGraphFromProgramFixtures(fixtures);
  const cases = fixtures
    .map((f) => holdoutCaseFromProgram(f))
    .filter((c): c is HoldoutCase => c != null)
    .sort((a, b) => a.forecastCutoff.localeCompare(b.forecastCutoff));

  return {
    kind: "forecast_holdout_corpus",
    description,
    cases,
  };
}
