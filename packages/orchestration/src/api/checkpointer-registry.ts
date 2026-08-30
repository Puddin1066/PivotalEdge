import { MemorySaver } from "@langchain/langgraph";

const registry = new Map<string, MemorySaver>();

/** Process-scoped checkpointer registry for API resume (thread_id = runId). */
export function getSharedCheckpointer(scopeKey: string): MemorySaver {
  let saver = registry.get(scopeKey);
  if (!saver) {
    saver = new MemorySaver();
    registry.set(scopeKey, saver);
  }
  return saver;
}

export function resetSharedCheckpointer(scopeKey: string): void {
  registry.delete(scopeKey);
}
