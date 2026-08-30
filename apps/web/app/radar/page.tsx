import Link from "next/link";

import { buildOpportunityRadar } from "@pivotaledge/workflows";

import { DataLaneLegend, LaneBadge, TradabilityBadge, pct } from "../components/data-provenance";

export const dynamic = "force-dynamic";

function actionClass(action: string): string {
  if (action === "BET_YES") return "bg-emerald-100 text-emerald-800";
  if (action === "BET_NO") return "bg-rose-100 text-rose-800";
  if (action === "WAIT") return "bg-amber-100 text-amber-800";
  return "bg-slate-100 text-slate-700";
}

export default async function RadarPage() {
  const radar = await buildOpportunityRadar();
  const portfolio = radar.paperPortfolio;

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <header className="mb-8 border-b border-slate-200 pb-6">
        <p className="text-sm font-medium text-accent">PivotalEdge · Opportunity Radar</p>
        <h1 className="mt-2 text-3xl font-bold">Radar</h1>
        <p className="mt-2 text-sm text-muted">
          Live Polymarket scores + fixture demo + paper sample · trading execution OFF
        </p>
        <p className="mt-2 text-sm">
          <Link href="/platform" className="text-accent underline">
            Open Platform dashboard
          </Link>{" "}
          for enrichment controls and KG inventory.
        </p>
      </header>

      <div className="mb-8">
        <DataLaneLegend />
      </div>

      {portfolio ? (
        <section className="mb-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <p className="text-xs uppercase text-muted">Paper realized PnL</p>
            <p className="mt-1 text-2xl font-semibold">${portfolio.realizedNetPnL.toFixed(2)}</p>
          </div>
          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <p className="text-xs uppercase text-muted">Cash</p>
            <p className="mt-1 text-2xl font-semibold">${portfolio.cash.toFixed(2)}</p>
          </div>
          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <p className="text-xs uppercase text-muted">Live trading</p>
            <p className="mt-1 text-2xl font-semibold text-slate-600">OFF</p>
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        {radar.opportunities.map((o) => {
          const external = o.dossierPath.startsWith("http");
          const body = (
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex flex-wrap gap-2">
                  <LaneBadge lane={o.dataLane} />
                  <TradabilityBadge tradability={o.tradability} />
                </div>
                <p className="font-medium leading-snug">{o.question}</p>
                <p className="mt-2 text-xs text-muted">
                  Score {o.opportunityScore.toFixed(1)} · Edge {pct(o.netEdge)} · Ask{" "}
                  {pct(o.executablePrice)}
                  {o.orderBooksAreMock ? " · mock book" : " · live book"}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${actionClass(o.action)}`}
              >
                {o.action.replace("_", " ")}
              </span>
            </div>
          );
          const className =
            "block rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-accent";
          return external ? (
            <a
              key={o.id}
              href={o.dossierPath}
              target="_blank"
              rel="noreferrer"
              className={className}
            >
              {body}
            </a>
          ) : (
            <Link key={o.id} href={o.dossierPath} className={className}>
              {body}
            </Link>
          );
        })}
      </section>
    </main>
  );
}
