/** Stub — FDA documents for regulatory events / precedents. */
export async function searchFdaDocuments(_query: {
  drug?: string;
  cutoff: string;
}): Promise<Array<{ url: string; firstPublicAt: string; title: string }>> {
  return [];
}
