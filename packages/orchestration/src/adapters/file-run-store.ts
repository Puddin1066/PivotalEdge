import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { OrchestrationRunSchema, type OrchestrationRun } from "@pivotaledge/schemas";

import type { RunStorePort } from "../ports/index.js";

export type FileRunStoreOptions = {
  rootDir: string;
};

/** JSON file run ledger under data/orchestration/runs/. */
export function createFileRunStore(options: FileRunStoreOptions): RunStorePort {
  const runsDir = path.join(options.rootDir, "runs");

  async function ensureDir() {
    await mkdir(runsDir, { recursive: true });
  }

  function runPath(runId: string) {
    return path.join(runsDir, `${runId}.json`);
  }

  return {
    async create(run) {
      await ensureDir();
      const parsed = OrchestrationRunSchema.parse(run);
      const fp = runPath(parsed.runId);
      try {
        await readFile(fp, "utf8");
        throw new Error(`Run already exists: ${parsed.runId}`);
      } catch (err) {
        if (err instanceof Error && err.message.startsWith("Run already exists")) throw err;
      }
      await writeFile(fp, JSON.stringify(parsed, null, 2), "utf8");
    },
    async get(runId) {
      try {
        const raw = await readFile(runPath(runId), "utf8");
        return OrchestrationRunSchema.parse(JSON.parse(raw));
      } catch {
        return null;
      }
    },
    async update(runId, patch) {
      const existing = await this.get(runId);
      if (!existing) throw new Error(`Run not found: ${runId}`);
      const updated = OrchestrationRunSchema.parse({ ...existing, ...patch });
      await ensureDir();
      await writeFile(runPath(runId), JSON.stringify(updated, null, 2), "utf8");
      return updated;
    },
    async list() {
      await ensureDir();
      let files: string[];
      try {
        files = await readdir(runsDir);
      } catch {
        return [];
      }
      const runs: OrchestrationRun[] = [];
      for (const file of files.filter((f) => f.endsWith(".json"))) {
        const raw = await readFile(path.join(runsDir, file), "utf8");
        runs.push(OrchestrationRunSchema.parse(JSON.parse(raw)));
      }
      return runs.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    },
  };
}
