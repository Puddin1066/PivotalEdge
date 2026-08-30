/** ClinicalTrials.gov API v2 — read-only study fetch. */

const DEFAULT_BASE = "https://clinicaltrials.gov/api/v2";

export type CtPrimaryOutcome = {
  measure: string;
  description: string | null;
  timeFrame: string | null;
};

export type CtStudySummary = {
  nctId: string;
  title: string;
  status: string | null;
  phase: string | null;
  conditions: string[];
  interventions: string[];
  sponsor: string | null;
  startDate: string | null;
  primaryCompletionDate: string | null;
  completionDate: string | null;
  /** CT.gov first submitted / posted to registry. */
  registeredAt: string | null;
  hasResults: boolean;
  enrollmentCount: number | null;
  enrollmentType: string | null;
  allocation: string | null;
  masking: string | null;
  primaryOutcomes: CtPrimaryOutcome[];
  raw: Record<string, unknown>;
};

function phaseFromStudy(study: Record<string, unknown>): string | null {
  const design = study.designModule as Record<string, unknown> | undefined;
  const phases = design?.phases;
  if (Array.isArray(phases) && phases.length) return phases.map(String).join("/");
  return null;
}

function dateFromStruct(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const date = (value as Record<string, unknown>).date;
  if (date == null || String(date).length === 0) return null;
  const s = String(date);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{4}-\d{2}$/.test(s)) return `${s}-01`;
  if (/^\d{4}$/.test(s)) return `${s}-01-01`;
  return s;
}

export function normalizeCtStudy(raw: Record<string, unknown>): CtStudySummary | null {
  const proto = raw.protocolSection as Record<string, unknown> | undefined;
  if (!proto) return null;
  const idMod = proto.identificationModule as Record<string, unknown> | undefined;
  const nctId = idMod?.nctId != null ? String(idMod.nctId) : null;
  if (!nctId) return null;

  const statusMod = proto.statusModule as Record<string, unknown> | undefined;
  const descMod = proto.descriptionModule as Record<string, unknown> | undefined;
  const condMod = proto.conditionsModule as Record<string, unknown> | undefined;
  const armsMod = proto.armsInterventionsModule as Record<string, unknown> | undefined;
  const sponsorMod = proto.sponsorCollaboratorsModule as Record<string, unknown> | undefined;
  const designMod = proto.designModule as Record<string, unknown> | undefined;
  const outcomesMod = proto.outcomesModule as Record<string, unknown> | undefined;

  const interventions: string[] = [];
  for (const arm of (armsMod?.interventions as unknown[]) ?? []) {
    if (arm && typeof arm === "object") {
      const name = (arm as Record<string, unknown>).name;
      if (name) interventions.push(String(name));
    }
  }

  const lead = sponsorMod?.leadSponsor as Record<string, unknown> | undefined;
  const designInfo = (designMod?.designInfo as Record<string, unknown>) ?? {};
  const maskingInfo = (designInfo.maskingInfo as Record<string, unknown>) ?? {};
  const enrollmentInfo = (designMod?.enrollmentInfo as Record<string, unknown>) ?? {};

  const primaryOutcomes: CtPrimaryOutcome[] = [];
  for (const o of (outcomesMod?.primaryOutcomes as unknown[]) ?? []) {
    if (!o || typeof o !== "object") continue;
    const row = o as Record<string, unknown>;
    if (row.measure == null) continue;
    primaryOutcomes.push({
      measure: String(row.measure),
      description: row.description != null ? String(row.description) : null,
      timeFrame: row.timeFrame != null ? String(row.timeFrame) : null,
    });
  }

  return {
    nctId,
    title: String(descMod?.briefTitle ?? idMod?.officialTitle ?? ""),
    status: statusMod?.overallStatus != null ? String(statusMod.overallStatus) : null,
    phase: phaseFromStudy(proto),
    conditions: ((condMod?.conditions as unknown[]) ?? []).map(String),
    interventions,
    sponsor: lead?.name != null ? String(lead.name) : null,
    startDate: dateFromStruct(statusMod?.startDateStruct),
    primaryCompletionDate: dateFromStruct(statusMod?.primaryCompletionDateStruct),
    completionDate: dateFromStruct(statusMod?.completionDateStruct),
    registeredAt:
      statusMod?.studyFirstSubmitDate != null
        ? String(statusMod.studyFirstSubmitDate)
        : statusMod?.studyFirstPostDateStruct
          ? dateFromStruct(statusMod.studyFirstPostDateStruct)
          : null,
    hasResults: Boolean(raw.resultsSection),
    enrollmentCount:
      enrollmentInfo.count != null && Number.isFinite(Number(enrollmentInfo.count))
        ? Number(enrollmentInfo.count)
        : null,
    enrollmentType: enrollmentInfo.type != null ? String(enrollmentInfo.type) : null,
    allocation: designInfo.allocation != null ? String(designInfo.allocation) : null,
    masking: maskingInfo.masking != null ? String(maskingInfo.masking) : null,
    primaryOutcomes,
    raw,
  };
}

export type FetchCtStudyOptions = {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
};

export async function fetchCtStudyByNctId(
  nctId: string,
  options: FetchCtStudyOptions = {},
): Promise<CtStudySummary | null> {
  const base = options.baseUrl ?? DEFAULT_BASE;
  const fetchFn = options.fetchImpl ?? fetch;
  const url = `${base}/studies/${encodeURIComponent(nctId)}`;
  const res = await fetchFn(url, {
    headers: { Accept: "application/json", "User-Agent": "PivotalEdge/0.1 (research)" },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`ClinicalTrials.gov ${res.status}: ${await res.text()}`);
  const raw: unknown = await res.json();
  if (!raw || typeof raw !== "object") return null;
  return normalizeCtStudy(raw as Record<string, unknown>);
}

export async function searchCtStudies(
  query: string,
  options: FetchCtStudyOptions & { pageSize?: number } = {},
): Promise<CtStudySummary[]> {
  const base = options.baseUrl ?? DEFAULT_BASE;
  const fetchFn = options.fetchImpl ?? fetch;
  const params = new URLSearchParams({
    "query.term": query,
    pageSize: String(options.pageSize ?? 5),
    format: "json",
  });
  const url = `${base}/studies?${params}`;
  const res = await fetchFn(url, {
    headers: { Accept: "application/json", "User-Agent": "PivotalEdge/0.1 (research)" },
  });
  if (!res.ok) throw new Error(`ClinicalTrials.gov search ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { studies?: Record<string, unknown>[] };
  return (data.studies ?? [])
    .map((s) => normalizeCtStudy(s))
    .filter((s): s is CtStudySummary => s != null);
}
