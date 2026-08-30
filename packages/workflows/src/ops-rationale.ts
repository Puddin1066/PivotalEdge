/**
 * Human-readable prediction rationale + cited evidence for Ops market views.
 * Rebuilds the bet recommendation from the frozen snapshot; resolves citations
 * from the clinical program fixture (sourced passages, not LLM prose).
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import {
  FrozenOpportunitySnapshotSchema,
  defaultFixturesRoot,
  loadProgramFixture,
  type ContractEvidenceAssessment,
  type ForecastComponent,
  type ProgramFixture,
} from "@pivotaledge/schemas";
import { assessContractEvidence } from "@pivotaledge/kg";
import { buildBetRecommendation } from "@pivotaledge/scoring";

import { loadLiveScoreReport, type LiveScoredOpportunity } from "./platform-dashboard.js";

export type ForecastComponentName = ForecastComponent["name"];

export type ComponentRationale = {
  id: string;
  name: ForecastComponentName;
  label: string;
  probability: number;
  explanation: string;
};

export type EvidenceCitation = {
  id: string;
  kind: "trial_result" | "designation" | "document" | "unknown";
  label: string;
  passage: string | null;
  sourceUrl: string | null;
  firstPublicAt: string | null;
  sourceSystem: string | null;
};

export type OpsMarketRationale = {
  polymarketId: string;
  slug: string;
  question: string;
  opportunity: LiveScoredOpportunity | null;
  action: string;
  thesis: string;
  counterargument: string;
  invalidators: string[];
  modelP: number;
  conservativeP: number;
  pNoConservative: number;
  yesBestAsk: number | null;
  noBestAsk: number | null;
  netEdge: number;
  components: ComponentRationale[];
  bindingComponent: ComponentRationale | null;
  bindingNote: string;
  citations: EvidenceCitation[];
  program: {
    drug: string;
    indication: string;
    therapeuticArea: string | null;
    phase: string | null;
    primaryEndpointMet: boolean | null;
    designations: string[];
    applicationType: string | null;
  } | null;
  eventDeadline: string | null;
  forecastCutoff: string | null;
  modelVersion: string | null;
  evidenceConfidence: string;
  resolutionRisk: string;
  fingerprint: string | null;
  eventType: string | null;
  contract: ContractEvidenceAssessment | null;
};

const COMPONENT_COPY: Record<
  ForecastComponentName,
  { label: string; explanation: string }
> = {
  clinical_adequacy: {
    label: "Clinical adequacy",
    explanation:
      "Whether the pivotal package looks adequate for approval (endpoint success, phase, enrichment).",
  },
  submission_by_T: {
    label: "Submission by deadline",
    explanation: "Chance an NDA/BLA is submitted in time for this market’s clock.",
  },
  acceptance_given_submission: {
    label: "Acceptance | submission",
    explanation: "Chance FDA files/accepts the application for review once submitted.",
  },
  approval_given_acceptance: {
    label: "Approval | acceptance",
    explanation: "Chance of approval given an accepted filing (base-rate + program features).",
  },
  decision_by_T: {
    label: "Decision by deadline",
    explanation:
      "Chance FDA issues a decision by the market end date from acceptance/PDUFA/CNPV review window and calculated milestone deltas — often the binding constraint for “this year” markets.",
  },
  other: {
    label: "Other",
    explanation: "Additional model factor for this event type.",
  },
};

function componentRationale(c: ForecastComponent): ComponentRationale {
  const copy = COMPONENT_COPY[c.name] ?? COMPONENT_COPY.other;
  return {
    id: c.id,
    name: c.name,
    label: copy.label,
    probability: c.probability,
    explanation: copy.explanation,
  };
}

function bindingNote(components: ComponentRationale[], eventDeadline: string | null): string {
  if (components.length === 0) {
    return "Component breakdown unavailable for this score.";
  }
  const sorted = [...components].sort((a, b) => a.probability - b.probability);
  const weakest = sorted[0]!;
  const decision = components.find((c) => c.name === "decision_by_T");
  const focus =
    decision && decision.probability <= weakest.probability + 0.05 ? decision : weakest;
  const deadlineBit = eventDeadline
    ? ` Market ends ${eventDeadline.slice(0, 10)}.`
    : "";
  return `Lowest / binding factor: ${focus.label} at ${(focus.probability * 100).toFixed(0)}%.${deadlineBit} Overall P(YES) is the product of these steps — a late clock can dominate even with strong clinical data.`;
}

function citationFromProvenance(
  id: string,
  kind: EvidenceCitation["kind"],
  label: string,
  provenance: {
    sourceUrl: string;
    exactPassage: string | null;
    firstPublicAt: string | null;
    sourceSystem: string;
  } | null,
): EvidenceCitation {
  return {
    id,
    kind,
    label,
    passage: provenance?.exactPassage ?? null,
    sourceUrl: provenance?.sourceUrl ?? null,
    firstPublicAt: provenance?.firstPublicAt ?? null,
    sourceSystem: provenance?.sourceSystem ?? null,
  };
}

function resolveCitations(
  evidenceIds: string[],
  fixture: ProgramFixture | null,
): EvidenceCitation[] {
  if (!fixture) {
    return evidenceIds.map((id) => ({
      id,
      kind: "unknown" as const,
      label: id,
      passage: null,
      sourceUrl: null,
      firstPublicAt: null,
      sourceSystem: null,
    }));
  }

  const byId = new Map<string, EvidenceCitation>();

  for (const r of fixture.trialResults) {
    byId.set(
      r.id,
      citationFromProvenance(
        r.id,
        "trial_result",
        `Primary endpoint ${r.primaryEndpointMet === true ? "met" : r.primaryEndpointMet === false ? "not met" : "unknown"}`,
        r.provenance,
      ),
    );
  }
  for (const d of fixture.designations) {
    byId.set(
      d.id,
      citationFromProvenance(
        d.id,
        "designation",
        `${d.designationType} designation`,
        d.provenance,
      ),
    );
  }
  for (const doc of fixture.documents) {
    byId.set(
      doc.id,
      citationFromProvenance(doc.id, "document", doc.title, doc.provenance),
    );
  }
  if (fixture.regulatoryAction) {
    byId.set(
      fixture.regulatoryAction.id,
      citationFromProvenance(
        fixture.regulatoryAction.id,
        "document",
        `Regulatory action: ${fixture.regulatoryAction.actionType}`,
        fixture.regulatoryAction.provenance,
      ),
    );
  }

  return evidenceIds.map(
    (id) =>
      byId.get(id) ?? {
        id,
        kind: "unknown" as const,
        label: id,
        passage: null,
        sourceUrl: null,
        firstPublicAt: null,
        sourceSystem: null,
      },
  );
}

async function loadFixtureForSlug(
  slug: string,
  fixturesRoot: string,
): Promise<ProgramFixture | null> {
  const candidates = [
    `corpus/live/${slug}.json`,
    `corpus/${slug}.json`,
    `corpus/retrospective/${slug}.json`,
  ];
  for (const rel of candidates) {
    try {
      return await loadProgramFixture(rel, fixturesRoot);
    } catch {
      /* try next */
    }
  }
  return null;
}

export async function loadOpsMarketRationale(
  polymarketId: string,
  fixturesRoot = defaultFixturesRoot(),
): Promise<OpsMarketRationale | null> {
  const live = await loadLiveScoreReport(fixturesRoot);
  const opportunity =
    live?.opportunities.find((o) => o.polymarketId === polymarketId) ?? null;

  let snapshotRaw: unknown = null;
  if (opportunity?.snapshot) {
    try {
      snapshotRaw = JSON.parse(
        await readFile(path.join(fixturesRoot, opportunity.snapshot), "utf8"),
      );
    } catch {
      snapshotRaw = null;
    }
  }
  if (!snapshotRaw) {
    try {
      const dir = path.join(fixturesRoot, "opportunities/live");
      const files = await readdir(dir);
      const hit = files.find((f) => f.includes(`-${polymarketId}.json`));
      if (hit) {
        snapshotRaw = JSON.parse(await readFile(path.join(dir, hit), "utf8"));
      }
    } catch {
      /* none */
    }
  }
  if (!snapshotRaw) return null;

  const snapshot = FrozenOpportunitySnapshotSchema.parse(snapshotRaw);
  const recommendation = buildBetRecommendation({
    marketQuestion: snapshot.marketQuestion,
    forecast: snapshot.forecast,
    yesOrderBook: snapshot.yesOrderBook,
    noOrderBook: snapshot.noOrderBook,
    precedentBundle: snapshot.precedentBundle,
    bankroll: snapshot.bankroll ?? 10_000,
    generatedAt: snapshot.frozenAt,
    policyConfig: snapshot.policyConfig,
  });

  const slug =
    opportunity?.slug ??
    snapshot.precedentBundle.currentProgram?.drugName
      ?.toLowerCase()
      .replace(/\s+/g, "-") ??
    "unknown";

  const fixture = await loadFixtureForSlug(opportunity?.slug ?? slug, fixturesRoot);

  const components = snapshot.forecast.components.map(componentRationale);
  const sorted = [...components].sort((a, b) => a.probability - b.probability);
  const bindingComponent = sorted[0] ?? null;
  const eventDeadline =
    snapshot.marketQuestion.eventDeadline ?? opportunity?.eventDeadline ?? null;

  const cp = snapshot.precedentBundle.currentProgram;

  const contract =
    opportunity?.contractCoverage != null
      ? {
          eventType: opportunity.eventType,
          requiredPresent: opportunity.requiredPresent ?? [],
          requiredMissing: opportunity.requiredMissing ?? [],
          contractCoverage: opportunity.contractCoverage ?? "partial",
          calibrationBlocked: opportunity.calibrationBlocked ?? false,
          notes: opportunity.contractNotes ?? [],
        }
      : assessContractEvidence(snapshot.marketQuestion, snapshot.precedentBundle);

  return {
    polymarketId,
    slug: opportunity?.slug ?? slug,
    question:
      opportunity?.question ??
      snapshot.marketQuestion.resolutionDefinition.slice(0, 120),
    opportunity,
    action: opportunity?.action ?? recommendation.action,
    thesis: opportunity?.thesis ?? recommendation.primaryThesis,
    counterargument: recommendation.strongestCounterargument,
    invalidators: recommendation.invalidators,
    modelP: opportunity?.modelP ?? snapshot.forecast.modelProbability,
    conservativeP:
      opportunity?.conservativeP ?? snapshot.forecast.conservativeProbability,
    pNoConservative:
      1 -
      (opportunity?.conservativeP ?? snapshot.forecast.conservativeProbability),
    yesBestAsk: opportunity?.yesBestAsk ?? snapshot.yesOrderBook.bestAsk,
    noBestAsk: opportunity?.noBestAsk ?? snapshot.noOrderBook?.bestAsk ?? null,
    netEdge: opportunity?.netEdge ?? recommendation.netEdge,
    components,
    bindingComponent,
    bindingNote: bindingNote(components, eventDeadline),
    citations: resolveCitations(snapshot.forecast.supportingEvidenceIds, fixture),
    program: fixture
      ? {
          drug: fixture.drugAsset.preferredName,
          indication: fixture.indication.name,
          therapeuticArea: fixture.indication.therapeuticArea,
          phase: fixture.trials[0]?.phase ?? null,
          primaryEndpointMet: fixture.trialResults[0]?.primaryEndpointMet ?? null,
          designations: fixture.designations.map((d) => d.designationType),
          applicationType: fixture.application?.applicationType ?? null,
        }
      : cp
        ? {
            drug: cp.drugName,
            indication: cp.indicationName,
            therapeuticArea: cp.therapeuticArea,
            phase: null,
            primaryEndpointMet: cp.primaryEndpointMet ?? null,
            designations: [...(cp.designationTypes ?? [])],
            applicationType: null,
          }
        : null,
    eventDeadline,
    forecastCutoff: snapshot.forecast.forecastCutoff,
    modelVersion: snapshot.forecast.modelVersion,
    evidenceConfidence: recommendation.evidenceConfidence,
    resolutionRisk: recommendation.resolutionRisk,
    fingerprint: opportunity?.fingerprint ?? null,
    eventType: snapshot.marketQuestion.eventType,
    contract,
  };
}
