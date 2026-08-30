import { isAvailableAtCutoff } from "@pivotaledge/schemas";
import type {
  EvidenceRecord,
  EvidenceValidationResult,
} from "@pivotaledge/schemas";

/** Pure cutoff + schema validation — no side effects. */
export function validateEvidenceRecords(
  records: EvidenceRecord[],
  forecastCutoff: string,
): EvidenceValidationResult {
  const accepted: EvidenceRecord[] = [];
  const rejected: EvidenceValidationResult["rejected"] = [];

  for (const record of records) {
    if (record.forecastCutoff !== forecastCutoff) {
      rejected.push({
        recordId: record.id,
        reason: "forecast_cutoff_mismatch",
      });
      continue;
    }

    if (!isAvailableAtCutoff(record.firstPublicAt, forecastCutoff)) {
      rejected.push({
        recordId: record.id,
        reason: record.firstPublicAt === null ? "missing_first_public_at" : "post_cutoff_leakage",
      });
      continue;
    }

    if (record.extractionConfidence < 0.5) {
      rejected.push({ recordId: record.id, reason: "low_extraction_confidence" });
      continue;
    }

    accepted.push(record);
  }

  return { accepted, rejected };
}
