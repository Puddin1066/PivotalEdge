import type { ResearchPort } from "../ports/index.js";

/** Returns empty results — used until Phase 2 research branch is wired. */
export function createNoopResearchAdapter(): ResearchPort {
  return {
    async executeTask() {
      return [];
    },
  };
}
