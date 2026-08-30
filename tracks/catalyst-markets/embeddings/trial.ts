/**
 * Field-aware trial embeddings (Notion §8).
 * MVP: deterministic hash-projection — NOT a paid embedding API.
 * Swap for real model later; keep dims fixed for ablation.
 */

const DIM = 32;

function hashToken(token: string): number {
  let h = 2166136261;
  for (let i = 0; i < token.length; i++) {
    h ^= token.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function embedText(text: string, dim = DIM): number[] {
  const vec = new Array<number>(dim).fill(0);
  const tokens = text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  if (tokens.length === 0) return vec;
  for (const t of tokens) {
    const h = hashToken(t);
    const idx = h % dim;
    const sign = h & 1 ? 1 : -1;
    vec[idx]! += sign;
  }
  const norm = Math.sqrt(vec.reduce((s, x) => s + x * x, 0)) || 1;
  return vec.map((x) => x / norm);
}

export type FieldEmbeddings = {
  design: number[];
  endpoint: number[];
  population: number[];
  eligibility: number[];
  intervention: number[];
  mechanism: number[];
  historicalPrecedent: number[];
};

export function embedTrialFields(fields: {
  design?: string;
  endpoint?: string;
  population?: string;
  eligibility?: string;
  intervention?: string;
  mechanism?: string;
  historicalPrecedent?: string;
}): FieldEmbeddings {
  return {
    design: embedText(fields.design ?? ""),
    endpoint: embedText(fields.endpoint ?? ""),
    population: embedText(fields.population ?? ""),
    eligibility: embedText(fields.eligibility ?? ""),
    intervention: embedText(fields.intervention ?? ""),
    mechanism: embedText(fields.mechanism ?? ""),
    historicalPrecedent: embedText(fields.historicalPrecedent ?? ""),
  };
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < n; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  const d = Math.sqrt(na) * Math.sqrt(nb);
  return d === 0 ? 0 : dot / d;
}

export { DIM as EMBEDDING_DIM };
