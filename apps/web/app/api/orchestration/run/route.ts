import path from "node:path";

import { NextResponse } from "next/server";

import {
  getOrchestrationRunDetail,
  getOrchestrationRunDiff,
  getOrchestrationRunEvidence,
  listSupportedMarketIds,
  resumeOrchestrationRun,
  startOrchestrationRun,
} from "@pivotaledge/orchestration";

import { resolveRepoRoot } from "../../../lib/repo-root";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function orchestrationRoot() {
  return path.join(resolveRepoRoot(), "data/orchestration");
}

/** POST { marketId, forecastCutoff?, resumeRunId? } — start or resume enrichment run. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    marketId?: string;
    forecastCutoff?: string;
    resumeRunId?: string;
    approved?: boolean;
  };

  if (body.resumeRunId) {
    const approved = body.approved !== false;
    try {
      const result = await resumeOrchestrationRun({
        runId: body.resumeRunId,
        rootDir: orchestrationRoot(),
        approved,
      });
      return NextResponse.json({ ok: true, ...result });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Resume failed";
      return NextResponse.json({ ok: false, error: message }, { status: 400 });
    }
  }

  const marketId = body.marketId ?? "pm_poly_syn_001";
  try {
    const result = await startOrchestrationRun({
      marketId,
      forecastCutoff: body.forecastCutoff,
      rootDir: orchestrationRoot(),
    });
    return NextResponse.json({
      ok: true,
      ...result,
      supportedMarkets: await listSupportedMarketIds(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Run failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

/** GET — list supported fixture market IDs for orchestration MVP. */
export async function GET() {
  return NextResponse.json({
    supportedMarkets: await listSupportedMarketIds(),
    defaultMarketId: "pm_poly_syn_001",
  });
}
