import { OrchestrationRunSchema, type OrchestrationRun } from "@pivotaledge/schemas";

import type { RunStorePort } from "../ports/index.js";

export function createMemoryRunStore(initial: OrchestrationRun[] = []): RunStorePort {
  const runs = new Map<string, OrchestrationRun>(
    initial.map((r) => [r.runId, OrchestrationRunSchema.parse(r)]),
  );

  return {
    async create(run) {
      const parsed = OrchestrationRunSchema.parse(run);
      if (runs.has(parsed.runId)) {
        throw new Error(`Run already exists: ${parsed.runId}`);
      }
      runs.set(parsed.runId, parsed);
    },
    async get(runId) {
      return runs.get(runId) ?? null;
    },
    async update(runId, patch) {
      const existing = runs.get(runId);
      if (!existing) throw new Error(`Run not found: ${runId}`);
      const updated = OrchestrationRunSchema.parse({ ...existing, ...patch });
      runs.set(runId, updated);
      return updated;
    },
    async list() {
      return [...runs.values()];
    },
  };
}
