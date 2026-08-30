import type {
  Forecast,
  MarketQuestion,
  ModelInformationGap,
  PrecedentBundle,
} from "@pivotaledge/schemas";

import {
  contractRequirementsFor,
  contractRequirementGroupsFor,
  KG_GAP_TO_FIELD,
} from "./contract-matrix.js";

type ProgramFields = {
  primaryEndpointMet: boolean | null | undefined;
  filedAt: string | null | undefined;
  acceptedAt: string | null | undefined;
  pdufaDate: string | null | undefined;
  expectedFilingAt: string | null | undefined;
  applicationFiled: boolean | undefined;
  applicationAccepted: boolean | undefined;
};

function readProgramFields(bundle: PrecedentBundle): ProgramFields {
  const cp = bundle.currentProgram;
  return {
    primaryEndpointMet: cp?.primaryEndpointMet,
    filedAt: cp?.filedAt ?? null,
    acceptedAt: cp?.acceptedAt ?? null,
    pdufaDate: cp?.pdufaDate ?? null,
    expectedFilingAt: cp?.expectedFilingAt ?? null,
    applicationFiled: cp?.applicationFiled,
    applicationAccepted: cp?.applicationAccepted,
  };
}

function fieldValue(fields: ProgramFields, field: string): unknown {
  if (field in fields) return fields[field as keyof ProgramFields];
  return null;
}

function isFieldMissing(fields: ProgramFields, field: string): boolean {
  const value = fieldValue(fields, field);
  if (value === null || value === undefined) return true;
  if (typeof value === "boolean") return false;
  if (typeof value === "string") return value.length === 0;
  return false;
}

function gapFromRequirement(
  req: { field: string; weight: number; researchQuestion: string; sourcePriority: string[] },
  fields: ProgramFields,
  kgMissing: Set<string>,
): ModelInformationGap | null {
  const missing = isFieldMissing(fields, req.field);
  const kgKey = Object.entries(KG_GAP_TO_FIELD).find(([, f]) => f === req.field)?.[0];
  const kgSignalsMissing = kgKey ? kgMissing.has(kgKey) : false;
  if (!missing && !kgSignalsMissing) return null;

  const importance = req.weight;
  const uncertainty = missing ? 1 : 0.5;

  return {
    featureName: req.field,
    currentValue: fieldValue(fields, req.field),
    missing,
    featureImportance: importance,
    localSensitivity: null,
    uncertainty,
    potentiallyDecisionChanging: importance >= 0.8,
    researchQuestion: req.researchQuestion,
    sourcePriority: req.sourcePriority,
  };
}

/** Pure, testable gap evaluation — no I/O. */
export function evaluateInformationGaps(
  marketQuestion: MarketQuestion,
  bundle: PrecedentBundle,
  _forecast: Forecast,
): ModelInformationGap[] {
  const fields = readProgramFields(bundle);
  const kgMissing = new Set(bundle.missingHighValueEvidence);
  const requirements = contractRequirementsFor(marketQuestion.eventType);

  const gaps: ModelInformationGap[] = [];
  for (const req of requirements) {
    const gap = gapFromRequirement(req, fields, kgMissing);
    if (gap) gaps.push(gap);
  }

  for (const group of contractRequirementGroupsFor(marketQuestion.eventType)) {
    const satisfied = group.fields.some((field) => !isFieldMissing(fields, field));
    if (!satisfied) {
      gaps.push({
        featureName: group.id,
        currentValue: null,
        missing: true,
        featureImportance: group.blocksCalibration ? 0.95 : 0.75,
        localSensitivity: null,
        uncertainty: 1,
        potentiallyDecisionChanging: group.blocksCalibration,
        researchQuestion: `Resolve: ${group.label}`,
        sourcePriority: ["openfda", "company_ir", "fda"],
      });
    }
  }

  for (const kgKey of bundle.missingHighValueEvidence) {
    const field = KG_GAP_TO_FIELD[kgKey];
    if (!field) continue;
    if (gaps.some((g) => g.featureName === field)) continue;
    gaps.push({
      featureName: field,
      currentValue: fieldValue(fields, field),
      missing: true,
      featureImportance: 0.7,
      localSensitivity: null,
      uncertainty: 1,
      potentiallyDecisionChanging: true,
      researchQuestion: `Resolve missing KG signal: ${kgKey}`,
      sourcePriority: ["clinicaltrials.gov", "openfda"],
    });
  }

  return gaps.sort((a, b) => b.featureImportance - a.featureImportance);
}

export function topGapScore(gaps: ModelInformationGap[]): number {
  if (!gaps.length) return 0;
  return Math.max(
    ...gaps.map((g) => g.featureImportance * (g.uncertainty ?? 1)),
  );
}
