"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";

import type { EnrichHistoryEntry, KgMetricsDashboard } from "@pivotaledge/workflows";

import { formatDateTime } from "./data-provenance";
import { Stat } from "./ops-ui";

function pct(n: number, d: number): string {
  if (d <= 0) return "—";
  return `${Math.round((100 * n) / d)}%`;
}

function shortIso(iso: string | null | undefined): string {
  if (!iso) return "—";
  return iso.slice(0, 10);
}

function BucketBars({
  title,
  buckets,
}: {
  title: string;
  buckets: { key: string; count: number }[];
}) {
  const max = Math.max(1, ...buckets.map((b) => b.count));
  return (
    <div className="rounded-xl border border-line bg-panel p-5 shadow-sm">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{title}</h2>
      <ul className="mt-4 space-y-2">
        {buckets.slice(0, 10).map((b) => (
          <li key={b.key} className="text-sm">
            <div className="mb-1 flex justify-between gap-2">
              <span className="truncate text-ink">{b.key}</span>
              <span className="font-mono-pe shrink-0 text-muted">{b.count}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-accent/80"
                style={{ width: `${(100 * b.count) / max}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function EnrichRunCard({ run, expanded }: { run: EnrichHistoryEntry; expanded?: boolean }) {
  const [open, setOpen] = useState(Boolean(expanded));
  return (
    <li className="rounded-xl border border-line bg-panel shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div>
          <p className="font-mono-pe text-sm text-ink">{formatDateTime(run.at)}</p>
          <p className="mt-0.5 text-xs text-muted">
            {run.programCount} programs · {run.competitorsDatedTotal} dated competitors · OB{" "}
            {run.orangeBookHitsTotal} · retro {run.retrospectiveHitsTotal}
          </p>
        </div>
        <span className="text-xs font-semibold text-accent">{open ? "Hide" : "Details"}</span>
      </button>
      {open ? (
        <div className="overflow-x-auto border-t border-line">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-muted">
              <tr>
                <th className="px-3 py-2">Slug</th>
                <th className="px-3 py-2">Dated / n</th>
                <th className="px-3 py-2">OB / retro</th>
                <th className="px-3 py-2">Clock</th>
                <th className="px-3 py-2">Contract</th>
                <th className="px-3 py-2">Designations</th>
              </tr>
            </thead>
            <tbody>
              {run.programs.map((p) => (
                <tr key={p.slug} className="border-t border-line">
                  <td className="px-3 py-2 font-medium">{p.slug}</td>
                  <td className="px-3 py-2 font-mono-pe text-xs">
                    {p.competitorsWithApprovalDate ?? 0}/{p.competitors ?? 0}
                  </td>
                  <td className="px-3 py-2 font-mono-pe text-xs">
                    {p.orangeBookHits ?? 0} / {p.retrospectiveCompetitorHits ?? 0}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted">
                    {p.acceptedAt
                      ? `accepted ${shortIso(p.acceptedAt)}`
                      : p.expectedFilingAt
                        ? `filing ${shortIso(p.expectedFilingAt)}`
                        : "—"}
                    {p.reviewProgram && p.reviewProgram !== "unknown"
                      ? ` · ${p.reviewProgram}`
                      : ""}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {p.contractCoverage ? (
                      <span
                        className={
                          p.contractCoverage === "complete"
                            ? "font-semibold text-emerald-700"
                            : p.contractCoverage === "blocked"
                              ? "font-semibold text-rose-700"
                              : "text-amber-700"
                        }
                      >
                        {p.contractCoverage}
                      </span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted">
                    {(p.designations ?? []).join(", ") || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </li>
  );
}

export function KgMetricsView({ initial }: { initial: KgMetricsDashboard }) {
  const [data, setData] = useState(initial);
  const [log, setLog] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const datedRate = useMemo(
    () => pct(data.summary.competitorLinksDated, data.summary.competitorLinksTotal),
    [data.summary],
  );

  async function refresh() {
    const res = await fetch("/api/ops/kg");
    if (!res.ok) throw new Error(`kg metrics ${res.status}`);
    setData((await res.json()) as KgMetricsDashboard);
  }

  function runEnrich() {
    setLog(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/kg/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "enrich" }),
        });
        const body = (await res.json()) as {
          ok: boolean;
          stdoutTail?: string;
          stderrTail?: string;
          error?: string;
        };
        if (!body.ok) {
          setLog(body.stderrTail || body.error || "Enrich failed");
          return;
        }
        setLog(body.stdoutTail?.slice(-1200) ?? "OK");
        await refresh();
      } catch (err) {
        setLog(err instanceof Error ? err.message : String(err));
      }
    });
  }

  const s = data.summary;

  return (
    <div className="space-y-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-accent">Knowledge graph</p>
          <h1 className="font-display mt-1 text-3xl font-semibold text-ink">
            Metrics & enrichment
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Local fixture inventory, regulatory clock coverage, and append-only enrich history from{" "}
            <span className="font-mono-pe text-xs">pnpm kg:enrich</span>.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => runEnrich()}
            className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {pending ? "Running…" : "Run KG enrich"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => startTransition(() => void refresh())}
            className="rounded-md border border-line bg-white px-3 py-2 text-sm font-semibold text-ink disabled:opacity-50"
          >
            Refresh
          </button>
          <Link
            href="/platform"
            className="rounded-md border border-line bg-white px-3 py-2 text-sm font-semibold text-ink"
          >
            Platform
          </Link>
        </div>
      </header>

      {log ? (
        <pre className="max-h-40 overflow-auto rounded-md bg-slate-950 p-3 text-[11px] text-slate-100">
          {log}
        </pre>
      ) : null}

      <section className="grid gap-4 border-y border-line py-6 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Programs" value={String(s.programCount)} hint={`${s.liveProgramCount} live`} />
        <Stat
          label="Clock facts"
          value={String(s.withClockFacts)}
          hint={`${pct(s.withClockFacts, s.programCount)} of inventory`}
        />
        <Stat
          label="Competitor dates"
          value={datedRate}
          hint={`${s.competitorLinksDated}/${s.competitorLinksTotal} links`}
        />
        <Stat
          label="Last enrich"
          value={s.lastEnrichAt ? shortIso(s.lastEnrichAt) : "—"}
          hint={s.orangeBookCsvPresent ? "Orange Book local" : "no Orange Book CSV"}
        />
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-line bg-panel p-4">
          <p className="text-[11px] uppercase text-muted">Retrospective</p>
          <p className="mt-1 font-mono-pe text-2xl">{s.retrospectiveProgramCount}</p>
        </div>
        <div className="rounded-xl border border-line bg-panel p-4">
          <p className="text-[11px] uppercase text-muted">Approved / CRL+</p>
          <p className="mt-1 font-mono-pe text-2xl">
            {s.approvedCount} / {s.crlOrFailCount}
          </p>
        </div>
        <div className="rounded-xl border border-line bg-panel p-4">
          <p className="text-[11px] uppercase text-muted">Active</p>
          <p className="mt-1 font-mono-pe text-2xl">{s.activeCount}</p>
        </div>
        <div className="rounded-xl border border-line bg-panel p-4">
          <p className="text-[11px] uppercase text-muted">With designations</p>
          <p className="mt-1 font-mono-pe text-2xl">{s.withDesignations}</p>
        </div>
      </section>

      <section className="rounded-xl border border-line bg-panel p-5 shadow-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Coverage gaps
          </h2>
          <span
            className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
              data.coverageGaps.enrichStale
                ? "border-amber-300 bg-amber-50 text-amber-950"
                : "border-emerald-300 bg-emerald-50 text-emerald-900"
            }`}
          >
            {data.coverageGaps.enrichAgeHours == null
              ? "no enrich run"
              : data.coverageGaps.enrichStale
                ? `enrich ${data.coverageGaps.enrichAgeHours.toFixed(0)}h old`
                : `enrich ${data.coverageGaps.enrichAgeHours.toFixed(1)}h ago`}
          </span>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div>
            <h3 className="text-xs font-semibold uppercase text-muted">Live missing clock</h3>
            {data.coverageGaps.liveMissingClock.length === 0 ? (
              <p className="mt-2 text-sm text-muted">All live programs have ≥1 typed clock date.</p>
            ) : (
              <ul className="mt-2 space-y-2 text-sm">
                {data.coverageGaps.liveMissingClock.map((g) => (
                  <li key={g.slug} className="rounded-lg bg-amber-50/80 px-3 py-2">
                    <span className="font-medium text-ink">{g.drug}</span>
                    <span className="mt-0.5 block text-xs text-muted">{g.note}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase text-muted">
              Undated live competitors
            </h3>
            {data.coverageGaps.liveUndatedCompetitors.length === 0 ? (
              <p className="mt-2 text-sm text-muted">All live competitor links have approval dates.</p>
            ) : (
              <ul className="mt-2 space-y-2 text-sm">
                {data.coverageGaps.liveUndatedCompetitors.map((g) => (
                  <li key={g.slug} className="rounded-lg border border-line px-3 py-2">
                    <span className="font-medium text-ink">{g.drug}</span>
                    <span className="mt-1 block font-mono-pe text-[11px] text-muted">
                      {g.undated.join(", ")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        {data.coverageGaps.contractBlocked.length > 0 ? (
          <div className="mt-4">
            <h3 className="text-xs font-semibold uppercase text-muted">Contract-blocked markets</h3>
            <ul className="mt-2 space-y-2 text-sm">
              {data.coverageGaps.contractBlocked.map((g) => (
                <li key={g.polymarketId} className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2">
                  <Link href={`/ops/market/${g.polymarketId}`} className="font-medium text-rose-900 hover:underline">
                    {g.slug}
                  </Link>
                  <span className="mt-0.5 block text-xs text-rose-800">
                    {g.eventType} · missing {g.requiredMissing.join(", ")}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {data.coverageGaps.filingWatch.length > 0 ? (
          <div className="mt-4">
            <h3 className="text-xs font-semibold uppercase text-muted">Filing guidance watch</h3>
            <ul className="mt-2 space-y-2 text-sm">
              {data.coverageGaps.filingWatch.map((w) => (
                <li key={w.slug} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                  <span className="font-medium text-amber-950">{w.preferredName}</span>
                  <span className="mt-0.5 block text-xs text-amber-900">{w.sponsorName}</span>
                  <span className="mt-1 block text-xs text-amber-800">{w.operatorAction}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <BucketBars title="By therapeutic area" buckets={data.byTherapeuticArea} />
        <BucketBars title="By phase" buckets={data.byPhase} />
        <BucketBars title="By program status" buckets={data.byStatus} />
        <BucketBars title="By source corpus" buckets={data.bySource} />
      </section>

      <section>
        <h2 className="text-lg font-semibold text-ink">Live program clocks</h2>
        <p className="mt-1 text-sm text-muted">
          Track A fixtures under <span className="font-mono-pe text-xs">corpus/live</span>
        </p>
        <div className="mt-4 overflow-x-auto rounded-xl border border-line bg-panel shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-muted">
              <tr>
                <th className="px-3 py-2">Drug</th>
                <th className="px-3 py-2">App</th>
                <th className="px-3 py-2">Accepted</th>
                <th className="px-3 py-2">Filing guide</th>
                <th className="px-3 py-2">PDUFA</th>
                <th className="px-3 py-2">Review</th>
                <th className="px-3 py-2">Competitors</th>
                <th className="px-3 py-2">Designations</th>
              </tr>
            </thead>
            <tbody>
              {data.liveClocks.map((row) => (
                <tr key={row.slug} className="border-t border-line">
                  <td className="px-3 py-2">
                    <span className="font-medium">{row.drug}</span>
                    <span className="mt-0.5 block font-mono-pe text-[11px] text-muted">
                      {row.slug}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono-pe text-xs">
                    {row.applicationType ?? "—"}
                    {row.regulatoryAction ? ` · ${row.regulatoryAction}` : ""}
                  </td>
                  <td className="px-3 py-2 font-mono-pe text-xs">{shortIso(row.acceptedAt)}</td>
                  <td className="px-3 py-2 font-mono-pe text-xs">
                    {shortIso(row.expectedFilingAt)}
                  </td>
                  <td className="px-3 py-2 font-mono-pe text-xs">{shortIso(row.pdufaDate)}</td>
                  <td className="px-3 py-2 text-xs">{row.reviewProgram ?? "—"}</td>
                  <td className="px-3 py-2 font-mono-pe text-xs">
                    {row.competitorsDated}/{row.competitorsTotal}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted">
                    {row.designations.join(", ") || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-ink">Enrichment history</h2>
        <p className="mt-1 text-sm text-muted">
          Newest first · kept in{" "}
          <span className="font-mono-pe text-xs">fixtures/enrichment/enrich-history.json</span>
        </p>
        {data.enrichHistory.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-line bg-panel p-6 text-sm text-muted">
            No enrich runs recorded yet. Run KG enrich to create the first history entry.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {data.enrichHistory.map((run, i) => (
              <EnrichRunCard key={run.at} run={run} expanded={i === 0} />
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold text-ink">Track A seeds</h2>
        <div className="mt-4 overflow-x-auto rounded-xl border border-line bg-panel shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-muted">
              <tr>
                <th className="px-3 py-2">Drug</th>
                <th className="px-3 py-2">NCT</th>
                <th className="px-3 py-2">Markets</th>
                <th className="px-3 py-2">Notes</th>
              </tr>
            </thead>
            <tbody>
              {data.seeds.map((seed) => (
                <tr key={seed.slug} className="border-t border-line">
                  <td className="px-3 py-2 font-medium">{seed.preferredName}</td>
                  <td className="px-3 py-2 font-mono-pe text-xs">
                    <a
                      className="text-accent hover:underline"
                      href={`https://clinicaltrials.gov/study/${seed.nctId}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {seed.nctId}
                    </a>
                  </td>
                  <td className="px-3 py-2 font-mono-pe text-xs">
                    {seed.polymarketMarketIds.join(", ")}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted">{seed.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-xs text-muted">{data.disclaimer}</p>
    </div>
  );
}
