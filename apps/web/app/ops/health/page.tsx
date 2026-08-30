import Link from "next/link";

import { buildOpsDashboard } from "@pivotaledge/workflows";

import { DataLaneLegend, formatDateTime } from "../../components/data-provenance";
import { Stat } from "../../components/ops-ui";

export const dynamic = "force-dynamic";

export default async function OpsHealthPage() {
  const dash = await buildOpsDashboard();
  const t = dash.trading;
  const platform = dash.platform;
  const askAgeHours =
    dash.lastAskAt != null
      ? (Date.now() - Date.parse(dash.lastAskAt)) / (60 * 60 * 1000)
      : null;

  return (
    <div className="space-y-10">
      <header>
        <p className="text-sm font-medium text-accent">Health</p>
        <h1 className="font-display mt-1 text-3xl font-semibold text-ink">
          Pipelines & readiness
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Gates for paper / calibrated conviction. Snapshot asks and rescore from the header before
          trusting marks. Live execution stays off until Bar B passes.
        </p>
      </header>

      <section className="grid gap-6 border-y border-line py-6 sm:grid-cols-4">
        <Stat
          label="Conviction"
          value={(t?.clinicalConviction ?? "demo").toUpperCase()}
          hint={dash.asksFresh ? "asks ≤48h" : "asks stale / missing"}
        />
        <Stat
          label="Paper ready"
          value={t?.paperReady ? "Yes" : "No"}
          hint={t?.blockers[0] ?? "no blockers"}
        />
        <Stat label="Live ready" value="No" hint="Bar B gated" />
        <Stat
          label="Vault age"
          value={askAgeHours != null ? `${askAgeHours.toFixed(1)}h` : "—"}
          hint={dash.lastAskAt ? formatDateTime(dash.lastAskAt) : "empty vault"}
        />
      </section>

      {t && t.blockers.length > 0 ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50/80 p-4">
          <h2 className="text-sm font-semibold text-amber-950">Readiness blockers</h2>
          <ul className="mt-2 list-inside list-disc text-sm text-amber-950">
            {t.blockers.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-line bg-panel p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Quote vault
          </h2>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-muted">Rows</dt>
              <dd className="font-mono-pe text-lg">{t?.quoteVaultRows ?? 0}</dd>
            </div>
            <div>
              <dt className="text-muted">Markets</dt>
              <dd className="font-mono-pe text-lg">{t?.quoteVaultMarkets ?? 0}</dd>
            </div>
            <div>
              <dt className="text-muted">Distinct days</dt>
              <dd className="font-mono-pe text-lg">{t?.quoteVaultDistinctDays ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted">Open paper BET_*</dt>
              <dd className="font-mono-pe text-lg">{dash.paperOpen}</dd>
            </div>
          </dl>
          <p className="mt-4 text-xs text-muted">
            Use header actions: Snapshot asks → Rescore live → Refresh paper.
          </p>
        </div>

        <div className="rounded-xl border border-line bg-panel p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Clinical KG
          </h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Programs</dt>
              <dd className="font-mono-pe">{platform.kg.programCount}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Live programs</dt>
              <dd className="font-mono-pe">{platform.kg.liveProgramCount}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Last enrich</dt>
              <dd className="font-mono-pe text-xs">
                {formatDateTime(platform.enrichment.lastEnrichAt)}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Last score</dt>
              <dd className="font-mono-pe text-xs">
                {formatDateTime(platform.enrichment.lastScoreAt)}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Retrospective</dt>
              <dd className="font-mono-pe">
                {platform.retrospective
                  ? platform.retrospective.passed
                    ? "PASS"
                    : "FAIL"
                  : "—"}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-ink">How to read labels</h2>
        <DataLaneLegend />
      </section>

      <p className="text-sm text-muted">
        Full radar inventory remains at{" "}
        <Link href="/platform" className="font-semibold text-accent hover:underline">
          /platform
        </Link>
        . KG metrics & enrich history:{" "}
        <Link href="/ops/kg" className="font-semibold text-accent hover:underline">
          /ops/kg
        </Link>
        .
      </p>
    </div>
  );
}
