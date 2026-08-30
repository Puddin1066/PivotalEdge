import Link from "next/link";

import { buildOpsDashboard } from "@pivotaledge/workflows";

import { formatDateTime, pct } from "../../components/data-provenance";

export const dynamic = "force-dynamic";

export default async function OpsHistoryPage() {
  const dash = await buildOpsDashboard();
  const closed = dash.manual.closed;
  const paper = dash.paperPositions;

  return (
    <div className="space-y-10">
      <header>
        <p className="text-sm font-medium text-accent">History</p>
        <h1 className="font-display mt-1 text-3xl font-semibold text-ink">Closed & paper</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Manual fills that resolved, plus current paper BET_* (simulation — do not mix with manual
          PnL).
        </p>
      </header>

      <section>
        <h2 className="text-lg font-semibold text-ink">Manual closed</h2>
        {closed.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No resolved manual positions yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-[11px] uppercase tracking-wide text-muted">
                  <th className="py-2 pr-3 font-medium">Market</th>
                  <th className="py-2 pr-3 font-medium">Side</th>
                  <th className="py-2 pr-3 font-medium">Fill</th>
                  <th className="py-2 pr-3 font-medium">Outcome</th>
                  <th className="py-2 pr-3 font-medium">PnL</th>
                  <th className="py-2 font-medium">Closed</th>
                </tr>
              </thead>
              <tbody>
                {closed.map((p) => (
                  <tr key={p.id} className="border-b border-line/70">
                    <td className="py-3 pr-3">
                      <Link
                        href={`/ops/market/${p.marketId}`}
                        className="font-medium text-ink hover:text-accent"
                      >
                        {p.question}
                      </Link>
                    </td>
                    <td className="py-3 pr-3 font-mono-pe text-xs">{p.side}</td>
                    <td className="py-3 pr-3 font-mono-pe text-xs">{pct(p.fillPrice)}</td>
                    <td className="py-3 pr-3 text-xs">
                      {p.resolvedYes == null ? "—" : p.resolvedYes ? "YES" : "NO"}
                    </td>
                    <td className="py-3 pr-3 font-mono-pe text-xs">
                      {p.realizedPnL != null ? `$${p.realizedPnL.toFixed(2)}` : "—"}
                    </td>
                    <td className="py-3 font-mono-pe text-[11px] text-muted">
                      {p.closedAt ? formatDateTime(p.closedAt) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold text-ink">Paper (open simulation)</h2>
        <p className="mt-1 text-sm text-muted">
          From live-paper-report · BET_* open count {dash.paperOpen}
        </p>
        {paper.length === 0 ? (
          <p className="mt-2 text-sm text-muted">
            No paper positions. Use Refresh paper in the header.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-line border-y border-line">
            {paper.map((t) => (
              <li
                key={`${t.marketId}-${t.action}`}
                className="flex flex-wrap justify-between gap-2 py-3 text-sm"
              >
                <div>
                  <Link
                    href={`/ops/market/${t.marketId}`}
                    className="font-medium text-ink hover:text-accent"
                  >
                    {t.question}
                  </Link>
                  <p className="mt-1 text-xs text-muted">simulation only</p>
                </div>
                <span className="font-mono-pe text-xs text-muted">
                  {t.action} · edge {pct(t.netEdge)} · stake ${t.stake}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
