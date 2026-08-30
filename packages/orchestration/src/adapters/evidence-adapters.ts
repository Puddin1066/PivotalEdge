import type { EvidenceWriterPort } from "../ports/index.js";

/** In-memory evidence writer for tests — no filesystem side effects. */
export function createInMemoryEvidenceWriter(
  store: Map<string, string[]> = new Map(),
): EvidenceWriterPort {
  return {
    async writeValidated(input) {
      const ids = input.records.map((r) => r.id);
      store.set(input.runId, ids);
      return {
        newEvidenceIds: ids,
        contradictoryEvidenceIds: [],
        fixturePath: input.programFixturePath,
      };
    },
  };
}

/** No-op writer when orchestration is disabled or in dry-run mode. */
export function createNoopEvidenceWriter(): EvidenceWriterPort {
  return {
    async writeValidated(input) {
      return {
        newEvidenceIds: [],
        contradictoryEvidenceIds: [],
        fixturePath: input.programFixturePath,
      };
    },
  };
}
