import { buildPlatformDashboard } from "@pivotaledge/workflows";

import { DataLaneLegend } from "../components/data-provenance";
import { PlatformConsole } from "../components/platform-console";

export const dynamic = "force-dynamic";

export default async function PlatformPage() {
  const dashboard = await buildPlatformDashboard();

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-8 border-b border-slate-200 pb-8">
        <p className="text-sm font-medium text-accent">PivotalEdge</p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight text-ink">Platform</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
          Clinical KG enrichment, deterministic probabilities, and ranked Polymarket opportunities
          against executable CLOB asks. Live trading remains off — use this for decision support.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
            <p className="text-[11px] uppercase tracking-wide text-muted">KG programs</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{dashboard.kg.programCount}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
            <p className="text-[11px] uppercase tracking-wide text-muted">Live-enriched</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {dashboard.kg.liveProgramCount}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
            <p className="text-[11px] uppercase tracking-wide text-muted">Ranked markets</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {dashboard.opportunities.length}
            </p>
          </div>
        </div>
        <p className="mt-4 text-sm text-muted">
          Deep KG metrics & enrichment history:{" "}
          <a href="/ops/kg" className="font-semibold text-accent hover:underline">
            /ops/kg
          </a>
        </p>
      </header>

      <div className="mb-10">
        <DataLaneLegend />
      </div>

      <PlatformConsole initial={dashboard} />
    </main>
  );
}
