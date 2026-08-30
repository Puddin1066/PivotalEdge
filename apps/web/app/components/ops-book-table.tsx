"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { MarkedManualPosition } from "@pivotaledge/workflows";

import { formatDateTime, pct } from "./data-provenance";

export function BookTable({
  open,
  closed,
}: {
  open: MarkedManualPosition[];
  closed: MarkedManualPosition[];
}) {
  const [tab, setTab] = useState<"open" | "closed">("open");
  const rows = tab === "open" ? open : closed;
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function resolve(id: string, resolvedYes: boolean) {
    startTransition(async () => {
      await fetch("/api/ops/manual-positions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          status: "resolved",
          resolvedYes,
          closeReason: "resolved",
        }),
      });
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(
          [
            ["open", `Open (${open.length})`],
            ["closed", `Closed (${closed.length})`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              tab === key ? "bg-ink text-white" : "text-muted hover:bg-panel"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line bg-panel p-6 text-sm text-muted">
          {tab === "open"
            ? "No open manual fills. From Edges, open Polymarket, buy, then Log fill."
            : "No resolved manual fills yet."}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-line text-[11px] uppercase tracking-wide text-muted">
              <tr>
                <th className="py-2 pr-3">Position</th>
                <th className="py-2 pr-3">Entry</th>
                <th className="py-2 pr-3">Mark</th>
                <th className="py-2 pr-3">P now</th>
                <th className="py-2 pr-3">Alerts</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="border-b border-line/70 align-top">
                  <td className="py-3 pr-3">
                    <span className="font-semibold">{p.side}</span>
                    <Link
                      href={`/ops/market/${p.marketId}`}
                      className="mt-1 block max-w-xs text-ink hover:text-accent"
                    >
                      {p.question}
                    </Link>
                    <p className="mt-1 font-mono-pe text-[11px] text-muted">
                      {formatDateTime(p.filledAt)}
                    </p>
                  </td>
                  <td className="py-3 pr-3 font-mono-pe text-xs">
                    {pct(p.fillPrice)} · ${p.fillNotional}
                    {p.netEdgeAtEntry != null ? (
                      <span className="mt-1 block text-muted">
                        edge in {pct(p.netEdgeAtEntry)}
                      </span>
                    ) : null}
                  </td>
                  <td className="py-3 pr-3 font-mono-pe text-xs">
                    {pct(p.markAsk)}
                    {p.unrealizedPnL != null ? (
                      <span
                        className={`mt-1 block ${p.unrealizedPnL >= 0 ? "text-emerald-700" : "text-rose-700"}`}
                      >
                        uPnL ${p.unrealizedPnL.toFixed(2)}
                      </span>
                    ) : null}
                    {p.realizedPnL != null ? (
                      <span className="mt-1 block">PnL ${p.realizedPnL.toFixed(2)}</span>
                    ) : null}
                  </td>
                  <td className="py-3 pr-3 font-mono-pe text-xs">
                    {pct(p.modelPNow)} / {pct(p.conservativePNow)}
                  </td>
                  <td className="py-3 pr-3">
                    <div className="flex flex-wrap gap-1">
                      {p.alerts.map((a) => (
                        <span
                          key={a}
                          className="rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-950"
                        >
                          {a}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-3">
                    <div className="flex flex-wrap gap-2">
                      <a
                        href={p.polymarketUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-semibold text-accent hover:underline"
                      >
                        Polymarket
                      </a>
                      {p.status === "open" ? (
                        <>
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => resolve(p.id, true)}
                            className="text-xs font-semibold text-ink hover:underline"
                          >
                            Resolve YES
                          </button>
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => resolve(p.id, false)}
                            className="text-xs font-semibold text-ink hover:underline"
                          >
                            Resolve NO
                          </button>
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
