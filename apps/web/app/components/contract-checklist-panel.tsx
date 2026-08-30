import type { ContractCoverage, ContractEvidenceAssessment } from "@pivotaledge/schemas";

function coverageTone(coverage: ContractCoverage | undefined): string {
  switch (coverage) {
    case "complete":
      return "border-emerald-200 bg-emerald-50 text-emerald-900";
    case "partial":
      return "border-amber-200 bg-amber-50 text-amber-900";
    case "blocked":
      return "border-rose-200 bg-rose-50 text-rose-900";
    default:
      return "border-line bg-panel text-muted";
  }
}

type ContractChecklistPanelProps = {
  assessment: ContractEvidenceAssessment | null;
  eventType?: string | null;
  variant?: "ops" | "dossier";
};

/** P0 required-evidence checklist for edge identification. */
export function ContractChecklistPanel({
  assessment,
  eventType,
  variant = "ops",
}: ContractChecklistPanelProps) {
  const shell =
    variant === "ops"
      ? "rounded-xl border border-line bg-panel p-5 shadow-sm"
      : "mb-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm";

  if (!assessment) {
    return (
      <section className={shell}>
        <h2 className="text-lg font-semibold text-ink">Contract evidence</h2>
        <p className="mt-2 text-sm text-muted">
          No contract checklist available. Rescore live markets to refresh required-field status.
        </p>
      </section>
    );
  }

  return (
    <section className={shell}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-ink">Contract evidence</h2>
          <p className="mt-1 text-xs text-muted">
            Required fields for <span className="font-mono-pe">{eventType ?? assessment.eventType}</span>{" "}
            — model P is {assessment.calibrationBlocked ? "not" : ""} calibrated for edge
          </p>
        </div>
        <span
          className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${coverageTone(assessment.contractCoverage)}`}
        >
          {assessment.contractCoverage}
        </span>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold text-muted">Present</h3>
          <ul className="mt-2 space-y-1 text-sm">
            {assessment.requiredPresent.length ? (
              assessment.requiredPresent.map((f) => (
                <li key={f} className="rounded bg-white/70 px-2 py-1 font-mono-pe text-xs">
                  {f}
                </li>
              ))
            ) : (
              <li className="text-muted">None</li>
            )}
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-muted">Missing</h3>
          <ul className="mt-2 space-y-1 text-sm">
            {assessment.requiredMissing.length ? (
              assessment.requiredMissing.map((f) => (
                <li key={f} className="rounded bg-rose-50 px-2 py-1 font-mono-pe text-xs text-rose-900">
                  {f}
                </li>
              ))
            ) : (
              <li className="text-muted">None — checklist complete</li>
            )}
          </ul>
        </div>
      </div>

      {assessment.notes.length > 0 ? (
        <ul className="mt-4 space-y-1 text-sm text-amber-900">
          {assessment.notes.map((note) => (
            <li key={note}>• {note}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export function assessmentFromOpportunity(opp: {
  eventType?: string;
  requiredPresent?: string[];
  requiredMissing?: string[];
  contractCoverage?: ContractCoverage;
  calibrationBlocked?: boolean;
  contractNotes?: string[];
}): ContractEvidenceAssessment | null {
  if (opp.contractCoverage == null && !opp.requiredMissing?.length) return null;
  return {
    eventType: opp.eventType ?? "FDA_APPROVAL_BY_DATE",
    requiredPresent: opp.requiredPresent ?? [],
    requiredMissing: opp.requiredMissing ?? [],
    contractCoverage: opp.contractCoverage ?? "partial",
    calibrationBlocked: opp.calibrationBlocked ?? false,
    notes: opp.contractNotes ?? [],
  };
}
