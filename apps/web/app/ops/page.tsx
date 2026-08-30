import Link from "next/link";

import { buildOpsDashboard } from "@pivotaledge/workflows";

import { EdgesTable } from "../components/ops-edges-table";
import { formatDateTime, pct } from "../components/data-provenance";
import { Stat } from "../components/ops-ui";

export const dynamic = "force-dynamic";

export default async function OpsTodayPage() {
  const dash = await buildOpsDashboard();
  const edgeCount = dash.platform.opportunities.filter((o) => Math.abs(o.netEdge) >= 0.05).length;
  const conviction = dash.trading?.clinicalConviction ?? "demo";

  return (
    <div className="space-y-10">
      <section>
        <p className="text-sm font-medium text-accent">Today</p>
        <h1 className="font-display mt-1 text-3xl font-semibold text-ink">What needs attention</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Start here. Fix broken marks and ending markets before hunting new edges. Recommendations
          are decision support — fills happen on Polymarket, then you log them in Book.
        </p>
      </section>

      <section className="grid gap-6 border-y border-line py-6 sm:grid-cols-4">
        <Stat label="Open manual" value={String(dash.manual.open.length)} hint="Your logged fills" />
        <Stat label="Open paper" value={String(dash.paperOpen)} hint="Simulated BET_* only" />
        <Stat label="Edges ≥ 5pp" value={String(edgeCount)} hint="Policy min net edge" />
        <Stat
          label="Ask status"
          value={dash.asksFresh ? "Fresh" : "Stale"}
          hint={dash.lastAskAt ? formatDateTime(dash.lastAskAt) : "No vault yet"}
        />
      </section>

      <section>
        <h2 className="text-lg font-semibold text-ink">Attention</h2>
        <p className="mt-1 text-sm text-muted">Highest severity first — max eight items.</p>
        {dash.attention.length === 0 ? (
          <p className="mt-4 text-sm text-muted">Nothing urgent. Review top edges below.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {dash.attention.map((a) => (
              <li key={a.id} className="flex gap-3 border-l-2 border-accent pl-4">
                <div>
                  <Link href={a.href} className="text-sm font-semibold text-ink hover:text-accent">
                    {a.title}
                  </Link>
                  <p className="mt-1 text-sm text-muted">{a.detail}</p>
                  <p className="mt-1 text-[11px] uppercase tracking-wide text-muted">
                    {a.severity} · {a.kind.replaceAll("_", " ")}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <div className="mb-4 flex items-baseline justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-ink">Portfolio suggestion</h2>
            <p className="mt-1 text-sm text-muted">
              {dash.portfolio.policyVersion}: deploy ${dash.portfolio.deployed.toFixed(0)} of $
              {dash.portfolio.deployBudget.toFixed(0)} across {dash.portfolio.lineCount} lines.
            </p>
          </div>
          <Link
            href="/ops/portfolio"
            className="text-sm font-semibold text-accent hover:underline"
          >
            Full portfolio →
          </Link>
        </div>
        {dash.portfolio.lines.length === 0 ? (
          <p className="text-sm text-muted">No sized lines yet.</p>
        ) : (
          <ul className="divide-y divide-line border-y border-line">
            {dash.portfolio.lines.slice(0, 3).map((line) => (
              <li
                key={line.marketId}
                className="flex flex-wrap items-baseline justify-between gap-2 py-3 text-sm"
              >
                <div>
                  <span className="font-semibold">{line.side}</span>{" "}
                  <Link href={line.href} className="hover:text-accent">
                    {line.question}
                  </Link>
                </div>
                <div className="font-mono-pe text-xs text-muted">
                  ${line.suggestedNotional.toFixed(0)} · {(line.weightOfDeploy * 100).toFixed(0)}%
                  deploy · edge {pct(line.netEdge)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <div className="mb-4 flex items-baseline justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-ink">Top edges</h2>
            <p className="mt-1 text-sm text-muted">Largest |net edge| right now.</p>
          </div>
          <Link href="/ops/edges" className="text-sm font-semibold text-accent hover:underline">
            All edges →
          </Link>
        </div>
        <EdgesTable
          opportunities={dash.platform.opportunities}
          conviction={conviction}
          compact
        />
      </section>

      <section>
        <div className="mb-4 flex items-baseline justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-ink">Open book</h2>
            <p className="mt-1 text-sm text-muted">Manual positions only.</p>
          </div>
          <Link href="/ops/book" className="text-sm font-semibold text-accent hover:underline">
            Full book →
          </Link>
        </div>
        {dash.manual.open.length === 0 ? (
          <p className="text-sm text-muted">No open fills.</p>
        ) : (
          <ul className="divide-y divide-line border-y border-line">
            {dash.manual.open.slice(0, 6).map((p) => (
              <li key={p.id} className="flex flex-wrap items-baseline justify-between gap-2 py-3 text-sm">
                <div>
                  <span className="font-semibold">{p.side}</span>{" "}
                  <Link href={`/ops/market/${p.marketId}`} className="hover:text-accent">
                    {p.question}
                  </Link>
                </div>
                <div className="font-mono-pe text-xs text-muted">
                  in {pct(p.fillPrice)} · mark {pct(p.markAsk)}
                  {p.unrealizedPnL != null ? ` · uPnL $${p.unrealizedPnL.toFixed(0)}` : ""}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
