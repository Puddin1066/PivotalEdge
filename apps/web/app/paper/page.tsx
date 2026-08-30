import Link from "next/link";

import { runProspectivePaperSample } from "@pivotaledge/evals";
import { loadProspectiveCorpus } from "@pivotaledge/schemas";

export const dynamic = "force-dynamic";

export default async function PaperPage() {
  const corpus = await loadProspectiveCorpus();
  const report = runProspectivePaperSample(corpus);

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <header className="mb-8 border-b border-slate-200 pb-6">
        <p className="text-sm font-medium text-accent">PivotalEdge · Paper Trading</p>
        <h1 className="mt-2 text-3xl font-bold">Prospective sample</h1>
        <p className="mt-2 text-sm text-muted">
          Model frozen at {report.freezeCutoff.slice(0, 10)} · simulation only · live trading
          disabled
        </p>
        <p className="mt-3">
          <Link href="/radar" className="text-sm text-accent underline">
            ← Radar
          </Link>
        </p>
      </header>

      <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <p className="text-xs uppercase text-muted">Simulated net PnL</p>
          <p className="mt-1 text-2xl font-semibold">${report.simulatedNetPnL.toFixed(2)}</p>
        </div>
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <p className="text-xs uppercase text-muted">Model Brier</p>
          <p className="mt-1 text-2xl font-semibold">{report.modelBrier.toFixed(4)}</p>
        </div>
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <p className="text-xs uppercase text-muted">Market Brier</p>
          <p className="mt-1 text-2xl font-semibold">{report.marketBrier.toFixed(4)}</p>
        </div>
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <p className="text-xs uppercase text-muted">Gate</p>
          <p className="mt-1 text-2xl font-semibold">{report.gatePass ? "PASS" : "FAIL"}</p>
        </div>
      </section>

      <p className="mb-4 text-sm text-muted">
        Train {report.trainCases} · Prospective {report.prospectiveCases} · Paper trades{" "}
        {report.paperTrades} · Calibration {report.calibrationStatus}
      </p>

      <section className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-muted">
            <tr>
              <th className="px-4 py-3">Case</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Stake</th>
              <th className="px-4 py-3">Net PnL</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {report.trades.map((t) => (
              <tr key={t.id} className="border-t border-slate-100">
                <td className="px-4 py-2 font-mono text-xs">{t.caseId}</td>
                <td className="px-4 py-2">{t.action}</td>
                <td className="px-4 py-2">${t.stake.toFixed(2)}</td>
                <td className="px-4 py-2">{t.netPnL != null ? `$${t.netPnL.toFixed(2)}` : "—"}</td>
                <td className="px-4 py-2">{t.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
