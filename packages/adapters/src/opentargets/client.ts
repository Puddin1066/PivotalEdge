/**
 * Open Targets Platform GraphQL — disease → known/clinical drug candidates.
 * Public API, no license. Disease IDs may be MONDO_* (current) or EFO_*.
 * https://platform-docs.opentargets.org/data-access/graphql-api
 */

const DEFAULT_URL = "https://api.platform.opentargets.org/api/v4/graphql";

export type OtKnownDrug = {
  drugId: string;
  drugName: string;
  maxClinicalStage: string | null;
};

export type OtDiseaseDrugs = {
  diseaseId: string;
  diseaseName: string;
  drugs: OtKnownDrug[];
  raw: Record<string, unknown>;
};

export type FetchOpenTargetsOptions = {
  url?: string;
  fetchImpl?: typeof fetch;
};

async function graphql<T>(
  query: string,
  variables: Record<string, unknown>,
  options: FetchOpenTargetsOptions = {},
): Promise<T> {
  const fetchFn = options.fetchImpl ?? fetch;
  const url = options.url ?? DEFAULT_URL;
  const res = await fetchFn(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": "PivotalEdge/0.1 (research)",
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`Open Targets ${res.status}: ${await res.text()}`);
  const body = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (body.errors?.length) {
    throw new Error(`Open Targets GraphQL: ${body.errors.map((e) => e.message).join("; ")}`);
  }
  if (!body.data) throw new Error("Open Targets GraphQL: empty data");
  return body.data;
}

/** Resolve a free-text indication name to an Open Targets disease id. */
export async function searchOpenTargetsDisease(
  queryString: string,
  options: FetchOpenTargetsOptions & { size?: number } = {},
): Promise<{ id: string; name: string }[]> {
  const data = await graphql<{
    search: { hits: { id: string; name: string; entity: string }[] };
  }>(
    `query($q:String!, $size:Int!) {
      search(queryString:$q, entityNames:["disease"], page:{index:0, size:$size}) {
        hits { id name entity }
      }
    }`,
    { q: queryString, size: options.size ?? 5 },
    options,
  );
  return data.search.hits.filter((h) => h.entity === "disease").map((h) => ({ id: h.id, name: h.name }));
}

/**
 * Approved / clinical candidates linked to a disease (competition proxy).
 * Prefer MONDO_* ids from searchOpenTargetsDisease when EFO lookups return null.
 */
export async function fetchKnownDrugsForDisease(
  diseaseId: string,
  options: FetchOpenTargetsOptions & { limit?: number } = {},
): Promise<OtDiseaseDrugs | null> {
  const limit = options.limit ?? 15;
  const data = await graphql<{
    disease: {
      id: string;
      name: string;
      drugAndClinicalCandidates: {
        count: number;
        rows: {
          id: string;
          maxClinicalStage: string;
          drug: { id: string; name: string } | null;
        }[];
      };
    } | null;
  }>(
    `query($id:String!) {
      disease(efoId:$id) {
        id
        name
        drugAndClinicalCandidates {
          count
          rows {
            id
            maxClinicalStage
            drug { id name }
          }
        }
      }
    }`,
    { id: diseaseId },
    options,
  );

  if (!data.disease) return null;
  const drugs: OtKnownDrug[] = [];
  for (const row of data.disease.drugAndClinicalCandidates.rows) {
    if (!row.drug) continue;
    drugs.push({
      drugId: row.drug.id,
      drugName: row.drug.name,
      maxClinicalStage: row.maxClinicalStage ?? null,
    });
    if (drugs.length >= limit) break;
  }

  return {
    diseaseId: data.disease.id,
    diseaseName: data.disease.name,
    drugs,
    raw: data.disease as unknown as Record<string, unknown>,
  };
}
