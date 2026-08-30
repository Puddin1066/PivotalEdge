"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";

import type { PortfolioRiskReport, PortfolioRiskScenarioId } from "@pivotaledge/schemas";

import { pct } from "./data-provenance";

function money(n: number): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toFixed(0)}`;
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="border-l border-line pl-4">
      <p className="text-[11px] uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 font-mono-pe text-2xl font-medium tabular-nums text-ink">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export function OpsRiskView({ initial }: { initial: PortfolioRiskReport }) {
  const [report, setReport] = useState(initial);
  const [stakeInput, setStakeInput] = useState(String(Math.round(initial.evaluationStake) || 100));
  const [scenario, setScenario] = useState<PortfolioRiskScenarioId>(
    initial.stress.scenarioId ?? "fda_delay_year",
  );
  const [mode, setMode] = useState<"conservative" | "model">(initial.probabilityMode);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const maxBucket = useMemo(
    () => Math.max(...report.distribution.buckets.map((b) => b.probability), 0.01),
    [report.distribution.buckets],
  );

  function reload(next: {
    stake?: number;
    scenario?: PortfolioRiskScenarioId;
    mode?: "conservative" | "model";
  }) {
    const stake = next.stake ?? Number(stakeInput);
    const sc = next.scenario ?? scenario;
    const md = next.mode ?? mode;
    setError(null);
    startTransition(async () => {
      try {
        const qs = new URLSearchParams({
          stake: String(stake),
          scenario: sc,
          mode: md,
        });
        const res = await fetch(`/api/ops/risk?${qs}`);
        if (!res.ok) throw new Error(`risk ${res.status}`);
        const body = (await res.json()) as PortfolioRiskReport;
        setReport(body);
        setScenario(body.stress.scenarioId ?? sc);
        setMode(body.probabilityMode);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  const illustrative = report.clinicalConviction === "demo" || !report.asksFresh;

  return (
    <div className="space-y-10">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-accent">Risk</p>
          <span className="rounded-full border border-teal-300 bg-accent-soft px-2.5 py-0.5 text-[11px] font-semibold text-teal-950">
            RISK ENGINE {report.riskVersion}
          </span>
        </div>
        <h1 className="font-display text-3xl font-semibold text-ink">Portfolio risk</h1>
        <p className="max-w-2xl text-sm text-muted">
          Point EV assumes independent line outcomes — not that you win every bet. This page shows
          uncertainty, correlation scenarios, liquidity, and the loss distribution for the current
          suggestion.
        </p>
        <p className="font-mono-pe text-xs text-muted">
          {report.portfolioRef.policyVersion} · bankroll ${report.portfolioRef.bankroll.toLocaleString()} ·
          deploy ${report.portfolioRef.deployed.toFixed(0)} / ${report.portfolioRef.deployBudget.toFixed(0)} ·{" "}
          {report.portfolioRef.lineCount} lines
        </p>
        <p className="text-sm">
          <Link href="/ops/portfolio" className="font-semibold text-accent hover:underline">
            Edit / view sizes on Portfolio →
          </Link>
        </p>
      </header>

      {illustrative ? (
        <aside className="rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-950">
          Risk numbers are illustrative — do not size up
          {report.clinicalConviction === "demo" ? " (DEMO conviction)" : ""}
          {!report.asksFresh ? " (asks stale)" : ""}.
        </aside>
      ) : null}

      <section className="grid gap-6 border-y border-line py-6 sm:grid-cols-4">
        <Stat
          label="Naive EV"
          value={money(report.naive.expectedPnl)}
          hint={`${(report.naive.expectedReturnOnStake * 100).toFixed(0)}% on stake · indep.`}
        />
        <Stat
          label="Stress EV"
          value={money(report.stress.expectedPnl)}
          hint={report.stress.scenarioId?.replaceAll("_", " ") ?? "scenario"}
        />
        <Stat
          label="P(loss)"
          value={`${(report.distribution.pLoss * 100).toFixed(0)}%`}
          hint="Under selected stress distribution"
        />
        <Stat
          label="Fragile lines"
          value={String(report.fragileCount)}
          hint={`${report.liquidityOkCount}/${report.lines.length} liquidity-OK`}
        />
      </section>

      <section className="text-sm text-muted">
        <p className="font-semibold text-ink">How to read this</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            <strong className="text-ink">Naive EV</strong> = sum of single-bet EVs (average over
            win/lose — not “win the whole book”; assumes independence).
          </li>
          <li>
            <strong className="text-ink">Stress</strong> = same stakes when FDA-timing / TA shocks
            hit several names; non-fillable lines treated as flat.
          </li>
          <li>
            <strong className="text-ink">Liquidity</strong> = if you cannot fill the ask depth, that
            line’s EV is fantasy.
          </li>
        </ul>
        <p className="mt-3 rounded-md border border-line bg-surface px-3 py-2 text-ink">
          {report.riskStatement}
        </p>
      </section>

      <section className="rounded-xl border border-line bg-panel p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-ink">Loss distribution</h2>
        <p className="mt-1 text-sm text-muted">
          Method: <span className="font-mono-pe text-xs">{report.distribution.method}</span>
          {report.distribution.scenarioId
            ? ` · scenario ${report.distribution.scenarioId}`
            : ""}
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="text-muted">Evaluate at $</span>
            <input
              type="number"
              min={1}
              step={1}
              value={stakeInput}
              onChange={(e) => setStakeInput(e.target.value)}
              className="ml-2 w-24 rounded-md border border-line bg-white px-2 py-1.5 font-mono-pe text-ink"
            />
          </label>
          <button
            type="button"
            disabled={pending}
            onClick={() => reload({ stake: Number(stakeInput) })}
            className="rounded-md bg-ink px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {pending ? "Updating…" : "Apply"}
          </button>
          {[50, 100, Math.round(report.portfolioRef.deployed) || 0]
            .filter((n, i, a) => n > 0 && a.indexOf(n) === i)
            .map((n) => (
              <button
                key={n}
                type="button"
                disabled={pending}
                onClick={() => {
                  setStakeInput(String(n));
                  reload({ stake: n });
                }}
                className="rounded-md border border-line bg-white px-3 py-1.5 text-xs font-semibold text-ink"
              >
                ${n}
                {n === Math.round(report.portfolioRef.deployed) ? " (suggested)" : ""}
              </button>
            ))}
          <label className="ml-auto text-sm text-muted">
            P mode
            <select
              className="ml-2 rounded border border-line bg-white px-2 py-1 text-ink"
              value={mode}
              onChange={(e) => {
                const m = e.target.value as "conservative" | "model";
                setMode(m);
                reload({ mode: m });
              }}
            >
              <option value="conservative">Conservative</option>
              <option value="model">Model</option>
            </select>
          </label>
        </div>
        {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}

        <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5 text-sm">
          <div>
            <dt className="text-[11px] uppercase text-muted">Mean PnL</dt>
            <dd className="font-mono-pe">{money(report.distribution.meanPnl)}</dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase text-muted">P(PnL&lt;0)</dt>
            <dd className="font-mono-pe">{(report.distribution.pLoss * 100).toFixed(0)}%</dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase text-muted">P(≤ −50%)</dt>
            <dd className="font-mono-pe">{(report.distribution.pLossHalf * 100).toFixed(0)}%</dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase text-muted">5th pct</dt>
            <dd className="font-mono-pe">{money(report.distribution.p05Pnl)}</dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase text-muted">95th pct</dt>
            <dd className="font-mono-pe">{money(report.distribution.p95Pnl)}</dd>
          </div>
        </dl>

        <ul className="mt-6 space-y-2">
          {report.distribution.buckets.map((b) => (
            <li key={b.id} className="flex items-center gap-3 text-sm">
              <span className="w-28 shrink-0 font-mono-pe text-[11px] text-muted">{b.label}</span>
              <div className="h-3 flex-1 rounded bg-surface">
                <div
                  className="h-3 rounded bg-accent/80"
                  style={{ width: `${(b.probability / maxBucket) * 100}%` }}
                />
              </div>
              <span className="w-12 text-right font-mono-pe text-xs">
                {(b.probability * 100).toFixed(0)}%
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted">
          Buckets are return on the evaluation stake. Average across outcomes — not a guaranteed
          profit.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-ink">Scenarios</h2>
        <p className="mt-1 text-sm text-muted">Select one to drive stress EV and the distribution.</p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-line text-[11px] uppercase tracking-wide text-muted">
                <th className="py-2 pr-3 font-medium">Scenario</th>
                <th className="py-2 pr-3 font-medium">EV</th>
                <th className="py-2 pr-3 font-medium">P(loss)</th>
                <th className="py-2 font-medium">Note</th>
              </tr>
            </thead>
            <tbody>
              {report.scenarios.map((s) => {
                const active = s.id === scenario;
                return (
                  <tr
                    key={s.id}
                    className={`cursor-pointer border-b border-line/70 ${active ? "bg-accent-soft/40" : "hover:bg-surface"}`}
                    onClick={() => {
                      setScenario(s.id);
                      reload({ scenario: s.id });
                    }}
                  >
                    <td className="py-3 pr-3 font-medium">
                      {s.label}
                      {active ? (
                        <span className="ml-2 text-[10px] uppercase text-accent">selected</span>
                      ) : null}
                    </td>
                    <td className="py-3 pr-3 font-mono-pe text-xs">{money(s.expectedPnl)}</td>
                    <td className="py-3 pr-3 font-mono-pe text-xs">
                      {(s.pLoss * 100).toFixed(0)}%
                    </td>
                    <td className="py-3 text-xs text-muted">{s.note}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-ink">Fragility & liquidity</h2>
        {report.lines.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            No suggested deploy — see Portfolio / Rescore live.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-[11px] uppercase tracking-wide text-muted">
                  <th className="py-2 pr-3 font-medium">Market</th>
                  <th className="py-2 pr-3 font-medium">Ask</th>
                  <th className="py-2 pr-3 font-medium">P(win)</th>
                  <th className="py-2 pr-3 font-medium">Cushion</th>
                  <th className="py-2 pr-3 font-medium">Naive EV</th>
                  <th className="py-2 pr-3 font-medium">Stress EV</th>
                  <th className="py-2 font-medium">Flags</th>
                </tr>
              </thead>
              <tbody>
                {report.lines.map((l) => (
                  <tr key={l.marketId} className="border-b border-line/70 align-top">
                    <td className="py-3 pr-3">
                      <Link href={l.href} className="font-medium text-ink hover:text-accent">
                        {l.side} · {l.question}
                      </Link>
                      <p className="mt-1 font-mono-pe text-[11px] text-muted">
                        ${l.stake.toFixed(0)} stake
                        {l.fragile ? " · FRAGILE" : ""}
                        {!l.fillable ? " · NOT FILLABLE" : ""}
                      </p>
                    </td>
                    <td className="py-3 pr-3 font-mono-pe text-xs">{pct(l.ask)}</td>
                    <td className="py-3 pr-3 font-mono-pe text-xs">{pct(l.pWin)}</td>
                    <td className="py-3 pr-3 font-mono-pe text-xs">
                      {(l.cushionPp * 100).toFixed(1)}pp
                    </td>
                    <td className="py-3 pr-3 font-mono-pe text-xs">{money(l.naiveEv)}</td>
                    <td className="py-3 pr-3 font-mono-pe text-xs">{money(l.stressEv)}</td>
                    <td className="py-3 text-xs text-muted">
                      {l.liquidityFlags.length ? l.liquidityFlags.join(", ") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {report.excluded.length > 0 ? (
        <section>
          <h2 className="text-lg font-semibold text-ink">Portfolio exclusions</h2>
          <ul className="mt-3 divide-y divide-line border-y border-line text-sm">
            {report.excluded.map((e) => (
              <li
                key={`${e.marketId}-${e.reason}`}
                className="flex flex-wrap justify-between gap-2 py-2"
              >
                <span>{e.question ?? e.slug ?? e.marketId}</span>
                <span className="font-mono-pe text-xs text-muted">{e.reason}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Engine notes</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted">
          {report.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-muted">
          Adjust sizes on Portfolio · place fills yourself · Log fill in Book. Spec:{" "}
          <code className="font-mono-pe text-xs">docs/UI_OPS_RISK_SPEC.md</code>
        </p>
      </section>
    </div>
  );
}
