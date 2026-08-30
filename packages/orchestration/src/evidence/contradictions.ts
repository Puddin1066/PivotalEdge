import type { EvidenceRecord } from "@pivotaledge/schemas";

export type ContradictionResult = {
  novel: EvidenceRecord[];
  duplicates: EvidenceRecord[];
  contradictory: EvidenceRecord[];
  contradictoryIds: string[];
};

function assertionKey(record: EvidenceRecord): string {
  return `${record.subjectId}:${record.predicate}`;
}

/** Dedupe plus preserve contradictory assertions (same predicate, different value). */
export function dedupeWithContradictions(
  incoming: EvidenceRecord[],
  existing: EvidenceRecord[] = [],
): ContradictionResult {
  const byAssertion = new Map<string, EvidenceRecord>();
  for (const record of existing) {
    byAssertion.set(assertionKey(record), record);
  }

  const novel: EvidenceRecord[] = [];
  const duplicates: EvidenceRecord[] = [];
  const contradictory: EvidenceRecord[] = [];
  const contradictoryIds: string[] = [];

  for (const record of incoming) {
    const key = assertionKey(record);
    const prior = byAssertion.get(key);
    if (!prior) {
      byAssertion.set(key, record);
      novel.push(record);
      continue;
    }
    if (prior.checksum === record.checksum) {
      duplicates.push(record);
      continue;
    }
    if (prior.objectValue !== record.objectValue) {
      contradictory.push(record);
      contradictoryIds.push(record.id, prior.id);
      // Preserve both — do not overwrite prior
      continue;
    }
    duplicates.push(record);
  }

  return {
    novel,
    duplicates,
    contradictory,
    contradictoryIds: [...new Set(contradictoryIds)],
  };
}
