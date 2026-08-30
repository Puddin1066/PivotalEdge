import type { BetAction, ForecastComponent, OrchestrationDiff, OrchestrationTrace } from "@pivotaledge/schemas";
import type { OpportunityDossier } from "@pivotaledge/workflows";

import { ResearchTracePanel } from "./research-trace-panel";

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function actionStyles(action: BetAction): string {
  switch (action) {
    case "BET_YES":
      return "bg-emerald-100 text-emerald-800 border-emerald-300";
    case "BET_NO":
      return "bg-rose-100 text-rose-800 border-rose-300";
    case "WAIT":
      return "bg-amber-100 text-amber-800 border-amber-300";
    default:
      return "bg-slate-100 text-slate-700 border-slate-300";
  }
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold text-ink">{value}</dd>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

function ComponentTable({ components }: { components: ForecastComponent[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-muted">
          <tr>
            <th className="px-4 py-3">Component</th>
            <th className="px-4 py-3">P</th>
          </tr>
        </thead>
        <tbody>
          {components.map((c) => (
            <tr key={c.id} className="border-t border-slate-100">
              <td className="px-4 py-2 font-mono text-xs">{c.name}</td>
              <td className="px-4 py-2">{pct(c.probability)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DossierView({
  dossier,
  researchTrace,
  researchDiff,
  researchRunId,
}: {
  dossier: OpportunityDossier;
  researchTrace?: OrchestrationTrace | null;
  researchDiff?: OrchestrationDiff | null;
  researchRunId?: string | null;
}) {
  const { market, recommendation, forecast, precedentBundle, metadata } = dossier;
  const rec = recommendation;

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <header className="mb-8 border-b border-slate-200 pb-6">
        <p className="text-sm font-medium text-accent">PivotalEdge · Regulatory Dossier</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">{market.question}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted">
          {market.resolutionRules}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span
            className={`inline-flex rounded-full border px-3 py-1 text-sm font-semibold ${actionStyles(rec.action)}`}
          >
            {rec.action.replace("_", " ")}
          </span>
          <span className="text-xs text-muted">
            Policy {rec.policyVersion} · Forecast {forecast.modelVersion}
          </span>
          {metadata.orderBooksAreMock ? (
            <span className="rounded bg-amber-50 px-2 py-0.5 text-xs text-amber-800">
              Mock order book (fixture)
            </span>
          ) : null}
        </div>
      </header>

      <ResearchTracePanel
        trace={researchTrace ?? null}
        diff={researchDiff ?? null}
        runId={researchRunId ?? null}
      />

      <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Model P(YES)" value={pct(rec.modelProbability)} />
        <Stat label="Conservative P" value={pct(rec.conservativeProbability)} hint="Interval low" />
        <Stat
          label="Executable price"
          value={pct(rec.executablePrice)}
          hint="Best ask (fillable)"
        />
        <Stat label="Net edge" value={pct(rec.netEdge)} hint="After 2% fee assumption" />
      </section>

      <section className="mb-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Betting recommendation</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Max entry price</dt>
              <dd className="font-medium">
                {rec.maximumEntryPrice != null ? pct(rec.maximumEntryPrice) : "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Recommended stake</dt>
              <dd className="font-medium">${rec.recommendedStake.toFixed(2)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Bankroll fraction</dt>
              <dd className="font-medium">{pct(rec.bankrollFraction)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Evidence confidence</dt>
              <dd className="font-medium capitalize">{rec.evidenceConfidence}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Resolution risk</dt>
              <dd className="font-medium capitalize">{rec.resolutionRisk}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Thesis</h2>
          <p className="mt-3 text-sm leading-relaxed">{rec.primaryThesis}</p>
          <h3 className="mt-5 text-sm font-semibold text-muted">Strongest counterargument</h3>
          <p className="mt-2 text-sm leading-relaxed">{rec.strongestCounterargument}</p>
          <h3 className="mt-5 text-sm font-semibold text-muted">Invalidators</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {rec.invalidators.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">Forecast components</h2>
        <ComponentTable components={forecast.components} />
        <p className="mt-2 text-xs text-muted">
          Interval [{pct(forecast.intervalLow)}, {pct(forecast.intervalHigh)}] · Cutoff{" "}
          {forecast.forecastCutoff.slice(0, 10)}
        </p>
      </section>

      <section className="mb-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Precedent cohorts</h2>
          <ul className="mt-4 space-y-3 text-sm">
            {precedentBundle.cohorts.map((cohort) => (
              <li key={cohort.cohortDefinition} className="rounded-lg bg-slate-50 p-3">
                <p className="font-medium">{cohort.cohortDefinition}</p>
                <p className="mt-1 text-muted">
                  {cohort.approvals} approvals · {cohort.crls} CRLs · {cohort.programs.length}{" "}
                  programs
                  {cohort.empiricalRate != null ? ` · rate ${pct(cohort.empiricalRate)}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Supporting evidence</h2>
          <ul className="mt-4 space-y-1 font-mono text-xs text-slate-700">
            {rec.supportingEvidenceIds.map((id) => (
              <li key={id} className="rounded bg-slate-50 px-2 py-1">
                {id}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-muted">
            Fingerprint {dossier.fingerprint.contentHash.slice(0, 16)}… · {metadata.fixtureSource}
          </p>
        </div>
      </section>
    </main>
  );
}
