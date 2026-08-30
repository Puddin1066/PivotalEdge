import { createHash } from "node:crypto";

import { EvidenceRecordSchema, type EvidenceRecord, type ResearchTask } from "@pivotaledge/schemas";
import type { MarketQuestion } from "@pivotaledge/schemas";

import { FAIL_CLOSED_GAP_FEATURES } from "../gaps/plan-research.js";
import type { ResearchPort } from "../ports/index.js";

function syntheticEvidence(
  task: ResearchTask,
  marketQuestion: MarketQuestion,
  forecastCutoff: string,
): EvidenceRecord {
  const subjectId = marketQuestion.drugAssetId ?? "prog_unknown";
  const valueByField: Record<string, string | boolean> = {
    acceptedAt: "2024-03-15T00:00:00.000Z",
    pdufaDate: "2024-09-30T00:00:00.000Z",
    filedAt: "2024-02-01T00:00:00.000Z",
    expectedFilingAt: "2024-04-01T00:00:00.000Z",
    primaryEndpointMet: true,
    adcomDate: "2024-05-01T00:00:00.000Z",
  };
  const objectValue = valueByField[task.gapFeature] ?? "2024-04-01T00:00:00.000Z";
  const passage = `Synthetic research evidence for ${task.gapFeature}`;
  const checksum = createHash("sha256").update(`${task.taskId}:${passage}`).digest("hex");

  return EvidenceRecordSchema.parse({
    id: `ev_${task.taskId}`,
    subjectId,
    predicate: task.gapFeature,
    objectValue,
    evidenceType: task.gapFeature.includes("Date") || task.gapFeature.endsWith("At") ? "timing" : "clinical",
    sourceType: task.sourcePriority[0] ?? "clinicaltrials.gov",
    sourceUrl: `fixture://research/${task.taskId}`,
    sourceId: task.taskId,
    firstPublicAt: "2024-04-01T00:00:00.000Z",
    retrievedAt: new Date().toISOString(),
    forecastCutoff,
    supportDirection: "supports",
    evidenceStrength: 0.75,
    extractionConfidence: 0.85,
    exactPassage: passage,
    locator: "synthetic",
    extractorVersion: "orchestration/fixture-research/1",
    checksum,
  });
}

export type FixtureResearchAdapterOptions = {
  /** Per-gap custom records; falls back to synthetic cutoff-safe evidence. */
  recordsForGap?: Record<string, EvidenceRecord[]>;
  /** When true, return no records (tests stop path). */
  returnEmpty?: boolean;
};

/** Deterministic research for fixtures/tests — not live CT.gov. */
export function createFixtureResearchAdapter(
  options: FixtureResearchAdapterOptions = {},
): ResearchPort {
  return {
    async executeTask({ task, marketQuestion, forecastCutoff }) {
      if (options.returnEmpty) return [];
      if (FAIL_CLOSED_GAP_FEATURES.has(task.gapFeature) && !options.recordsForGap?.[task.gapFeature]) {
        return [];
      }
      if (options.recordsForGap?.[task.gapFeature]) {
        return options.recordsForGap[task.gapFeature]!;
      }
      return [syntheticEvidence(task, marketQuestion, forecastCutoff)];
    },
  };
}
