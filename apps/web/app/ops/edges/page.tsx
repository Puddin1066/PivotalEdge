import { buildOpsDashboard, loadEdgeScanReport } from "@pivotaledge/workflows";

import { EdgesTable } from "../../components/ops-edges-table";

export const dynamic = "force-dynamic";

export default async function OpsEdgesPage() {
  const [dash, edgeScan] = await Promise.all([buildOpsDashboard(), loadEdgeScanReport()]);
  const conviction = dash.trading?.clinicalConviction ?? "demo";
  const significant = edgeScan?.significantEdges ?? [];
  const watchlist = edgeScan?.watchlist ?? [];

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium text-accent">Edges</p>
        <h1 className="font-display mt-1 text-3xl font-semibold text-ink">
          Clinical P vs executable asks
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Each row is a recommendation, not an order. Open Polymarket, fill yourself, then Log fill
          so the Book tracks reality.
        </p>
        {edgeScan ? (
          <p className="mt-2 text-sm text-ink">
            Edge scan: {edgeScan.significantCount} significant · {edgeScan.watchlistCount} watchlist ·{" "}
            {edgeScan.scoredCount} scored · {edgeScan.discoveredTradable} tradable
            {edgeScan.discoveredTotal > edgeScan.discoveredTradable ? (
              <>
                {" "}
                ({edgeScan.discoveredTotal} keyword matches incl. closed)
              </>
            ) : null}{" "}
            · conviction {edgeScan.clinicalConviction}
          </p>
        ) : null}
        {edgeScan && edgeScan.discoveredMarkets.length > 0 ? (
          <details className="mt-3 max-w-3xl text-sm text-muted">
            <summary className="cursor-pointer text-ink">
              Discovered markets ({edgeScan.discoveredMarkets.length} open)
            </summary>
            <ul className="mt-2 space-y-1">
              {edgeScan.discoveredMarkets.map((m) => (
                <li key={m.polymarketId}>
                  <a href={m.url} className="text-accent hover:underline" target="_blank" rel="noreferrer">
                    {m.polymarketId}
                  </a>
                  {" — "}
                  {m.question}
                  {m.tradable ? " · tradable" : m.closed ? " · closed" : " · not accepting"}
                  {m.scored ? " · scored" : m.mapped ? " · mapped" : " · unmapped"}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </header>
      {significant.length > 0 ? (
        <section>
          <h2 className="text-lg font-semibold text-emerald-900">Significant edges</h2>
          <p className="mt-1 text-sm text-muted">
            BET_* with net edge ≥5%, contract not blocked, purchasable now.
          </p>
          <div className="mt-3">
            <EdgesTable opportunities={significant} conviction={conviction} />
          </div>
        </section>
      ) : null}
      {watchlist.length > 0 ? (
        <section>
          <h2 className="text-lg font-semibold text-amber-900">Watchlist — blocked latent edge</h2>
          <p className="mt-1 text-sm text-muted">
            |net edge| ≥5% and purchasable, but contract checklist blocks calibration. Run enrichment
            on the market page or <code className="font-mono-pe text-xs">pnpm edge:enrich</code>.
          </p>
          <div className="mt-3">
            <EdgesTable opportunities={watchlist} conviction={conviction} />
          </div>
        </section>
      ) : null}
      <section>
        <h2 className="text-lg font-semibold text-ink">All scored markets</h2>
        <EdgesTable opportunities={dash.platform.opportunities} conviction={conviction} />
      </section>
    </div>
  );
}
