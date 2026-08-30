import { runChronologicalBacktest } from "@pivotaledge/evals";
import { loadBacktestCorpus } from "@pivotaledge/schemas";

export const dynamic = "force-dynamic";

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

export default async function BacktestPage() {
  const corpus = await loadBacktestCorpus();
  const report = runChronologicalBacktest(corpus);

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <header className="mb-8 border-b border-slate-200 pb-6">
        <p className="text-sm font-medium text-accent">PivotalEdge · Backtest</p>
        <h1 className="mt-2 text-3xl font-bold">Edge vs market (chronological)</h1>
        <p className="mt-2 text-sm text-muted">
          Synthetic mock corpus · {corpus.cases.length} cases · policy {report.policyVersion}
        </p>
      </header>

      <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <p className="text-xs uppercase text-muted">Model net PnL</p>
          <p className="mt-1 text-2xl font-semibold">${report.modelNetPnL.toFixed(2)}</p>
        </div>
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <p className="text-xs uppercase text-muted">Market baseline PnL</p>
          <p className="mt-1 text-2xl font-semibold">${report.marketBaselineNetPnL.toFixed(2)}</p>
        </div>
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <p className="text-xs uppercase text-muted">Edge vs market</p>
          <p className="mt-1 text-2xl font-semibold">${report.edgeVsMarket.toFixed(2)}</p>
        </div>
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <p className="text-xs uppercase text-muted">Hit rate</p>
          <p className="mt-1 text-2xl font-semibold">
            {report.hitRate != null ? pct(report.hitRate) : "—"}
          </p>
        </div>
      </section>

      <section className="mb-8 rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Calibration</h2>
        <p className="mt-2 text-sm text-muted">
          Model Brier {report.modelBrier.toFixed(4)} · Market Brier {report.marketBrier.toFixed(4)}{" "}
          · {report.totalTrades} trades · final bankroll ${report.finalBankroll.toFixed(2)}
        </p>
        <p className="mt-2 text-sm">
          {report.beatsMarketAfterCosts
            ? "Model beats always-YES market baseline after costs."
            : "Model did not beat market baseline."}
        </p>
      </section>

      <section className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-muted">
            <tr>
              <th className="px-4 py-3">Case</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Stake</th>
              <th className="px-4 py-3">Net PnL</th>
              <th className="px-4 py-3">Market base</th>
            </tr>
          </thead>
          <tbody>
            {report.trades.map((t) => (
              <tr key={t.caseId} className="border-t border-slate-100">
                <td className="px-4 py-2 font-mono text-xs">{t.caseId}</td>
                <td className="px-4 py-2">{t.action}</td>
                <td className="px-4 py-2">${t.stake.toFixed(2)}</td>
                <td className="px-4 py-2">${t.netPnL.toFixed(2)}</td>
                <td className="px-4 py-2">${t.marketBaselineNetPnL.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
