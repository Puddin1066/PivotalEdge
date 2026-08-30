import { resolveAsset } from "../entity-resolution/assets.js";
import { okAgent, type AgentResponse } from "../schemas/agent-outputs.js";
import type { CatalystEvent } from "../schemas/event.js";

export function runLineageAgent(event: CatalystEvent): AgentResponse {
  const asset = event.drug ? resolveAsset(event.drug) : null;
  return okAgent(
    "lineage_agent",
    event.eventId,
    event.informationCutoff,
    {
      assetId: event.assetId,
      resolvedAsset: asset,
      predecessorTrialIds: [] as string[],
      followOnTrialIds: [] as string[],
      lineageDepth: 1,
      sameTargetPriorSuccesses: 0,
      sameTargetPriorFailures: 0,
    },
    { confidence: asset ? 0.85 : 0.5 },
  );
}
