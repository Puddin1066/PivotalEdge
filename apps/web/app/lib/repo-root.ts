import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Resolve monorepo root whether Next cwd is apps/web or repo root. */
export function resolveRepoRoot(): string {
  const candidates = [
    process.cwd(),
    path.resolve(process.cwd(), "../.."),
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../../../../"),
  ];
  for (const c of candidates) {
    if (existsSync(path.join(c, "pnpm-workspace.yaml")) || existsSync(path.join(c, "package.json"))) {
      if (existsSync(path.join(c, "scripts/kg-enrich.ts"))) return c;
    }
  }
  // Fallback: walk up from cwd
  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    if (existsSync(path.join(dir, "scripts/kg-enrich.ts"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}
