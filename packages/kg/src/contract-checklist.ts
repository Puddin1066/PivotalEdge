import type {
  ContractCoverage,
  ContractEvidenceAssessment,
  MarketEventType,
  MarketQuestion,
  PrecedentBundle,
} from "@pivotaledge/schemas";
import { ContractEvidenceAssessmentSchema } from "@pivotaledge/schemas";

import { defaultPeToFilingLagDays } from "./pe-filing-priors.js";

export type ContractRequirement = {
  field: string;
  weight: number;
  researchQuestion: string;
  sourcePriority: string[];
};

/** Any-of group — e.g. acceptance OR filing guidance OR PDUFA for approval-by-date. */
export type ContractRequirementGroup = {
  id: string;
  label: string;
  fields: string[];
  /** When true, missing entire group blocks calibrated edge. */
  blocksCalibration: boolean;
};

export type EventContractSpec = {
  requiredFields: ContractRequirement[];
  requiredGroups: ContractRequirementGroup[];
};

type ProgramFields = {
  primaryEndpointMet: boolean | null | undefined;
  filedAt: string | null | undefined;
  acceptedAt: string | null | undefined;
  pdufaDate: string | null | undefined;
  expectedFilingAt: string | null | undefined;
  applicationFiled: boolean | undefined;
  applicationAccepted: boolean | undefined;
  adcomDate: string | null | undefined;
  linkedTrialCount: number;
  applicationNumber: string | null | undefined;
  actionDate: string | null | undefined;
  programStatus: string | undefined;
  primaryResultPublicAt: string | null | undefined;
  peToFilingLagPriorDays: number | null;
};

/** Contract-aware required fields — mirrors docs/ENRICHMENT_PRIORITY.md §0. */
export const CONTRACT_REQUIREMENTS: Record<MarketEventType, ContractRequirement[]> = {
  NDA_BLA_SUBMISSION: [
    {
      field: "primaryEndpointMet",
      weight: 0.85,
      researchQuestion: "Was the timed primary endpoint result public before the forecast cutoff?",
      sourcePriority: ["publication", "clinicaltrials.gov"],
    },
    {
      field: "expectedFilingAt",
      weight: 0.95,
      researchQuestion:
        "Is there public filing guidance or an expected submission date before the forecast cutoff?",
      sourcePriority: ["sec_filing", "company_ir", "clinicaltrials.gov"],
    },
    {
      field: "linkedTrialIds",
      weight: 0.8,
      researchQuestion: "Is at least one linked pivotal trial (NCT) identified for this market?",
      sourcePriority: ["clinicaltrials.gov"],
    },
  ],
  FILING_ACCEPTANCE: [
    {
      field: "filedAt",
      weight: 0.95,
      researchQuestion: "Was the NDA/BLA filed before the forecast cutoff?",
      sourcePriority: ["openfda", "sec_filing"],
    },
    {
      field: "applicationNumber",
      weight: 0.85,
      researchQuestion: "Is the FDA application number known?",
      sourcePriority: ["openfda", "fda"],
    },
  ],
  FDA_APPROVAL: [
    {
      field: "primaryEndpointMet",
      weight: 0.8,
      researchQuestion: "Was pivotal trial efficacy established and public before the cutoff?",
      sourcePriority: ["publication", "clinicaltrials.gov"],
    },
  ],
  FDA_APPROVAL_BY_DATE: [
    {
      field: "primaryEndpointMet",
      weight: 0.8,
      researchQuestion: "Was pivotal trial efficacy established and public before the cutoff?",
      sourcePriority: ["publication", "clinicaltrials.gov"],
    },
  ],
  TRIAL_PRIMARY_ENDPOINT: [
    {
      field: "primaryEndpointMet",
      weight: 0.95,
      researchQuestion: "Was the primary endpoint result public before the cutoff?",
      sourcePriority: ["publication", "clinicaltrials.gov"],
    },
    {
      field: "linkedTrialIds",
      weight: 0.85,
      researchQuestion: "Is the linked pivotal trial identified?",
      sourcePriority: ["clinicaltrials.gov"],
    },
  ],
  TRIAL_POSITIVE_TOPLINE: [
    {
      field: "primaryEndpointMet",
      weight: 0.95,
      researchQuestion: "Was topline efficacy disclosed before the cutoff?",
      sourcePriority: ["company_ir", "clinicaltrials.gov"],
    },
    {
      field: "linkedTrialIds",
      weight: 0.85,
      researchQuestion: "Is the linked pivotal trial identified?",
      sourcePriority: ["clinicaltrials.gov"],
    },
  ],
  ADVISORY_COMMITTEE_VOTE: [
    {
      field: "adcomDate",
      weight: 0.95,
      researchQuestion: "Was an advisory committee meeting scheduled before the cutoff?",
      sourcePriority: ["fda", "company_ir"],
    },
  ],
};

export const CONTRACT_REQUIREMENT_GROUPS: Record<MarketEventType, ContractRequirementGroup[]> = {
  NDA_BLA_SUBMISSION: [],
  FILING_ACCEPTANCE: [],
  FDA_APPROVAL: [
    {
      id: "review_clock",
      label: "Acceptance, filing guidance, or PDUFA/CNPV date",
      fields: ["acceptedAt", "expectedFilingAt", "pdufaDate"],
      blocksCalibration: true,
    },
  ],
  FDA_APPROVAL_BY_DATE: [
    {
      id: "review_clock",
      label: "Acceptance, filing guidance, or PDUFA/CNPV date",
      fields: ["acceptedAt", "expectedFilingAt", "pdufaDate"],
      blocksCalibration: true,
    },
  ],
  TRIAL_PRIMARY_ENDPOINT: [],
  TRIAL_POSITIVE_TOPLINE: [],
  ADVISORY_COMMITTEE_VOTE: [],
};

/** Maps KG missingHighValueEvidence keys to contract fields. */
export const KG_GAP_TO_FIELD: Record<string, string> = {
  regulatory_application: "filedAt",
  regulatory_acceptance_or_filing_guidance: "acceptedAt",
  pdufa_or_target_action_date: "pdufaDate",
  trial_results: "primaryEndpointMet",
};

export function contractRequirementsFor(eventType: MarketEventType): ContractRequirement[] {
  return CONTRACT_REQUIREMENTS[eventType] ?? [];
}

export function contractRequirementGroupsFor(
  eventType: MarketEventType,
): ContractRequirementGroup[] {
  return CONTRACT_REQUIREMENT_GROUPS[eventType] ?? [];
}

function peToFilingLagPriorFromBundle(bundle: PrecedentBundle): number {
  const cohort = bundle.cohorts.find((c) => c.peToFilingLagDaysMedian != null);
  if (cohort?.peToFilingLagDaysMedian != null) return cohort.peToFilingLagDaysMedian;
  return defaultPeToFilingLagDays(bundle.currentProgram?.therapeuticArea ?? null, "III");
}

function reviewClockInferred(fields: ProgramFields): boolean {
  if (fields.acceptedAt || fields.expectedFilingAt || fields.pdufaDate) return false;
  if (fields.applicationAccepted) return false;
  return (
    fields.primaryEndpointMet === true &&
    fields.primaryResultPublicAt != null &&
    fields.peToFilingLagPriorDays != null &&
    fields.peToFilingLagPriorDays > 0
  );
}

function readProgramFields(
  bundle: PrecedentBundle,
  marketQuestion: MarketQuestion,
): ProgramFields {
  const cp = bundle.currentProgram;
  return {
    primaryEndpointMet: cp?.primaryEndpointMet,
    filedAt: cp?.filedAt ?? null,
    acceptedAt: cp?.acceptedAt ?? null,
    pdufaDate: cp?.pdufaDate ?? null,
    expectedFilingAt: cp?.expectedFilingAt ?? null,
    applicationFiled: cp?.applicationFiled,
    applicationAccepted: cp?.applicationAccepted,
    adcomDate: null,
    linkedTrialCount: marketQuestion.linkedTrialIds.length,
    applicationNumber: cp?.applicationId ?? marketQuestion.applicationId ?? null,
    actionDate: cp?.actionDate ?? null,
    programStatus: cp?.status,
    primaryResultPublicAt: cp?.primaryResultPublicAt ?? null,
    peToFilingLagPriorDays: peToFilingLagPriorFromBundle(bundle),
  };
}

function fieldValue(fields: ProgramFields, field: string): unknown {
  if (field === "linkedTrialIds") return fields.linkedTrialCount;
  if (field in fields) return fields[field as keyof ProgramFields];
  return null;
}

function isFieldPresent(fields: ProgramFields, field: string): boolean {
  if (field === "linkedTrialIds") return fields.linkedTrialCount > 0;
  const value = fieldValue(fields, field);
  if (value === null || value === undefined) return false;
  if (typeof value === "boolean") return true;
  if (typeof value === "number") return value > 0;
  if (typeof value === "string") return value.length > 0;
  return false;
}

function groupSatisfied(fields: ProgramFields, group: ContractRequirementGroup): boolean {
  if (group.id === "review_clock") {
    if (group.fields.some((field) => isFieldPresent(fields, field))) return true;
    if (fields.applicationAccepted) return true;
    if (fields.actionDate) return true;
    if (fields.programStatus === "approved" || fields.programStatus === "crl") return true;
    return false;
  }
  return group.fields.some((field) => isFieldPresent(fields, field));
}

/**
 * Contract-aware evidence checklist for edge identification (ENRICHMENT_PRIORITY P0).
 * When `calibrationBlocked`, model P must not drive BET_* without enrichment.
 */
export function assessContractEvidence(
  marketQuestion: MarketQuestion,
  bundle: PrecedentBundle,
): ContractEvidenceAssessment {
  const fields = readProgramFields(bundle, marketQuestion);
  const requirements = contractRequirementsFor(marketQuestion.eventType);
  const groups = contractRequirementGroupsFor(marketQuestion.eventType);
  const kgMissing = new Set(bundle.missingHighValueEvidence);

  const requiredPresent: string[] = [];
  const requiredMissing: string[] = [];
  const notes: string[] = [];
  let reviewClockPartial = false;

  for (const req of requirements) {
    const present = isFieldPresent(fields, req.field);
    const kgKey = Object.entries(KG_GAP_TO_FIELD).find(([, f]) => f === req.field)?.[0];
    const kgSignalsMissing = kgKey ? kgMissing.has(kgKey) : false;

    if (present && !kgSignalsMissing) {
      requiredPresent.push(req.field);
    } else {
      requiredMissing.push(req.field);
    }
  }

  for (const group of groups) {
    if (group.id === "review_clock") {
      if (groupSatisfied(fields, group)) {
        requiredPresent.push(group.id);
      } else if (reviewClockInferred(fields)) {
        requiredMissing.push(group.id);
        requiredPresent.push("review_clock_inferred");
        reviewClockPartial = true;
        notes.push(
          `Sponsor review clock missing; timing model uses cohort PE→filing prior (${fields.peToFilingLagPriorDays}d from PE public ${fields.primaryResultPublicAt?.slice(0, 10)}). BET_YES remains blocked until acceptance, filing guidance, or PDUFA is public.`,
        );
      } else {
        requiredMissing.push(group.id);
        if (group.blocksCalibration) {
          notes.push(`Missing ${group.label} — do not treat model P as calibrated for this contract.`);
        }
      }
      continue;
    }

    if (groupSatisfied(fields, group)) {
      requiredPresent.push(group.id);
    } else {
      requiredMissing.push(group.id);
      if (group.blocksCalibration) {
        notes.push(`Missing ${group.label} — do not treat model P as calibrated for this contract.`);
      }
    }
  }

  const blockingGroupMissing = groups.some((g) => {
    if (!g.blocksCalibration) return false;
    if (g.id === "review_clock" && reviewClockPartial) return false;
    if (g.id === "review_clock" && groupSatisfied(fields, g)) return false;
    if (g.id === "review_clock") return true;
    return !groupSatisfied(fields, g);
  });
  const criticalFieldMissing = requirements.some(
    (r) => r.weight >= 0.9 && requiredMissing.includes(r.field),
  );

  let contractCoverage: ContractCoverage = "complete";
  if (blockingGroupMissing || criticalFieldMissing) {
    contractCoverage = "blocked";
  } else if (requiredMissing.length > 0) {
    contractCoverage = "partial";
  }

  const calibrationBlocked = contractCoverage === "blocked";

  if (marketQuestion.eventType === "NDA_BLA_SUBMISSION" && requiredMissing.includes("expectedFilingAt")) {
    notes.push(
      "No public filing guidance — submission P must stay filing-clock–dominated; do not invent expectedFilingAt.",
    );
  }

  return ContractEvidenceAssessmentSchema.parse({
    eventType: marketQuestion.eventType,
    requiredPresent,
    requiredMissing,
    contractCoverage,
    calibrationBlocked,
    notes,
  });
}
