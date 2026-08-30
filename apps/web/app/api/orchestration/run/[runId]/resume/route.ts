import path from "node:path";

import { NextResponse } from "next/server";

import { resumeOrchestrationRun } from "@pivotaledge/orchestration";

import { resolveRepoRoot } from "../../../../../lib/repo-root";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

type RouteParams = { params: Promise<{ runId: string }> };

/** POST { approved?: boolean } — continue after human review interrupt. */
export async function POST(request: Request, context: RouteParams) {
  const { runId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { approved?: boolean };
  const rootDir = path.join(resolveRepoRoot(), "data/orchestration");

  try {
    const result = await resumeOrchestrationRun({
      runId,
      rootDir,
      approved: body.approved !== false,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Resume failed";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
