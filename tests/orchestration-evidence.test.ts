import { describe, expect, it } from "vitest";

import { EvidenceRecordSchema } from "@pivotaledge/schemas";
import { dedupeEvidenceRecords, validateEvidenceRecords } from "@pivotaledge/orchestration";

const cutoff = "2024-06-01T00:00:00.000Z";

function makeRecord(overrides: Partial<ReturnType<typeof EvidenceRecordSchema.parse>> = {}) {
  return EvidenceRecordSchema.parse({
    id: "ev_1",
    subjectId: "prog_1",
    predicate: "primary_endpoint_met",
    objectValue: true,
    evidenceType: "clinical",
    sourceType: "clinicaltrials.gov",
    sourceUrl: "https://clinicaltrials.gov/study/NCT00000000",
    sourceId: "NCT00000000",
    firstPublicAt: "2024-05-01T00:00:00.000Z",
    retrievedAt: "2024-05-15T00:00:00.000Z",
    forecastCutoff: cutoff,
    supportDirection: "supports",
    evidenceStrength: 0.8,
    extractionConfidence: 0.9,
    exactPassage: "Primary endpoint met.",
    locator: "resultsSection",
    extractorVersion: "test/1",
    checksum: "abc123",
    ...overrides,
  });
}

describe("orchestration: evidence modules (pure)", () => {
  it("rejects post-cutoff and missing firstPublicAt records", () => {
    const result = validateEvidenceRecords(
      [
        makeRecord(),
        makeRecord({ id: "ev_late", firstPublicAt: "2025-01-01T00:00:00.000Z" }),
        makeRecord({ id: "ev_unknown", firstPublicAt: null }),
        makeRecord({ id: "ev_low_conf", extractionConfidence: 0.2 }),
      ],
      cutoff,
    );

    expect(result.accepted).toHaveLength(1);
    expect(result.accepted[0]?.id).toBe("ev_1");
    expect(result.rejected.map((r) => r.reason)).toEqual(
      expect.arrayContaining(["post_cutoff_leakage", "missing_first_public_at", "low_extraction_confidence"]),
    );
  });

  it("dedupes by checksum+predicate+subject", () => {
    const a = makeRecord({ id: "ev_a" });
    const b = makeRecord({ id: "ev_b", checksum: "def456" });
    const { novel, duplicates } = dedupeEvidenceRecords([a, b], [a]);

    expect(novel).toHaveLength(1);
    expect(novel[0]?.id).toBe("ev_b");
    expect(duplicates).toHaveLength(1);
    expect(duplicates[0]?.id).toBe("ev_a");
  });
});
