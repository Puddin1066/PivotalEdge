import type { EvidenceRecord, PrecedentBundle, ProgramSnapshot } from "@pivotaledge/schemas";

/** Map validated evidence predicates onto program field overrides. */
export function overridesFromEvidence(records: EvidenceRecord[]): Record<string, unknown> {
  const overrides: Record<string, unknown> = {};
  for (const record of records) {
    overrides[record.predicate] = record.objectValue;
  }
  return overrides;
}

function recomputeMissingHighValue(cp: ProgramSnapshot): string[] {
  const missing: string[] = [];
  if (!cp.applicationFiled && !cp.applicationId) {
    missing.push("regulatory_application");
  }
  if (cp.applicationFiled && !cp.applicationAccepted && !cp.acceptedAt && !cp.expectedFilingAt) {
    missing.push("regulatory_acceptance_or_filing_guidance");
  }
  if ((cp.applicationAccepted || cp.acceptedAt) && !cp.pdufaDate && cp.reviewProgram !== "cnpv") {
    missing.push("pdufa_or_target_action_date");
  }
  if (cp.primaryEndpointMet == null) {
    missing.push("trial_results");
  }
  return missing;
}

/** Apply enrichment overrides to a precedent bundle (in-memory patch for rerun). */
export function applyFieldOverrides(
  bundle: PrecedentBundle,
  overrides: Record<string, unknown>,
): PrecedentBundle {
  if (!bundle.currentProgram || Object.keys(overrides).length === 0) {
    return bundle;
  }

  const cp: ProgramSnapshot = { ...bundle.currentProgram };

  for (const [field, value] of Object.entries(overrides)) {
    if (field === "acceptedAt" && typeof value === "string") {
      cp.acceptedAt = value;
      cp.applicationAccepted = true;
      cp.applicationFiled = true;
    } else if (field === "filedAt" && typeof value === "string") {
      cp.filedAt = value;
      cp.applicationFiled = true;
    } else if (field === "pdufaDate" && typeof value === "string") {
      cp.pdufaDate = value;
    } else if (field === "expectedFilingAt" && typeof value === "string") {
      cp.expectedFilingAt = value;
    } else if (field === "primaryEndpointMet") {
      cp.primaryEndpointMet = value as boolean | null;
    } else if (field in cp) {
      (cp as Record<string, unknown>)[field] = value;
    }
  }

  return {
    ...bundle,
    currentProgram: cp,
    missingHighValueEvidence: recomputeMissingHighValue(cp),
  };
}

export function changedFeatures(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): string[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changed: string[] = [];
  for (const key of keys) {
    if (before[key] !== after[key]) changed.push(key);
  }
  return changed;
}
