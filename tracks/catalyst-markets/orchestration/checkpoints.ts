import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { CatalystPipelineState } from "./state.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "data", "catalyst-markets");

export async function checkpointState(
  runId: string,
  node: string,
  state: CatalystPipelineState,
): Promise<string> {
  const dir = path.join(root, "checkpoints", runId);
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, `${node}.json`);
  await writeFile(
    file,
    JSON.stringify(
      {
        runId,
        node,
        at: new Date().toISOString(),
        eventId: state.event.eventId,
        auditStatus: state.auditStatus,
        pSuccess: state.pSuccess,
        expectedReturn: state.expectedReturn,
        edgeScore: state.edgeScore,
      },
      null,
      2,
    ),
  );
  return file;
}

export async function persistFrozenForecast(
  prediction: unknown,
): Promise<string> {
  const dir = path.join(root, "frozen-forecasts");
  await mkdir(dir, { recursive: true });
  const id =
    typeof prediction === "object" &&
    prediction &&
    "eventId" in prediction &&
    typeof (prediction as { eventId: string }).eventId === "string"
      ? (prediction as { eventId: string }).eventId
      : `forecast_${Date.now()}`;
  const file = path.join(dir, `${id}.json`);
  await writeFile(file, JSON.stringify(prediction, null, 2));
  return file;
}
