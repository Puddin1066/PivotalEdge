import type {
  ApprovedTherapyLink,
  ClinicalProgram,
  ClinicalTrial,
  Designation,
  Document,
  DrugAsset,
  Endpoint,
  EvidenceAssertion,
  Indication,
  Mechanism,
  PriorApprovalLink,
  ProgramFixture,
  RegulatoryAction,
  RegulatoryApplication,
  Sponsor,
  TrialResult,
} from "@pivotaledge/schemas";
import { isAvailableAtCutoff } from "@pivotaledge/schemas";

import { computeRegulatoryClockMetrics } from "./clock-metrics.js";

export type GraphProgram = {
  fixture: ProgramFixture;
  drug: DrugAsset;
  sponsor: Sponsor;
  indication: Indication;
  program: ClinicalProgram;
  mechanisms: Mechanism[];
  trials: ClinicalTrial[];
  endpoints: Endpoint[];
  trialResults: TrialResult[];
  application: RegulatoryApplication | null;
  regulatoryAction: RegulatoryAction | null;
  designations: Designation[];
  approvedTherapiesInIndication: ApprovedTherapyLink[];
  priorApprovals: PriorApprovalLink[];
  documents: Document[];
};

/** Flattened clinical features available at a forecast cutoff (for models / calibration). */
export type ClinicalFeatureSnapshot = {
  programId: string;
  phase: string | null;
  therapeuticArea: string | null;
  primaryEndpointMet: boolean | null;
  endpointFamily: string | null;
  applicationFiled: boolean;
  applicationAccepted: boolean;
  filedAt: string | null;
  acceptedAt: string | null;
  pdufaDate: string | null;
  expectedFilingAt: string | null;
  reviewProgram: string;
  registeredAt: string | null;
  studyStartAt: string | null;
  primaryCompletionAt: string | null;
  completionAt: string | null;
  actionDate: string | null;
  trialStatus: string | null;
  plannedEnrollment: number | null;
  actualEnrollment: number | null;
  biomarkerEnriched: boolean;
  designationTypes: string[];
  orphanDesignated: boolean;
  approvedTherapyCount: number;
  priorApprovalCount: number;
  resolvedApproved: boolean | null;
  /** Calculated milestone deltas (days). */
  daysRegistrationToPrimaryCompletion: number | null;
  daysPrimaryCompletionToAcceptance: number | null;
  daysAcceptanceToPdufa: number | null;
  daysAcceptanceToAction: number | null;
  inferredReviewWindowDays: number;
};

export class InMemoryKnowledgeGraph {
  readonly programs = new Map<string, GraphProgram>();

  addProgram(fixture: ProgramFixture): void {
    this.programs.set(fixture.program.id, {
      fixture,
      drug: fixture.drugAsset,
      sponsor: fixture.sponsor,
      indication: fixture.indication,
      program: fixture.program,
      mechanisms: fixture.mechanisms ?? [],
      trials: fixture.trials,
      endpoints: fixture.endpoints ?? [],
      trialResults: fixture.trialResults,
      application: fixture.application,
      regulatoryAction: fixture.regulatoryAction,
      designations: fixture.designations ?? [],
      approvedTherapiesInIndication: fixture.approvedTherapiesInIndication ?? [],
      priorApprovals: fixture.priorApprovals ?? [],
      documents: fixture.documents,
    });
  }

  listPrograms(): GraphProgram[] {
    return [...this.programs.values()];
  }

  getProgram(programId: string): GraphProgram | undefined {
    return this.programs.get(programId);
  }

  findProgramByDrugAssetId(drugAssetId: string): GraphProgram | undefined {
    return this.listPrograms().find((p) => p.program.drugAssetId === drugAssetId);
  }

  /** Collect assertion-like evidence IDs available at cutoff (trial results + regulatory actions). */
  evidenceAtCutoff(
    program: GraphProgram,
    forecastCutoff: string,
  ): {
    included: string[];
    excluded: string[];
  } {
    const included: string[] = [];
    const excluded: string[] = [];

    for (const r of program.trialResults) {
      const fp = r.provenance.firstPublicAt;
      if (isAvailableAtCutoff(fp, forecastCutoff)) included.push(r.id);
      else excluded.push(r.id);
    }
    if (program.regulatoryAction) {
      const fp = program.regulatoryAction.provenance.firstPublicAt;
      if (isAvailableAtCutoff(fp, forecastCutoff)) included.push(program.regulatoryAction.id);
      else excluded.push(program.regulatoryAction.id);
    }
    for (const d of program.designations) {
      const fp = d.provenance.firstPublicAt;
      if (isAvailableAtCutoff(fp, forecastCutoff)) included.push(d.id);
      else excluded.push(d.id);
    }
    for (const d of program.documents) {
      const fp = d.provenance.firstPublicAt;
      if (isAvailableAtCutoff(fp, forecastCutoff)) included.push(d.id);
      else excluded.push(d.id);
    }
    return { included, excluded };
  }

  outcomeLabel(
    program: GraphProgram,
  ): "approval" | "crl" | "withdrawn" | "trial_failure" | "unresolved" {
    const status = program.program.status;
    if (status === "approved") return "approval";
    if (status === "crl") return "crl";
    if (status === "withdrawn") return "withdrawn";
    if (status === "discontinued") return "trial_failure";
    return "unresolved";
  }

  primaryEndpointMetAtCutoff(program: GraphProgram, forecastCutoff: string): boolean | null {
    for (const r of program.trialResults) {
      if (!isAvailableAtCutoff(r.provenance.firstPublicAt, forecastCutoff)) continue;
      if (r.primaryEndpointMet != null) return r.primaryEndpointMet;
    }
    return null;
  }

  designationsAtCutoff(program: GraphProgram, forecastCutoff: string): Designation[] {
    return program.designations.filter((d) =>
      isAvailableAtCutoff(d.provenance.firstPublicAt, forecastCutoff),
    );
  }

  /** Snapshot of ranked clinical features as-of cutoff (Wave 1–4 schema). */
  clinicalFeaturesAtCutoff(program: GraphProgram, forecastCutoff: string): ClinicalFeatureSnapshot {
    const trial = program.trials[0] ?? null;
    const primaryEndpoint =
      program.endpoints.find((e) => e.isPrimary) ?? program.endpoints[0] ?? null;
    const designations = this.designationsAtCutoff(program, forecastCutoff);
    const approvedTherapies = program.approvedTherapiesInIndication.filter((t) =>
      isAvailableAtCutoff(t.provenance.firstPublicAt, forecastCutoff),
    );
    const priorApprovals = program.priorApprovals.filter((p) =>
      isAvailableAtCutoff(p.provenance.firstPublicAt, forecastCutoff),
    );

    const app = program.application;
    const clockPublic =
      app?.clockProvenance == null ||
      isAvailableAtCutoff(app.clockProvenance.firstPublicAt, forecastCutoff);

    const filedAt = clockPublic ? (app?.filedAt ?? null) : null;
    const acceptedAt = clockPublic ? (app?.acceptedAt ?? null) : null;
    const pdufaDate = clockPublic ? (app?.pdufaDate ?? null) : null;
    const expectedFilingAt = clockPublic ? (app?.expectedFilingAt ?? null) : null;
    const reviewProgram = clockPublic ? (app?.reviewProgram ?? "unknown") : "unknown";
    const inferredReviewProgram =
      reviewProgram === "unknown" &&
      designations.some((d) => d.designationType === "priority_review")
        ? "priority"
        : reviewProgram;
    // Planning-only stubs carry expectedFilingAt without a real filing.
    const planningOnly =
      app != null &&
      expectedFilingAt != null &&
      filedAt == null &&
      acceptedAt == null &&
      app.applicationNumber == null;
    const applicationFiled = app != null && !planningOnly;
    const applicationAccepted = acceptedAt != null;

    let resolvedApproved: boolean | null = null;
    let actionDate: string | null = null;
    if (program.regulatoryAction) {
      if (isAvailableAtCutoff(program.regulatoryAction.provenance.firstPublicAt, forecastCutoff)) {
        resolvedApproved = program.regulatoryAction.actionType === "approval";
        actionDate = program.regulatoryAction.actionDate;
      }
    } else if (program.program.status === "approved" || program.program.status === "crl") {
      // Label known from fixture status only when action not yet public — leave null for forecasting.
      resolvedApproved = null;
    }

    const clock = computeRegulatoryClockMetrics({
      forecastCutoff,
      registeredAt: trial?.registeredAt ?? null,
      studyStartAt: trial?.studyStartAt ?? null,
      primaryCompletionAt: trial?.primaryCompletionAt ?? null,
      completionAt: trial?.completionAt ?? null,
      filedAt,
      acceptedAt,
      pdufaDate,
      expectedFilingAt,
      actionDate,
      reviewProgram: inferredReviewProgram,
    });

    return {
      programId: program.program.id,
      phase: trial?.phase ?? null,
      therapeuticArea: program.indication.therapeuticArea,
      primaryEndpointMet: this.primaryEndpointMetAtCutoff(program, forecastCutoff),
      endpointFamily: primaryEndpoint?.endpointFamily ?? null,
      applicationFiled: applicationFiled,
      applicationAccepted,
      filedAt,
      acceptedAt,
      pdufaDate,
      expectedFilingAt,
      reviewProgram: inferredReviewProgram,
      registeredAt: trial?.registeredAt ?? null,
      studyStartAt: trial?.studyStartAt ?? null,
      primaryCompletionAt: trial?.primaryCompletionAt ?? null,
      completionAt: trial?.completionAt ?? null,
      actionDate,
      trialStatus: trial?.status ?? null,
      plannedEnrollment: trial?.plannedEnrollment ?? null,
      actualEnrollment: trial?.actualEnrollment ?? null,
      biomarkerEnriched: trial?.biomarkerEnriched ?? false,
      designationTypes: designations.map((d) => d.designationType),
      orphanDesignated: designations.some((d) => d.designationType === "orphan"),
      approvedTherapyCount: approvedTherapies.length,
      priorApprovalCount: priorApprovals.length,
      resolvedApproved,
      daysRegistrationToPrimaryCompletion: clock.daysRegistrationToPrimaryCompletion,
      daysPrimaryCompletionToAcceptance: clock.daysPrimaryCompletionToAcceptance,
      daysAcceptanceToPdufa: clock.daysAcceptanceToPdufa,
      daysAcceptanceToAction: clock.daysAcceptanceToAction,
      inferredReviewWindowDays: clock.inferredReviewWindowDays,
    };
  }
}

export function programToAssertions(program: GraphProgram): EvidenceAssertion[] {
  const assertions: EvidenceAssertion[] = [];
  for (const r of program.trialResults) {
    if (r.primaryEndpointMet != null) {
      assertions.push({
        id: `assert_${r.id}_pe`,
        claim: `Primary endpoint met: ${r.primaryEndpointMet}`,
        layer: "sourced_fact",
        polarity: r.primaryEndpointMet ? "supports" : "contradicts",
        relatedEntityIds: [r.trialId, r.id],
        documentId: null,
        provenance: r.provenance,
      });
    }
  }
  if (program.regulatoryAction) {
    assertions.push({
      id: `assert_${program.regulatoryAction.id}`,
      claim: `Regulatory action: ${program.regulatoryAction.actionType}`,
      layer: "sourced_fact",
      polarity: program.regulatoryAction.actionType === "approval" ? "supports" : "contradicts",
      relatedEntityIds: [program.program.id, program.regulatoryAction.id],
      documentId: program.documents[0]?.id ?? null,
      provenance: program.regulatoryAction.provenance,
    });
  }
  for (const d of program.designations) {
    assertions.push({
      id: `assert_${d.id}`,
      claim: `FDA designation: ${d.designationType}`,
      layer: "sourced_fact",
      polarity: "supports",
      relatedEntityIds: [d.programId, d.id],
      documentId: null,
      provenance: d.provenance,
    });
  }
  const app = program.application;
  if (app?.clockProvenance) {
    const clockFacts: { field: string; value: string | null; claim: string }[] = [
      { field: "filed", value: app.filedAt, claim: "Application filed" },
      { field: "accepted", value: app.acceptedAt, claim: "Application accepted for FDA review" },
      { field: "pdufa", value: app.pdufaDate, claim: "PDUFA target action date" },
      { field: "expected_filing", value: app.expectedFilingAt, claim: "Sponsor filing guidance" },
    ];
    for (const fact of clockFacts) {
      if (!fact.value) continue;
      assertions.push({
        id: `assert_${app.id}_clock_${fact.field}`,
        claim: `${fact.claim}: ${fact.value}`,
        layer: "sourced_fact",
        polarity: "supports",
        relatedEntityIds: [program.program.id, app.id],
        documentId: program.documents.find((doc) => doc.id.includes("reg_clock"))?.id ?? null,
        provenance: app.clockProvenance,
      });
    }
    if (app.reviewProgram && app.reviewProgram !== "unknown") {
      assertions.push({
        id: `assert_${app.id}_review_program`,
        claim: `FDA review program: ${app.reviewProgram}`,
        layer: "sourced_fact",
        polarity: "supports",
        relatedEntityIds: [program.program.id, app.id],
        documentId: null,
        provenance: app.clockProvenance,
      });
    }
  }
  return assertions;
}
