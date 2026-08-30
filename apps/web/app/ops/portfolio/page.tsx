import Link from "next/link";

import { buildOpsDashboard } from "@pivotaledge/workflows";

import { formatDate, pct } from "../../components/data-provenance";
import { actionTone } from "../../components/ops-ui";

export const dynamic = "force-dynamic";

export default async function OpsPortfolioPage() {
  const dash = await buildOpsDashboard();
  const p = dash.portfolio;

  return (
    <div className="space-y-10">
      <header>
        <p className="text-sm font-medium text-accent">Portfolio</p>
        <h1 className="font-display mt-1 text-3xl font-semibold text-ink">
          Edge-weighted deploy
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          {p.policyVersion}: size BET_* by edge × confidence × liquidity, then clamp by program /
          TA / deadline-quarter caps. Suggestion only — not an order ticket.
        </p>
        <p className="mt-3 text-sm">
          <Link href="/ops/risk" className="font-semibold text-accent hover:underline">
            See how this book dies →
          </Link>
        </p>
      </header>

      <section className="grid gap-6 border-y border-line py-6 sm:grid-cols-4">
        <div className="border-l border-line pl-4">
          <p className="text-[11px] uppercase tracking-wide text-muted">Deploy budget</p>
          <p className="mt-1 font-mono-pe text-2xl tabular-nums">${p.deployBudget.toFixed(0)}</p>
          <p className="mt-1 text-xs text-muted">of ${p.bankroll.toLocaleString()} bankroll</p>
        </div>
        <div className="border-l border-line pl-4">
          <p className="text-[11px] uppercase tracking-wide text-muted">Suggested deploy</p>
          <p className="mt-1 font-mono-pe text-2xl tabular-nums">${p.deployed.toFixed(0)}</p>
          <p className="mt-1 text-xs text-muted">{p.lineCount} lines</p>
        </div>
        <div className="border-l border-line pl-4">
          <p className="text-[11px] uppercase tracking-wide text-muted">Cash reserve</p>
          <p className="mt-1 font-mono-pe text-2xl tabular-nums">${p.cashReserve.toFixed(0)}</p>
          <p className="mt-1 text-xs text-muted">unused deploy budget</p>
        </div>
        <div className="border-l border-line pl-4">
          <p className="text-[11px] uppercase tracking-wide text-muted">Conviction</p>
          <p className="mt-1 font-mono-pe text-2xl tabular-nums">
            {p.clinicalConviction.toUpperCase()}
          </p>
          <p className="mt-1 text-xs text-muted">
            asks {p.asksFresh ? "fresh" : "stale"}
          </p>
        </div>
      </section>

      <aside className="rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-950">
        {p.riskStatement}
      </aside>

      <section>
        <h2 className="text-lg font-semibold text-ink">Suggested lines</h2>
        {p.lines.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            No eligible BET_* after filters/caps. Rescore live or wait for edges ≥ policy min.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-[11px] uppercase tracking-wide text-muted">
                  <th className="py-2 pr-3 font-medium">Market</th>
                  <th className="py-2 pr-3 font-medium">Side</th>
                  <th className="py-2 pr-3 font-medium">Edge</th>
                  <th className="py-2 pr-3 font-medium">Suggest $</th>
                  <th className="py-2 pr-3 font-medium">Weight</th>
                  <th className="py-2 pr-3 font-medium">TA · cluster</th>
                  <th className="py-2 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody>
                {p.lines.map((line) => (
                  <tr key={line.marketId} className="border-b border-line/70 align-top">
                    <td className="py-3 pr-3">
                      <Link
                        href={line.href}
                        className="font-medium text-ink hover:text-accent"
                      >
                        {line.question}
                      </Link>
                      <p className="mt-1 font-mono-pe text-[11px] text-muted">{line.slug}</p>
                    </td>
                    <td className="py-3 pr-3">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${actionTone(line.action)}`}
                      >
                        {line.side}
                      </span>
                    </td>
                    <td className="py-3 pr-3 font-mono-pe text-xs">{pct(line.netEdge)}</td>
                    <td className="py-3 pr-3 font-mono-pe text-xs">
                      ${line.suggestedNotional.toFixed(0)}
                      {line.uncappedNotional > line.suggestedNotional + 0.5 ? (
                        <span className="mt-1 block text-muted">
                          uncapped ${line.uncappedNotional.toFixed(0)}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-3 pr-3 font-mono-pe text-xs">
                      {(line.weightOfDeploy * 100).toFixed(1)}%
                    </td>
                    <td className="py-3 pr-3 text-xs text-muted">
                      {line.therapeuticArea}
                      <span className="mt-1 block font-mono-pe">
                        {line.deadlineCluster}
                        {line.eventDeadline
                          ? ` · ${formatDate(line.eventDeadline)}`
                          : ""}
                      </span>
                    </td>
                    <td className="py-3 text-xs text-muted">
                      {line.evidenceConfidence}
                      {line.haircuts.length
                        ? ` · ${line.haircuts.join(", ")}`
                        : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {p.excluded.length > 0 ? (
        <section>
          <h2 className="text-lg font-semibold text-ink">Excluded</h2>
          <ul className="mt-3 divide-y divide-line border-y border-line text-sm">
            {p.excluded.map((e) => (
              <li
                key={`${e.marketId}-${e.reason}`}
                className="flex flex-wrap justify-between gap-2 py-2"
              >
                <span className="max-w-xl">{e.question ?? e.slug ?? e.marketId}</span>
                <span className="font-mono-pe text-xs text-muted">{e.reason}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Policy notes</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted">
          {p.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-muted">
          Spec:{" "}
          <code className="font-mono-pe">docs/PORTFOLIO_POLICY_SPEC.md</code> · ADR 0016
        </p>
      </section>
    </div>
  );
}
