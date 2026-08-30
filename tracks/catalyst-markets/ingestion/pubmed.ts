/** Stub — PubMed mechanistic / clinical precedent (cutoff-filtered later). */
export async function searchPubmed(_query: {
  terms: string[];
  cutoff: string;
}): Promise<Array<{ pmid: string; firstPublicAt: string; title: string }>> {
  return [];
}
