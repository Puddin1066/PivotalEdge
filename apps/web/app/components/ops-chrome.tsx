"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useTransition } from "react";

import type { OpsDashboard } from "@pivotaledge/workflows";

import { formatDateTime, pct } from "./data-provenance";

const NAV = [
  { href: "/ops", label: "Today", hint: "What needs attention" },
  { href: "/ops/edges", label: "Edges", hint: "Ranked disagreements" },
  { href: "/ops/portfolio", label: "Portfolio", hint: "Edge-weighted deploy" },
  { href: "/ops/risk", label: "Risk", hint: "How this book dies" },
  { href: "/ops/book", label: "Book", hint: "Manual positions" },
  { href: "/ops/history", label: "History", hint: "Resolved fills" },
  { href: "/ops/kg", label: "KG", hint: "Metrics & enrich" },
  { href: "/ops/health", label: "Health", hint: "Gates & pipelines" },
];

type RunAction =
  | "quotes-snapshot"
  | "score-live"
  | "paper-live"
  | "retro-validate"
  | "enrich";

function Chip({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "good" | "warn" | "bad" | "accent";
}) {
  const cls =
    tone === "good"
      ? "border-emerald-300 bg-emerald-50 text-emerald-900"
      : tone === "warn"
        ? "border-amber-300 bg-amber-50 text-amber-950"
        : tone === "bad"
          ? "border-rose-300 bg-rose-50 text-rose-900"
          : tone === "accent"
            ? "border-teal-300 bg-accent-soft text-teal-950"
            : "border-line bg-white text-muted";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide ${cls}`}
    >
      {children}
    </span>
  );
}

export function OpsChrome({
  initial,
  children,
}: {
  initial: OpsDashboard;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [data, setData] = useState(initial);
  const [log, setLog] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function refresh() {
    const res = await fetch("/api/ops");
    if (!res.ok) throw new Error(`ops ${res.status}`);
    setData((await res.json()) as OpsDashboard);
  }

  function run(action: RunAction) {
    setLog(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/kg/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });
        const body = (await res.json()) as {
          ok: boolean;
          stdoutTail?: string;
          stderrTail?: string;
          error?: string;
        };
        if (!body.ok) {
          setLog(body.stderrTail || body.error || "Command failed");
          return;
        }
        setLog(body.stdoutTail?.slice(-1200) ?? "OK");
        await refresh();
      } catch (err) {
        setLog(err instanceof Error ? err.message : String(err));
      }
    });
  }

  const conviction = data.trading?.clinicalConviction ?? "demo";
  const paperReady = data.trading?.paperReady ?? false;

  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-panel/90 backdrop-blur">
        <div className="mx-auto flex max-w-ops flex-col gap-4 px-4 py-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <Link href="/ops" className="font-display text-2xl font-semibold tracking-tight text-ink">
                PivotalEdge
              </Link>
              <p className="mt-1 max-w-xl text-sm text-muted">
                See the edge → place on Polymarket yourself → log the fill → keep marks honest.
                The model recommends; it never sends an order.
              </p>
            </div>
            <div className="text-right">
              <p className="text-[11px] uppercase tracking-wide text-muted">Manual bankroll</p>
              <p className="font-mono-pe text-lg font-medium tabular-nums">
                ${data.bankroll.toLocaleString()}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Chip tone={paperReady ? "good" : "warn"}>
              {paperReady ? "PAPER READY" : "NOT READY"}
            </Chip>
            <Chip tone={conviction === "calibrated" ? "accent" : "warn"}>
              {conviction.toUpperCase()} CONVICTION
            </Chip>
            <Chip tone="bad">LIVE EXECUTION OFF</Chip>
            <Chip tone={data.asksFresh ? "good" : "warn"}>
              {data.asksFresh ? "ASKS FRESH" : "ASKS STALE"}
              {data.lastAskAt ? ` · ${formatDateTime(data.lastAskAt)}` : ""}
            </Chip>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
            <nav className="flex flex-wrap gap-1">
              {NAV.map((item) => {
                const active =
                  item.href === "/ops" ? pathname === "/ops" : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={item.hint}
                    className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                      active
                        ? "bg-ink text-white"
                        : "text-muted hover:bg-surface hover:text-ink"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <div className="ml-auto flex flex-wrap gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => run("quotes-snapshot")}
                className="rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                Snapshot asks
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => run("score-live")}
                className="rounded-md border border-line bg-white px-3 py-1.5 text-sm font-semibold text-ink disabled:opacity-50"
              >
                Rescore live
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => run("paper-live")}
                className="rounded-md border border-line bg-white px-3 py-1.5 text-sm font-semibold text-ink disabled:opacity-50"
              >
                Refresh paper
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => run("retro-validate")}
                className="rounded-md px-3 py-1.5 text-sm text-muted hover:text-ink disabled:opacity-50"
              >
                Retrospective
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => startTransition(() => void refresh())}
                className="rounded-md px-3 py-1.5 text-sm text-muted hover:text-ink"
              >
                Refresh
              </button>
            </div>
          </div>
          {log ? (
            <pre className="max-h-28 overflow-auto rounded-md bg-ink p-3 font-mono-pe text-[11px] text-slate-100">
              {pending ? "Running…" : log}
            </pre>
          ) : null}
        </div>
      </header>

      <div className="mx-auto max-w-ops px-4 py-8">{children}</div>
    </div>
  );
}

export { Chip, formatDateTime, pct };
export { actionTone, Stat } from "./ops-ui";
