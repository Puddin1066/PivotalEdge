"use client";

import { useMemo, useState, useTransition } from "react";

import type { LiveScoredOpportunity, PlatformDashboard } from "@pivotaledge/workflows";

import { LaneBadge, TradabilityBadge, formatDateTime, pct } from "./data-provenance";

type SortKey = "absEdge" | "modelP" | "yesAsk" | "action";

function actionClass(action: string): string {
  if (action === "BET_YES") return "bg-emerald-100 text-emerald-900 border-emerald-300";
  if (action === "BET_NO") return "bg-rose-100 text-rose-900 border-rose-300";
  if (action === "WAIT") return "bg-amber-100 text-amber-900 border-amber-300";
  return "bg-slate-100 text-slate-700 border-slate-300";
}

function rankScore(o: LiveScoredOpportunity): number {
  const conf =
    o.evidenceConfidence === "high" ? 1 : o.evidenceConfidence === "moderate" ? 0.7 : 0.4;
  return Math.abs(o.netEdge) * 100 + (o.stake / 50) * conf;
}

export function PlatformConsole({ initial }: { initial: PlatformDashboard }) {
  const [data, setData] = useState(initial);
  const [sortKey, setSortKey] = useState<SortKey>("absEdge");
  const [log, setLog] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const ranked = useMemo(() => {
    const rows = [...data.opportunities];
    rows.sort((a, b) => {
      if (sortKey === "modelP") return b.modelP - a.modelP;
      if (sortKey === "yesAsk") return (b.yesBestAsk ?? 0) - (a.yesBestAsk ?? 0);
      if (sortKey === "action") return a.action.localeCompare(b.action);
      return rankScore(b) - rankScore(a);
    });
    return rows;
  }, [data.opportunities, sortKey]);

  async function refresh() {
    const res = await fetch("/api/platform");
    if (!res.ok) throw new Error(`platform ${res.status}`);
    const next = (await res.json()) as PlatformDashboard;
    setData(next);
  }

  function runAction(
    action: "enrich" | "score-live" | "retro-validate" | "quotes-snapshot" | "paper-live",
  ) {
    setLog(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/kg/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });
        const body = (await res.json()) as {
          ok: boolean;
          stdoutTail?: string;
          stderrTail?: string;
          error?: string;
        };
        if (!body.ok) {
          setLog(body.stderrTail || body.error || "Command failed");
          return;
        }
        setLog(body.stdoutTail?.slice(-1500) ?? "OK");
        await refresh();
      } catch (err) {
        setLog(err instanceof Error ? err.message : String(err));
      }
    });
  }

  return (
    <div className="space-y-10">
      <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Decision logic
          </h2>
          <ol className="mt-4 space-y-3">
            {data.logic.map((step) => (
              <li key={step.step} className="flex gap-3 text-sm">
                <span className="shrink-0 font-mono text-xs font-semibold text-accent">
                  {step.step}
                </span>
                <span className="text-ink">{step.detail}</span>
              </li>
            ))}
          </ol>
          <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-muted">{data.disclaimer}</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Enrichment controls
          </h2>
          <p className="mt-2 text-sm text-muted">
            Track A: CT.gov + Open Targets for Polymarket-seeded programs, then rescore vs live
            CLOB.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => runAction("enrich")}
              className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {pending ? "Running…" : "Run KG enrich"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => runAction("score-live")}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-ink disabled:opacity-50"
            >
              Rescore vs CLOB
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => runAction("retro-validate")}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-ink disabled:opacity-50"
            >
              Run retrospective
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => runAction("quotes-snapshot")}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-ink disabled:opacity-50"
            >
              Snapshot CLOB asks
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => runAction("paper-live")}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-ink disabled:opacity-50"
            >
              Open paper positions
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => startTransition(() => void refresh())}
              className="rounded-md border border-slate-200 px-3 py-2 text-sm text-muted"
            >
              Refresh
            </button>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-2 text-xs text-muted">
            <div>
              <dt>Last enrich</dt>
              <dd className="font-mono text-ink">{formatDateTime(data.enrichment.lastEnrichAt)}</dd>
            </div>
            <div>
              <dt>Last score</dt>
              <dd className="font-mono text-ink">{formatDateTime(data.enrichment.lastScoreAt)}</dd>
            </div>
          </dl>
          {log ? (
            <pre className="mt-3 max-h-40 overflow-auto rounded-md bg-slate-950 p-3 text-[11px] text-slate-100">
              {log}
            </pre>
          ) : null}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Retrospective Track B
          </h2>
          {data.retrospective ? (
            <span
              className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                data.retrospective.passed
                  ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                  : "border-rose-300 bg-rose-50 text-rose-900"
              }`}
            >
              {data.retrospective.passed ? "GATE PASS" : "GATE FAIL"}
            </span>
          ) : (
            <span className="text-xs text-muted">No report yet — run retrospective</span>
          )}
        </div>
        {data.retrospective ? (
          <>
            <p className="mt-2 text-xs text-muted">
              Last run {formatDateTime(data.retrospective.at)} · ask provenance:{" "}
              <span className="font-mono">{data.retrospective.resolvedMarkets.askProvenance}</span>
            </p>
            <dl className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg bg-slate-50 p-3">
                <dt className="text-[11px] uppercase text-muted">Clinical S8b</dt>
                <dd className="mt-1 font-mono text-sm">
                  Brier {data.retrospective.clinical.calibratedBrier.toFixed(4)} vs base{" "}
                  {data.retrospective.clinical.baseRateBrier.toFixed(4)}
                </dd>
                <dd className="text-xs text-muted">
                  {data.retrospective.clinical.totalCases} cases ·{" "}
                  {data.retrospective.clinical.testCases} OOS
                </dd>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <dt className="text-[11px] uppercase text-muted">Resolved markets</dt>
                <dd className="mt-1 font-mono text-sm">
                  Model {data.retrospective.resolvedMarkets.modelBrier.toFixed(4)} vs mkt{" "}
                  {data.retrospective.resolvedMarkets.marketBrier.toFixed(4)}
                </dd>
                <dd className="text-xs text-muted">
                  n={data.retrospective.resolvedMarkets.scoredCases}
                  {data.retrospective.resolvedMarkets.beatsMarketBrier
                    ? " · beats mkt Brier"
                    : " · Brier trails mkt"}
                  {data.retrospective.resolvedMarkets.beatsMarketAfterCosts
                    ? " · edge+"
                    : " · edge−"}
                </dd>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <dt className="text-[11px] uppercase text-muted">Synthetic edge smoke</dt>
                <dd className="mt-1 font-mono text-sm">
                  Δ {data.retrospective.syntheticEdgeSmoke.edgeVsMarket.toFixed(2)} · trades{" "}
                  {data.retrospective.syntheticEdgeSmoke.totalTrades}
                </dd>
                <dd className="text-xs text-muted">
                  {data.retrospective.syntheticEdgeSmoke.beatsMarketAfterCosts
                    ? "beats market after costs"
                    : "does not beat market"}
                </dd>
              </div>
            </dl>
            {data.retrospective.blockers.length > 0 ? (
              <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-rose-800">
                {data.retrospective.blockers.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            ) : null}
          </>
        ) : (
          <p className="mt-3 text-sm text-muted">
            Clinical chrono Brier + Jul-2025 resolved Polymarket Brier vs curated asks.
          </p>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Trading stack readiness
          </h2>
          {data.trading ? (
            <span
              className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                data.trading.paperReady
                  ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                  : "border-amber-300 bg-amber-50 text-amber-950"
              }`}
            >
              {data.trading.paperReady ? "BAR A PAPER-READY" : "BAR A INCOMPLETE"}
              {" · "}
              {data.trading.clinicalConviction.toUpperCase()} CONVICTION
            </span>
          ) : (
            <span className="text-xs text-muted">Snapshot asks, then open paper</span>
          )}
        </div>
        {data.trading ? (
          <>
            <p className="mt-2 text-xs text-muted">
              Last {formatDateTime(data.trading.at)} · live trading always off · quote vault{" "}
              {data.trading.quoteVaultRows} rows / {data.trading.quoteVaultMarkets} markets
              {data.trading.quoteVaultDistinctDays != null
                ? ` / ${data.trading.quoteVaultDistinctDays} UTC day(s)`
                : ""}{" "}
              · open paper {data.trading.openPaperPositions} ({data.trading.openBetActions} BET_*)
            </p>
            {data.trading.blockers.length > 0 ? (
              <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-amber-900">
                {data.trading.blockers.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-xs text-emerald-800">
                Paper path clear. Keep snapshotting asks until conviction graduates off DEMO.
              </p>
            )}
          </>
        ) : (
          <p className="mt-3 text-sm text-muted">
            Bar A needs clinical+KG gates and a CLOB ask archive (`pnpm quotes:snapshot`).
          </p>
        )}
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-ink">Ranked opportunities</h2>
            <p className="mt-1 text-sm text-muted">
              Sorted locally · LIVE asks · clinical conviction from readiness report (live
              execution off)
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm text-muted">
            Rank by
            <select
              className="rounded border border-slate-300 bg-white px-2 py-1 text-ink"
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
            >
              <option value="absEdge">|net edge| (default)</option>
              <option value="modelP">Model P(YES)</option>
              <option value="yesAsk">YES best ask</option>
              <option value="action">Action</option>
            </select>
          </label>
        </div>

        {ranked.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-muted">
            No live scores yet. Run KG enrich, then Rescore vs CLOB.
          </p>
        ) : (
          <ul className="space-y-3">
            {ranked.map((o, idx) => (
              <li
                key={`${o.polymarketId}-${o.slug}`}
                className="rounded-xl border border-slate-200 bg-white p-4 transition hover:border-accent"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-muted">#{idx + 1}</span>
                      <LaneBadge lane={o.dataLane} />
                      <TradabilityBadge tradability={o.tradability} />
                      <span className="text-xs text-muted">{o.slug}</span>
                    </div>
                    <a
                      href={o.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 block font-medium text-ink hover:text-accent"
                    >
                      {o.question}
                    </a>
                    <p className="mt-2 text-xs text-muted">{o.thesis}</p>
                    <p className="mt-1 text-[11px] text-amber-800">{o.clinicalNote}</p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${actionClass(o.action)}`}
                  >
                    {o.action.replaceAll("_", " ")}
                  </span>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
                  <div>
                    <dt className="text-[11px] uppercase text-muted">Model P</dt>
                    <dd className="font-mono text-sm">{pct(o.modelP)}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase text-muted">Cons. P</dt>
                    <dd className="font-mono text-sm">{pct(o.conservativeP)}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase text-muted">YES ask</dt>
                    <dd className="font-mono text-sm">{pct(o.yesBestAsk)}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase text-muted">NO ask</dt>
                    <dd className="font-mono text-sm">{pct(o.noBestAsk)}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase text-muted">Net edge</dt>
                    <dd className="font-mono text-sm font-semibold">{pct(o.netEdge)}</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-xl font-semibold text-ink">Enrichment seeds</h2>
        <p className="mt-1 text-sm text-muted">Polymarket-prioritized programs (Track A)</p>
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-3 py-2">Drug</th>
                <th className="px-3 py-2">NCT</th>
                <th className="px-3 py-2">Markets</th>
                <th className="px-3 py-2">Notes</th>
              </tr>
            </thead>
            <tbody>
              {data.enrichment.seeds.map((s) => (
                <tr key={s.slug} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-medium">{s.preferredName}</td>
                  <td className="px-3 py-2 font-mono text-xs">
                    <a
                      className="text-accent hover:underline"
                      href={`https://clinicaltrials.gov/study/${s.nctId}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {s.nctId}
                    </a>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{s.polymarketMarketIds.join(", ")}</td>
                  <td className="px-3 py-2 text-xs text-muted">{s.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xl font-semibold text-ink">Clinical KG inventory</h2>
          <p className="text-sm text-muted">
            {data.kg.programCount} programs · {data.kg.liveProgramCount} live-enriched
          </p>
        </div>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-3 py-2">Drug</th>
                <th className="px-3 py-2">TA / phase</th>
                <th className="px-3 py-2">Trial</th>
                <th className="px-3 py-2">PE met</th>
                <th className="px-3 py-2">Designations</th>
                <th className="px-3 py-2">Comp.</th>
                <th className="px-3 py-2">Source</th>
              </tr>
            </thead>
            <tbody>
              {data.kg.programs.map((p) => (
                <tr key={p.programId} className="border-t border-slate-100">
                  <td className="px-3 py-2">
                    <span className="font-medium">{p.drug}</span>
                    {p.live ? (
                      <span className="ml-2 rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold text-sky-800">
                        LIVE KG
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted">
                    {p.therapeuticArea ?? "—"} · {p.phase ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {p.trialStatus ?? "—"}
                    {p.enrollment != null ? ` · n=${p.enrollment}` : ""}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {p.primaryEndpointMet == null ? "—" : p.primaryEndpointMet ? "true" : "false"}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted">
                    {p.designations.length ? p.designations.join(", ") : "—"}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{p.approvedTherapyCount}</td>
                  <td className="px-3 py-2 font-mono text-[11px] text-muted">{p.sourcePath}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
