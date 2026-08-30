import path from "node:path";

import { NextResponse } from "next/server";

import { getOrchestrationRunDiff } from "@pivotaledge/orchestration";

import { resolveRepoRoot } from "../../../../../lib/repo-root";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ runId: string }> };

export async function GET(_request: Request, context: RouteParams) {
  const { runId } = await context.params;
  const rootDir = path.join(resolveRepoRoot(), "data/orchestration");
  const diff = await getOrchestrationRunDiff(runId, rootDir);

  if (!diff) {
    return NextResponse.json({ ok: false, error: "Diff not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, runId, diff });
}
