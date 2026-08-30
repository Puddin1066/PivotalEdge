import type { EvidenceRecord } from "@pivotaledge/schemas";

/** Pure dedupe by source checksum + predicate. */
export function dedupeEvidenceRecords(
  incoming: EvidenceRecord[],
  existing: EvidenceRecord[] = [],
): { novel: EvidenceRecord[]; duplicates: EvidenceRecord[] } {
  const seen = new Set(
    existing.map((r) => `${r.checksum}:${r.predicate}:${r.subjectId}`),
  );
  const novel: EvidenceRecord[] = [];
  const duplicates: EvidenceRecord[] = [];

  for (const record of incoming) {
    const key = `${record.checksum}:${record.predicate}:${record.subjectId}`;
    if (seen.has(key)) {
      duplicates.push(record);
      continue;
    }
    seen.add(key);
    novel.push(record);
  }

  return { novel, duplicates };
}
