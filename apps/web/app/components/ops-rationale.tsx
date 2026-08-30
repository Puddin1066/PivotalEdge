import type { OpsMarketRationale } from "@pivotaledge/workflows";

import { formatDate, formatDateTime, pct } from "./data-provenance";

function kindLabel(kind: string): string {
  if (kind === "trial_result") return "Trial result";
  if (kind === "designation") return "Designation";
  if (kind === "document") return "Document";
  return "Evidence";
}

/** Explanatory rationale: thesis, components, sourced citations. */
export function OpsRationalePanel({ rationale }: { rationale: OpsMarketRationale }) {
  const p = rationale.program;

  return (
    <div id="rationale" className="space-y-8 scroll-mt-8">
      <header>
        <p className="text-sm font-medium text-accent">Why this call</p>
        <h2 className="font-display mt-1 text-2xl font-semibold text-ink">
          Rationale & citations
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Probabilities come from the clinical–regulatory model (not an LLM guess). Citations are
          sourced passages from the KG with public timestamps.
        </p>
      </header>

      <section className="border-y border-line py-5">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">Thesis</h3>
        <p className="mt-3 text-base leading-relaxed text-ink">{rationale.thesis}</p>
        <p className="mt-4 text-sm text-muted">
          <span className="font-semibold text-ink">Strongest counter:</span>{" "}
          {rationale.counterargument}
        </p>
        {rationale.invalidators.length > 0 ? (
          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              Invalidators
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink">
              {rationale.invalidators.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <p className="mt-4 rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink">
          {rationale.bindingNote}
        </p>
      </section>

      {p ? (
        <section>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">Program</h3>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-[11px] uppercase text-muted">Drug</dt>
              <dd className="text-sm font-medium">{p.drug}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase text-muted">Indication</dt>
              <dd className="text-sm font-medium">{p.indication}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase text-muted">Phase · endpoint</dt>
              <dd className="text-sm font-medium">
                {p.phase ?? "—"} ·{" "}
                {p.primaryEndpointMet === true
                  ? "met"
                  : p.primaryEndpointMet === false
                    ? "not met"
                    : "unknown"}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase text-muted">Designations</dt>
              <dd className="text-sm font-medium">
                {p.designations.length ? p.designations.join(", ") : "—"}
              </dd>
            </div>
          </dl>
        </section>
      ) : null}

      <section>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Forecast components
        </h3>
        <p className="mt-1 text-sm text-muted">
          P(YES) ≈ product of these steps. Model {rationale.modelVersion ?? "—"} · cutoff{" "}
          {formatDate(rationale.forecastCutoff)} · confidence {rationale.evidenceConfidence}
        </p>
        <ul className="mt-4 divide-y divide-line border-y border-line">
          {rationale.components.map((c) => {
            const binding = rationale.bindingComponent?.id === c.id;
            return (
              <li
                key={c.id}
                className={`flex flex-wrap items-start justify-between gap-3 py-3 ${
                  binding ? "bg-amber-50/60" : ""
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">
                    {c.label}
                    {binding ? (
                      <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-amber-900">
                        binding
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-1 text-xs text-muted">{c.explanation}</p>
                </div>
                <p className="font-mono-pe text-lg tabular-nums">{pct(c.probability)}</p>
              </li>
            );
          })}
        </ul>
        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 text-sm">
          <div>
            <dt className="text-[11px] uppercase text-muted">Model P(YES)</dt>
            <dd className="font-mono-pe">{pct(rationale.modelP)}</dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase text-muted">Cons. P(YES)</dt>
            <dd className="font-mono-pe">{pct(rationale.conservativeP)}</dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase text-muted">Cons. P(NO)</dt>
            <dd className="font-mono-pe">{pct(rationale.pNoConservative)}</dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase text-muted">Deadline</dt>
            <dd className="font-mono-pe text-xs">{formatDate(rationale.eventDeadline)}</dd>
          </div>
        </dl>
      </section>

      <section>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Citations
        </h3>
        <p className="mt-1 text-sm text-muted">
          Supporting evidence IDs resolved to sourced passages (layer: sourced facts / documents).
        </p>
        {rationale.citations.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No evidence IDs on this forecast.</p>
        ) : (
          <ol className="mt-4 space-y-4">
            {rationale.citations.map((c, i) => (
              <li key={c.id} className="border-l-2 border-accent pl-4">
                <p className="text-[11px] uppercase tracking-wide text-muted">
                  [{i + 1}] {kindLabel(c.kind)}
                </p>
                <p className="mt-1 text-sm font-semibold text-ink">{c.label}</p>
                {c.passage ? (
                  <blockquote className="mt-2 text-sm leading-relaxed text-ink">
                    “{c.passage}”
                  </blockquote>
                ) : null}
                <p className="mt-2 font-mono-pe text-[11px] text-muted">
                  {c.sourceSystem ?? "source"} · public {formatDateTime(c.firstPublicAt)}
                  {c.sourceUrl ? (
                    <>
                      {" · "}
                      <a
                        href={c.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold text-accent hover:underline"
                      >
                        open source ↗
                      </a>
                    </>
                  ) : null}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
