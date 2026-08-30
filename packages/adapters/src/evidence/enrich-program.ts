/**
 * Build ProgramFixture rows from live CT.gov (+ optional FDA / Open Targets) evidence.
 * Used by kg:enrich for Polymarket-prioritized pipeline programs.
 */
import { createHash } from "node:crypto";

import type { CtStudySummary } from "../clinicaltrials/client.js";
import type { FdaApplicationSummary } from "../openfda/drugsfda.js";
import type { OtKnownDrug } from "../opentargets/client.js";
import type { ProgramFixture, TemporalProvenance } from "@pivotaledge/schemas";
import { ProgramFixtureSchema } from "@pivotaledge/schemas";

import type { CompetitorApprovalHit } from "./competitor-approvals.js";

/** Embedded trial ops for offline retrospective KG fixtures (no CT.gov required). */
export type RetrospectiveTrialOps = {
  phase: "I" | "I/II" | "II" | "II/III" | "III" | "IV" | "other" | "unknown";
  title: string;
  status:
    | "planned"
    | "recruiting"
    | "active"
    | "completed"
    | "terminated"
    | "withdrawn"
    | "unknown";
  plannedEnrollment: number | null;
  actualEnrollment: number | null;
  masking: "open" | "single" | "double" | "triple" | "quadruple" | "unknown";
  allocation: "randomized" | "non_randomized" | "unknown";
};

export type EnrichSeedProgram = {
  /** Stable slug for fixture filename / ids */
  slug: string;
  preferredName: string;
  modality: string | null;
  mechanismName: string;
  mechanismTarget: string | null;
  firstInClass: boolean;
  sponsorName: string;
  indicationName: string;
  therapeuticArea: string;
  /** Open Targets / MONDO / EFO disease id when known */
  diseaseOntologyId: string | null;
  nctId: string;
  /** openFDA application number when filed */
  applicationNumber: string | null;
  applicationType: "NDA" | "BLA" | "sNDA" | "sBLA" | "unknown";
  programStatus: "active" | "approved" | "crl" | "discontinued";
  biomarkerEnriched: boolean;
  /** Timed primary-endpoint label (public press / CT results) */
  primaryEndpointMet: boolean | null;
  primaryEndpointFamily: "OS" | "PFS" | "ORR" | "EFS" | "DFS" | "safety" | "other" | "unknown";
  primaryResultPublicAt: string | null;
  primaryResultSourceUrl: string | null;
  primaryResultPassage: string | null;
  /**
   * Explicit regulatory action date (approval / CRL / withdrawal disclosure).
   * Required for resolved retrospective programs when openFDA is not fetched.
   */
  regulatoryActionDate?: string | null;
  regulatoryActionType?: "approval" | "crl" | "withdrawal" | null;
  /** Offline trial ops — used by retrospective ingest when CT.gov is skipped */
  trialOps?: RetrospectiveTrialOps;
  /** Link to fixtures/calibration caseId when syncing S8b */
  calibrationCaseId?: string | null;
  designations: {
    designationType: "orphan" | "fast_track" | "breakthrough" | "accelerated_approval" | "priority_review";
    grantedAt: string;
    sourceUrl: string;
  }[];
  /** Curated regulatory clock facts (IR press / FDA); merged into application at enrich. */
  regulatoryClock?: {
    filedAt?: string | null;
    acceptedAt?: string | null;
    pdufaDate?: string | null;
    expectedFilingAt?: string | null;
    reviewProgram?: "standard" | "priority" | "accelerated" | "cnpv" | "unknown";
    clockSourceUrl?: string | null;
    clockFirstPublicAt?: string | null;
    clockPassage?: string | null;
  };
  /** Extra names for openFDA lookup when preferredName misses (brand / code names). */
  openFdaSearchNames?: string[];
  /** Static competitor names when Open Targets unavailable */
  fallbackCompetitors: string[];
  polymarketMarketIds: string[];
  /** Polymarket market id → resolving eventType (P0 contract checklist). */
  marketEventTypes?: Record<string, import("@pivotaledge/schemas").MarketEventType>;
  notes: string;
};

function slugId(prefix: string, slug: string): string {
  return `${prefix}_${slug.replace(/[^a-z0-9]+/gi, "_").toLowerCase()}`;
}

function checksum(s: string): string {
  return `sha256:${createHash("sha256").update(s).digest("hex").slice(0, 24)}`;
}

function toIsoDate(date: string | null | undefined, fallbackHour = "12:00:00.000Z"): string | null {
  if (!date) return null;
  if (date.includes("T")) return date;
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return `${date}T${fallbackHour}`;
  return null;
}

function mapPhase(raw: string | null): ProgramFixture["trials"][0]["phase"] {
  if (!raw) return "unknown";
  const u = raw.toUpperCase();
  if (u.includes("PHASE3") || u === "III" || u.includes("PHASE 3")) return "III";
  if (u.includes("PHASE2") || u === "II") return "II";
  if (u.includes("PHASE1") || u === "I") return "I";
  if (u.includes("PHASE4") || u === "IV") return "IV";
  if (u.includes("2") && u.includes("3")) return "II/III";
  if (u.includes("1") && u.includes("2")) return "I/II";
  return "other";
}

function mapStatus(raw: string | null): ProgramFixture["trials"][0]["status"] {
  if (!raw) return "unknown";
  const u = raw.toUpperCase().replace(/\s+/g, "_");
  if (u.includes("NOT_YET_RECRUITING") || u.includes("PLANNED")) return "planned";
  if (u.includes("ACTIVE_NOT_RECRUITING") || u === "ACTIVE") return "active";
  if (u.includes("RECRUITING") || u.includes("ENROLLING")) return "recruiting";
  if (u.includes("AVAILABLE")) return "active";
  if (u.includes("COMPLETED")) return "completed";
  if (u.includes("TERMINATED")) return "terminated";
  if (u.includes("WITHDRAWN")) return "withdrawn";
  return "unknown";
}

function mapMasking(raw: string | null): ProgramFixture["trials"][0]["masking"] {
  if (!raw) return "unknown";
  const u = raw.toUpperCase();
  if (u.includes("QUAD")) return "quadruple";
  if (u.includes("TRIPLE")) return "triple";
  if (u.includes("DOUBLE")) return "double";
  if (u.includes("SINGLE")) return "single";
  if (u.includes("NONE") || u.includes("OPEN")) return "open";
  return "unknown";
}

function mapAllocation(raw: string | null): ProgramFixture["trials"][0]["allocation"] {
  if (!raw) return "unknown";
  const u = raw.toUpperCase();
  if (u.includes("NON")) return "non_randomized";
  if (u.includes("RANDOM")) return "randomized";
  return "unknown";
}

function provenance(params: {
  sourceUrl: string;
  sourceSystem: string;
  retrievedAt: string;
  firstPublicAt: string | null;
  passage: string | null;
  locator: string | null;
}): TemporalProvenance {
  return {
    sourceUrl: params.sourceUrl,
    sourceSystem: params.sourceSystem,
    retrievedAt: params.retrievedAt,
    firstPublicAt: params.firstPublicAt,
    effectiveAt: params.firstPublicAt,
    versionId: "v1",
    checksum: checksum(`${params.sourceUrl}|${params.firstPublicAt}|${params.passage ?? ""}`),
    exactPassage: params.passage,
    locator: params.locator,
    accessClass: "open",
  };
}

export type BuildEnrichedProgramInput = {
  seed: EnrichSeedProgram;
  study: CtStudySummary;
  fda?: FdaApplicationSummary | null;
  competitors?: OtKnownDrug[];
  /** Approval dates from Orange Book and/or retrospective KG. */
  competitorApprovals?: Record<string, CompetitorApprovalHit>;
  retrievedAt?: string;
};

export function buildEnrichedProgramFixture(input: BuildEnrichedProgramInput): ProgramFixture {
  const { seed: seedIn, study } = input;
  const retrievedAt = input.retrievedAt ?? new Date().toISOString();
  const seed: EnrichSeedProgram = {
    ...seedIn,
    applicationNumber: seedIn.applicationNumber ?? input.fda?.applicationNumber ?? null,
  };
  const slug = seed.slug;
  const drugId = slugId("drug", slug);
  const sponsorId = slugId("sponsor", slug);
  const indicationId = slugId("ind", slug);
  const programId = slugId("prog", slug);
  const mechId = slugId("mech", slug);
  const trialId = slugId("trial", study.nctId.toLowerCase());
  const epId = slugId("ep", `${slug}_primary`);
  const appId = seed.applicationNumber ? slugId("app", seed.applicationNumber.toLowerCase()) : null;

  const ctUrl = `https://clinicaltrials.gov/study/${study.nctId}`;
  const trialStart = toIsoDate(study.startDate);
  const trialRegistered = toIsoDate(study.registeredAt);
  const trialPrimaryCompletion = toIsoDate(study.primaryCompletionDate);
  const trialCompletion = toIsoDate(study.completionDate);
  const resultPublicAt = seed.primaryResultPublicAt;
  const primaryMeasure = study.primaryOutcomes[0]?.measure ?? "Primary endpoint";

  const plannedEnrollment =
    study.enrollmentType?.toUpperCase() === "ESTIMATED" ? study.enrollmentCount : study.enrollmentCount;
  const actualEnrollment =
    study.enrollmentType?.toUpperCase() === "ACTUAL" ? study.enrollmentCount : study.enrollmentCount;

  // Prefer curated fallbackCompetitors (live seed) when present; append OT names.
  const competitorSource = (() => {
    const fallback = seed.fallbackCompetitors ?? [];
    const otNames = (input.competitors ?? []).map((c) => c.drugName);
    if (fallback.length) {
      const extras = otNames.filter(
        (n) => !fallback.some((f) => f.toLowerCase() === n.toLowerCase()),
      );
      return [...fallback, ...extras].slice(0, 12);
    }
    return otNames.slice(0, 10);
  })();

  const approvedTherapies = competitorSource.map((name, i) => {
    const id = slugId("comp", `${slug}_${i}_${name}`);
    const approval = input.competitorApprovals?.[name];
    const approvedAt = approval ? toIsoDate(approval.approvedAt) : null;
    return {
      id,
      indicationId,
      drugAssetId: slugId("drug", `comp_${name}`),
      drugName: name,
      approvedAt,
      provenance: approval
        ? provenance({
            sourceUrl: approval.sourceUrl,
            sourceSystem: approval.sourceSystem,
            retrievedAt,
            firstPublicAt: approvedAt ?? "1990-01-01T00:00:00.000Z",
            passage:
              approval.sourceSystem === "fda.orange_book_local"
                ? `Orange Book: ${approval.productLabel} (appl ${approval.applicationNumber ?? "?"}) approval ${approval.approvedAt}`
                : approval.sourceSystem === "enrichment_override"
                  ? `Curated override: ${approval.productLabel} approved ${approval.approvedAt}`
                  : `Retrospective KG: ${approval.productLabel} approved ${approval.approvedAt}`,
            locator:
              approval.sourceSystem === "fda.orange_book_local"
                ? `orangebook#${approval.applicationNumber ?? "unknown"}`
                : approval.sourceSystem === "enrichment_override"
                  ? `override#${approval.applicationNumber ?? approval.productLabel}`
                  : `retrospective#${approval.fixturePath ?? approval.productLabel}`,
          })
        : provenance({
            sourceUrl: seed.diseaseOntologyId
              ? `https://platform.opentargets.org/disease/${seed.diseaseOntologyId}`
              : ctUrl,
            sourceSystem: input.competitors?.length ? "opentargets" : "enrichment_seed",
            retrievedAt,
            firstPublicAt: trialStart ?? "2020-01-01T00:00:00.000Z",
            passage: `Approved / clinical candidate in indication: ${name}`,
            locator: "competition",
          }),
    };
  });

  const designations = seed.designations.map((d, i) => ({
    id: slugId("des", `${slug}_${d.designationType}_${i}`),
    programId,
    applicationId: appId,
    designationType: d.designationType,
    grantedAt: d.grantedAt,
    provenance: provenance({
      sourceUrl: d.sourceUrl,
      sourceSystem: "web_press",
      retrievedAt,
      firstPublicAt: d.grantedAt,
      passage: `${d.designationType} designation for ${seed.preferredName}`,
      locator: `designation#${d.designationType}`,
    }),
  }));

  const trialResults =
    seed.primaryEndpointMet == null || !resultPublicAt
      ? []
      : [
          {
            id: slugId("result", `${slug}_primary`),
            trialId,
            endpointId: epId,
            primaryEndpointMet: seed.primaryEndpointMet,
            effectEstimate: null as number | null,
            confidenceInterval: null as [number, number] | null,
            pValue: null as number | null,
            provenance: provenance({
              sourceUrl: seed.primaryResultSourceUrl ?? ctUrl,
              sourceSystem: seed.primaryResultSourceUrl ? "web_press" : "clinicaltrials.gov",
              retrievedAt,
              firstPublicAt: resultPublicAt,
              passage: seed.primaryResultPassage,
              locator: "results#primary",
            }),
          },
        ];

  const clock = seed.regulatoryClock;
  const clockPublicAt = clock?.clockFirstPublicAt ?? clock?.acceptedAt ?? clock?.expectedFilingAt ?? null;
  const clockProvenance =
    clock && clockPublicAt
      ? provenance({
          sourceUrl: clock.clockSourceUrl ?? seed.primaryResultSourceUrl ?? ctUrl,
          sourceSystem: "web_press",
          retrievedAt,
          firstPublicAt: clockPublicAt,
          passage:
            clock.clockPassage ??
            `Regulatory clock facts for ${seed.preferredName} (acceptance / filing guidance / PDUFA).`,
          locator: "regulatory#clock",
        })
      : null;

  const hasClockDates =
    clock &&
    (clock.filedAt || clock.acceptedAt || clock.pdufaDate || clock.expectedFilingAt);
  const planningOnly =
    hasClockDates &&
    !clock!.filedAt &&
    !clock!.acceptedAt &&
    !seed.applicationNumber &&
    Boolean(clock!.expectedFilingAt);

  const applicationTypeResolved: EnrichSeedProgram["applicationType"] | "BLA" =
    seed.applicationType !== "unknown"
      ? seed.applicationType
      : planningOnly
        ? "BLA"
        : "unknown";

  const application =
    appId && seed.applicationNumber
      ? {
          id: appId,
          programId,
          applicationNumber: seed.applicationNumber,
          applicationType: seed.applicationType,
          indicationId,
          filedAt: toIsoDate(clock?.filedAt ?? null),
          acceptedAt: toIsoDate(clock?.acceptedAt ?? null),
          pdufaDate: toIsoDate(clock?.pdufaDate ?? null),
          expectedFilingAt: toIsoDate(clock?.expectedFilingAt ?? null),
          reviewProgram: clock?.reviewProgram ?? "unknown",
          clockProvenance,
        }
      : seed.applicationType !== "unknown" || hasClockDates
        ? {
            id: slugId("app", `${slug}_${planningOnly ? "planned" : "pending"}`),
            programId,
            applicationNumber: seed.applicationNumber,
            applicationType: applicationTypeResolved,
            indicationId,
            filedAt: toIsoDate(clock?.filedAt ?? null),
            acceptedAt: toIsoDate(clock?.acceptedAt ?? null),
            pdufaDate: toIsoDate(clock?.pdufaDate ?? null),
            expectedFilingAt: toIsoDate(clock?.expectedFilingAt ?? null),
            reviewProgram: clock?.reviewProgram ?? "unknown",
            clockProvenance,
          }
        : null;

  const actionDateIso =
    toIsoDate(input.fda?.approvalDate) ??
    toIsoDate(seed.regulatoryActionDate ?? null);
  const actionType =
    seed.regulatoryActionType ??
    (seed.programStatus === "approved"
      ? "approval"
      : seed.programStatus === "crl"
        ? "crl"
        : seed.programStatus === "discontinued"
          ? "withdrawal"
          : null);

  // Resolved regulatory action when date+type known (FDA fetch or curated retrospective).
  const regulatoryAction =
    actionDateIso && (actionType === "approval" || actionType === "crl" || actionType === "withdrawal")
      ? {
          id: slugId("action", `${slug}_${actionType}`),
          applicationId: application?.id ?? slugId("app", slug),
          actionType,
          actionDate: actionDateIso,
          provenance: provenance({
            sourceUrl: input.fda?.applicationNumber
              ? `https://api.fda.gov/drug/drugsfda.json?search=application_number:"${input.fda.applicationNumber}"`
              : seed.primaryResultSourceUrl ?? `https://clinicaltrials.gov/study/${seed.nctId}`,
            sourceSystem: input.fda?.approvalDate ? "openfda.drugsfda" : "curated_retrospective",
            retrievedAt,
            firstPublicAt: actionDateIso,
            passage:
              actionType === "approval"
                ? `FDA approval date ${actionDateIso} for ${seed.preferredName}`
                : actionType === "crl"
                  ? `Complete response / non-approval disclosure ${actionDateIso} for ${seed.preferredName}`
                  : `Program discontinuation disclosure ${actionDateIso} for ${seed.preferredName}`,
            locator: actionType === "approval" ? "submission#ORIG" : `action#${actionType}`,
          }),
        }
      : null;

  const documents: ProgramFixture["documents"] = [
    {
      id: slugId("doc", `${slug}_ct`),
      title: study.title || `${seed.preferredName} CT.gov`,
      documentType: "protocol",
      provenance: provenance({
        sourceUrl: ctUrl,
        sourceSystem: "clinicaltrials.gov",
        retrievedAt,
        firstPublicAt: trialStart,
        passage: study.title,
        locator: study.nctId,
      }),
    },
  ];
  if (seed.primaryResultSourceUrl && resultPublicAt) {
    documents.push({
      id: slugId("doc", `${slug}_result_press`),
      title: `${seed.preferredName} primary result disclosure`,
      documentType: "press_release",
      provenance: provenance({
        sourceUrl: seed.primaryResultSourceUrl,
        sourceSystem: "web_press",
        retrievedAt,
        firstPublicAt: resultPublicAt,
        passage: seed.primaryResultPassage,
        locator: "press",
      }),
    });
  }
  if (clockProvenance && clock?.clockSourceUrl) {
    documents.push({
      id: slugId("doc", `${slug}_reg_clock`),
      title: `${seed.preferredName} regulatory clock disclosure`,
      documentType: "press_release",
      provenance: clockProvenance,
    });
  }

  const fixture: ProgramFixture = {
    kind: "clinical_program",
    drugAsset: {
      id: drugId,
      preferredName: seed.preferredName,
      modality: seed.modality,
      mechanismIds: [mechId],
    },
    sponsor: {
      id: sponsorId,
      name: study.sponsor ?? seed.sponsorName,
      cik: null,
    },
    indication: {
      id: indicationId,
      name: seed.indicationName,
      therapeuticArea: seed.therapeuticArea,
      efoId: seed.diseaseOntologyId,
    },
    program: {
      id: programId,
      drugAssetId: drugId,
      indicationId,
      sponsorId,
      name: `${seed.preferredName} — ${seed.indicationName}`,
      status: seed.programStatus,
    },
    mechanisms: [
      {
        id: mechId,
        name: seed.mechanismName,
        target: seed.mechanismTarget,
        firstInClass: seed.firstInClass,
      },
    ],
    trials: [
      {
        id: trialId,
        nctId: study.nctId,
        programId,
        phase: mapPhase(study.phase),
        title: study.title || `${seed.preferredName} pivotal`,
        status: mapStatus(study.status),
        terminationReason: null,
        plannedEnrollment,
        actualEnrollment,
        masking: mapMasking(study.masking),
        allocation: mapAllocation(study.allocation),
        biomarkerEnriched: seed.biomarkerEnriched,
        registeredAt: trialRegistered,
        studyStartAt: trialStart,
        primaryCompletionAt: trialPrimaryCompletion,
        completionAt: trialCompletion,
      },
    ],
    endpoints: [
      {
        id: epId,
        trialId,
        name: primaryMeasure,
        endpointFamily: seed.primaryEndpointFamily,
        isPrimary: true,
      },
    ],
    trialResults,
    application,
    regulatoryAction,
    designations,
    approvedTherapiesInIndication: approvedTherapies,
    priorApprovals: [],
    documents,
  };

  return ProgramFixtureSchema.parse(fixture);
}

/**
 * Offline retrospective builder: uses seed.trialOps when CT.gov study is absent.
 * Always stamps regulatoryAction from curated action date/type for resolved programs.
 */
export function buildRetrospectiveProgramFixture(input: {
  seed: EnrichSeedProgram;
  study?: CtStudySummary | null;
  retrievedAt?: string;
  /** Curated + openFDA regulatory clock merged into application fields */
  regulatoryClock?: EnrichSeedProgram["regulatoryClock"];
}): ProgramFixture {
  const { seed } = input;
  const seedWithClock: EnrichSeedProgram =
    input.regulatoryClock != null
      ? { ...seed, regulatoryClock: input.regulatoryClock }
      : seed;
  const ops = seed.trialOps;
  if (!input.study && !ops) {
    throw new Error(`retrospective seed ${seed.slug} needs trialOps or a CT.gov study`);
  }
  if (!seed.regulatoryActionDate && seed.programStatus !== "active") {
    // Phase-fail path may use result disclosure as the decision anchor via holdout helper.
  }

  const study: CtStudySummary = input.study ?? {
    nctId: seed.nctId,
    title: ops!.title,
    status: ops!.status,
    phase: ops!.phase,
    conditions: [seed.indicationName],
    interventions: [seed.preferredName],
    sponsor: seed.sponsorName,
    startDate: seed.primaryResultPublicAt?.slice(0, 10) ?? null,
    primaryCompletionDate: seed.regulatoryActionDate?.slice(0, 10) ?? null,
    completionDate: seed.regulatoryActionDate?.slice(0, 10) ?? null,
    registeredAt: seed.primaryResultPublicAt?.slice(0, 10) ?? null,
    hasResults: seed.primaryEndpointMet != null,
    enrollmentCount: ops!.actualEnrollment ?? ops!.plannedEnrollment,
    enrollmentType: ops!.actualEnrollment != null ? "ACTUAL" : "ESTIMATED",
    allocation: ops!.allocation,
    masking: ops!.masking,
    primaryOutcomes: [
      {
        measure: seed.primaryEndpointFamily === "unknown" ? "Primary endpoint" : seed.primaryEndpointFamily,
        description: seed.primaryResultPassage,
        timeFrame: null,
      },
    ],
    raw: {
      protocolSection: {
        identificationModule: { nctId: seed.nctId },
        statusModule: { overallStatus: ops!.status },
        designModule: { phases: [ops!.phase] },
      },
      _pivotaledge: { curatedRetrospective: true, slug: seed.slug },
    },
  };

  // Prefer curated action dates for retrospective (do not require openFDA).
  const seedWithAction: EnrichSeedProgram = {
    ...seedWithClock,
    regulatoryActionDate: seedWithClock.regulatoryActionDate ?? null,
    regulatoryActionType:
      seedWithClock.regulatoryActionType ??
      (seedWithClock.programStatus === "approved"
        ? "approval"
        : seedWithClock.programStatus === "crl"
          ? "crl"
          : seedWithClock.programStatus === "discontinued"
            ? "withdrawal"
            : null),
  };

  return buildEnrichedProgramFixture({
    seed: seedWithAction,
    study,
    fda: null,
    competitors: [],
    retrievedAt: input.retrievedAt,
  });
}

