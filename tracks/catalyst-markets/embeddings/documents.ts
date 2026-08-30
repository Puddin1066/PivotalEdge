import { cosineSimilarity, embedTrialFields } from "./trial.js";

export function embedDocumentPassage(text: string): number[] {
  return embedTrialFields({ historicalPrecedent: text }).historicalPrecedent;
}

export function rankByEmbedding(
  query: number[],
  candidates: Array<{ id: string; vector: number[] }>,
  limit = 10,
): Array<{ id: string; score: number }> {
  return candidates
    .map((c) => ({ id: c.id, score: cosineSimilarity(query, c.vector) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
