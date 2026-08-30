import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  OrchestrationDiffSchema,
  OrchestrationEvidenceSnapshotSchema,
  OrchestrationTraceSchema,
  type EvidenceRecord,
  type OrchestrationDiff,
  type OrchestrationEvidenceSnapshot,
  type OrchestrationTrace,
} from "@pivotaledge/schemas";

export type ArtifactStoreOptions = {
  rootDir: string;
};

/** Persist diff/trace/evidence artifacts per run under data/orchestration/artifacts/. */
export function createArtifactStore(options: ArtifactStoreOptions) {
  const baseDir = path.join(options.rootDir, "artifacts");

  function runDir(runId: string) {
    return path.join(baseDir, runId);
  }

  async function ensureRunDir(runId: string) {
    await mkdir(runDir(runId), { recursive: true });
  }

  return {
    async saveDiff(runId: string, diff: OrchestrationDiff) {
      await ensureRunDir(runId);
      const parsed = OrchestrationDiffSchema.parse(diff);
      await writeFile(path.join(runDir(runId), "diff.json"), JSON.stringify(parsed, null, 2), "utf8");
    },

    async getDiff(runId: string): Promise<OrchestrationDiff | null> {
      try {
        const raw = await readFile(path.join(runDir(runId), "diff.json"), "utf8");
        return OrchestrationDiffSchema.parse(JSON.parse(raw));
      } catch {
        return null;
      }
    },

    async saveTrace(runId: string, trace: OrchestrationTrace) {
      await ensureRunDir(runId);
      const parsed = OrchestrationTraceSchema.parse(trace);
      await writeFile(path.join(runDir(runId), "trace.json"), JSON.stringify(parsed, null, 2), "utf8");
    },

    async getTrace(runId: string): Promise<OrchestrationTrace | null> {
      try {
        const raw = await readFile(path.join(runDir(runId), "trace.json"), "utf8");
        return OrchestrationTraceSchema.parse(JSON.parse(raw));
      } catch {
        return null;
      }
    },

    async saveEvidenceSnapshot(runId: string, snapshot: OrchestrationEvidenceSnapshot) {
      await ensureRunDir(runId);
      const parsed = OrchestrationEvidenceSnapshotSchema.parse(snapshot);
      await writeFile(path.join(runDir(runId), "evidence.json"), JSON.stringify(parsed, null, 2), "utf8");
    },

    async getEvidenceSnapshot(runId: string): Promise<OrchestrationEvidenceSnapshot | null> {
      try {
        const raw = await readFile(path.join(runDir(runId), "evidence.json"), "utf8");
        return OrchestrationEvidenceSnapshotSchema.parse(JSON.parse(raw));
      } catch {
        return null;
      }
    },

    async savePendingEvidence(runId: string, records: EvidenceRecord[]) {
      await this.saveEvidenceSnapshot(runId, {
        runId,
        newEvidenceIds: records.map((r) => r.id),
        contradictoryEvidenceIds: [],
        pendingRecords: records,
      });
    },
  };
}

export type ArtifactStore = ReturnType<typeof createArtifactStore>;
