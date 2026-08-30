import type { ReactNode } from "react";

import type { OrchestrationDiff, OrchestrationTrace } from "@pivotaledge/schemas";

function pct(value: number | null | undefined): string {
  if (value == null) return "—";
  return `${(value * 100).toFixed(1)}%`;
}

type ResearchTracePanelProps = {
  trace: OrchestrationTrace | null;
  diff: OrchestrationDiff | null;
  runId: string | null;
  /** Match Ops console styling when embedded on /ops/market/[id]. */
  variant?: "dossier" | "ops";
};

function panelShell(variant: "dossier" | "ops", children: ReactNode) {
  if (variant === "ops") {
    return (
      <section className="rounded-xl border border-line bg-panel p-5 shadow-sm">{children}</section>
    );
  }
  return (
    <section className="mb-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      {children}
    </section>
  );
}

function emptyShell(variant: "dossier" | "ops", children: ReactNode) {
  if (variant === "ops") {
    return (
      <section className="rounded-xl border border-dashed border-line bg-panel/50 p-5">{children}</section>
    );
  }
  return (
    <section className="mb-8 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6">
      {children}
    </section>
  );
}

/** Compact before/after enrichment panel (Phase 6 — no "LangGraph" in UI). */
export function ResearchTracePanel({
  trace,
  diff,
  runId,
  variant = "dossier",
}: ResearchTracePanelProps) {
  if (!trace && !diff) {
    return emptyShell(
      variant,
      <>
        <h2 className="text-lg font-semibold text-ink">Research trace</h2>
        <p className="mt-2 text-sm text-muted">
          No enrichment run recorded for this market yet. Start one via{" "}
          <code className="rounded bg-white px-1 py-0.5 text-xs">POST /api/orchestration/run</code>{" "}
          with a matching <code className="rounded bg-white px-1 py-0.5 text-xs">marketId</code>.
        </p>
      </>,
    );
  }

  return panelShell(
    variant,
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-ink">Research trace</h2>
        {runId ? (
          <a
            href={`/api/orchestration/run/${runId}/diff`}
            className="text-xs font-medium text-accent hover:underline"
          >
            View diff JSON
          </a>
        ) : null}
      </div>
      <p className="mt-1 text-xs text-muted">
        Evidence enrichment audit — baseline vs enriched model probability
      </p>

      <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted">Baseline P</dt>
          <dd className="font-mono-pe text-xl font-semibold">
            {pct(diff?.initialProbability ?? trace?.initialProbability)}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted">Enriched P</dt>
          <dd className="font-mono-pe text-xl font-semibold">
            {pct(diff?.finalProbability ?? trace?.enrichedProbability)}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted">ΔP</dt>
          <dd className="font-mono-pe text-xl font-semibold">
            {diff?.probabilityDelta != null ? pct(diff.probabilityDelta) : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted">Evidence added</dt>
          <dd className="font-mono-pe text-xl font-semibold">
            {diff?.evidenceAdded ?? trace?.newEvidenceIds.length ?? 0}
          </dd>
        </div>
      </dl>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold text-muted">Gaps before research</h3>
          <ul className="mt-2 space-y-1 text-sm">
            {(trace?.gapsBefore ?? []).slice(0, 6).map((g) => (
              <li key={g.featureName} className="rounded bg-white/60 px-2 py-1">
                {g.featureName}{" "}
                <span className="text-xs text-muted">(w={g.featureImportance.toFixed(2)})</span>
              </li>
            ))}
            {!trace?.gapsBefore?.length ? (
              <li className="text-muted">None recorded</li>
            ) : null}
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-muted">Run metadata</h3>
          <ul className="mt-2 space-y-1 text-sm">
            <li>
              <span className="text-muted">Iterations:</span>{" "}
              {diff?.researchIterations ?? trace?.researchIterations ?? 0}
            </li>
            <li>
              <span className="text-muted">Stop reason:</span>{" "}
              {diff?.stopReason ?? trace?.stopReason ?? "—"}
            </li>
            <li>
              <span className="text-muted">Status:</span> {trace?.status ?? "—"}
            </li>
            <li>
              <span className="text-muted">Features changed:</span>{" "}
              {(diff?.featuresChanged ?? trace?.featuresChanged ?? []).join(", ") || "—"}
            </li>
          </ul>
        </div>
      </div>
    </>,
  );
}
