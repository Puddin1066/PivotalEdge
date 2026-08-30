import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: [
      "tests/**/*.test.ts",
      "packages/**/*.test.ts",
      "tracks/**/*.test.ts",
    ],
  },
  resolve: {
    alias: {
      "@pivotaledge/schemas": path.join(root, "packages/schemas/src/index.ts"),
      "@pivotaledge/adapters": path.join(root, "packages/adapters/src/index.ts"),
      "@pivotaledge/agents": path.join(root, "packages/agents/src/index.ts"),
      "@pivotaledge/kg": path.join(root, "packages/kg/src/index.ts"),
      "@pivotaledge/models": path.join(root, "packages/models/src/index.ts"),
      "@pivotaledge/scoring": path.join(root, "packages/scoring/src/index.ts"),
      "@pivotaledge/workflows": path.join(root, "packages/workflows/src/index.ts"),
      "@pivotaledge/evals": path.join(root, "packages/evals/src/index.ts"),
      "@pivotaledge/orchestration": path.join(root, "packages/orchestration/src/index.ts"),
      "@pivotaledge/catalyst-markets": path.join(
        root,
        "tracks/catalyst-markets/src/index.ts",
      ),
    },
  },
});
