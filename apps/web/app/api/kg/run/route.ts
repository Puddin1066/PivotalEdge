import { spawn } from "node:child_process";

import { NextResponse } from "next/server";

import { resolveRepoRoot } from "../../../lib/repo-root";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function runPnpmScript(script: string): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn("pnpm", [script], {
      cwd: resolveRepoRoot(),
      env: process.env,
      shell: false,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("close", (code) => {
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

/** POST { action: enrich | score-live | retro-validate | quotes-snapshot | paper-live } */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { action?: string };
  const action = body.action;
  const allowed = new Set([
    "enrich",
    "score-live",
    "retro-validate",
    "quotes-snapshot",
    "paper-live",
  ]);
  if (!action || !allowed.has(action)) {
    return NextResponse.json(
      {
        ok: false,
        error: "action must be enrich | score-live | retro-validate | quotes-snapshot | paper-live",
      },
      { status: 400 },
    );
  }

  const script =
    action === "enrich"
      ? "kg:enrich"
      : action === "score-live"
        ? "kg:score-live"
        : action === "retro-validate"
          ? "retro:validate"
          : action === "quotes-snapshot"
            ? "quotes:snapshot"
            : "paper:live";
  const result = await runPnpmScript(script);
  const ok = result.code === 0;
  return NextResponse.json({
    ok,
    action,
    script,
    exitCode: result.code,
    stdoutTail: result.stdout.slice(-4000),
    stderrTail: result.stderr.slice(-2000),
  });
}
