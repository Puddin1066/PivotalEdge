"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type { LiveScoredOpportunity } from "@pivotaledge/workflows";

import { LaneBadge, TradabilityBadge, pct } from "./data-provenance";
import { LogFillForm } from "./ops-log-fill";
import { actionTone } from "./ops-ui";
import { OpsWhyButton } from "./ops-why-button";

type SortKey = "absEdge" | "modelP" | "yesAsk" | "action";

export function EdgesTable({
  opportunities,
  conviction,
  compact = false,
}: {
  opportunities: LiveScoredOpportunity[];
  conviction: "demo" | "calibrated";
  compact?: boolean;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("absEdge");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [logFor, setLogFor] = useState<string | null>(null);

  const rows = useMemo(() => {
    let list = [...opportunities];
    if (actionFilter !== "all") list = list.filter((o) => o.action === actionFilter);
    list.sort((a, b) => {
      if (sortKey === "modelP") return b.modelP - a.modelP;
      if (sortKey === "yesAsk") return (b.yesBestAsk ?? 0) - (a.yesBestAsk ?? 0);
      if (sortKey === "action") return a.action.localeCompare(b.action);
      return Math.abs(b.netEdge) - Math.abs(a.netEdge);
    });
    return compact ? list.slice(0, 5) : list;
  }, [opportunities, sortKey, actionFilter, compact]);

  if (opportunities.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-line bg-panel p-6 text-sm text-muted">
        No scored edges yet. Use <strong className="text-ink">Rescore live</strong> in the header
        to join clinical P with executable asks.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {!compact ? (
        <div className="flex flex-wrap items-end justify-between gap-3">
          <p className="text-sm text-muted">
            Ranked by disagreement between conservative clinical P and fillable asks.{" "}
            {conviction === "demo" ? (
              <span className="text-warn">Conviction is DEMO — triage carefully.</span>
            ) : (
              <span className="text-accent">Conviction calibrated against trial/FDA history.</span>
            )}
          </p>
          <div className="flex flex-wrap gap-2 text-sm">
            <label className="flex items-center gap-2 text-muted">
              Action
              <select
                className="rounded border border-line bg-white px-2 py-1 text-ink"
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
              >
                <option value="all">All</option>
                <option value="BET_YES">BET YES</option>
                <option value="BET_NO">BET NO</option>
                <option value="WAIT">WAIT</option>
                <option value="NO_BET">NO BET</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-muted">
              Sort
              <select
                className="rounded border border-line bg-white px-2 py-1 text-ink"
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
              >
                <option value="absEdge">|net edge|</option>
                <option value="modelP">Model P</option>
                <option value="yesAsk">YES ask</option>
                <option value="action">Action</option>
              </select>
            </label>
          </div>
        </div>
      ) : null}

      <ul className="space-y-3">
        {rows.map((o, idx) => (
          <li key={`${o.polymarketId}-${o.slug}`} className="border-b border-line pb-4 last:border-0">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono-pe text-xs text-muted">#{idx + 1}</span>
                  <LaneBadge lane={o.dataLane} />
                  <TradabilityBadge tradability={o.tradability} />
                  <span className="text-xs text-muted">{o.slug}</span>
                </div>
                <Link
                  href={`/ops/market/${o.polymarketId}`}
                  className="mt-2 block text-base font-medium text-ink hover:text-accent"
                >
                  {o.question}
                </Link>
                <p className="mt-2 text-sm text-muted">{o.thesis}</p>
              </div>
              <span
                className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${actionTone(o.action)}`}
              >
                {o.action.replaceAll("_", " ")}
              </span>
              {o.contractCoverage ? (
                <span
                  className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${
                    o.contractCoverage === "complete"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : o.contractCoverage === "blocked"
                        ? "border-rose-200 bg-rose-50 text-rose-800"
                        : "border-amber-200 bg-amber-50 text-amber-800"
                  }`}
                >
                  {o.contractCoverage}
                </span>
              ) : null}
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-6">
              <div>
                <dt className="text-[11px] uppercase text-muted">Model P</dt>
                <dd className="font-mono-pe text-sm">{pct(o.modelP)}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase text-muted">Cons. P</dt>
                <dd className="font-mono-pe text-sm">{pct(o.conservativeP)}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase text-muted">YES ask</dt>
                <dd className="font-mono-pe text-sm">{pct(o.yesBestAsk)}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase text-muted">NO ask</dt>
                <dd className="font-mono-pe text-sm">{pct(o.noBestAsk)}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase text-muted">Net edge</dt>
                <dd className="font-mono-pe text-sm font-semibold">{pct(o.netEdge)}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase text-muted">Stake</dt>
                <dd className="font-mono-pe text-sm">${o.stake}</dd>
              </div>
            </dl>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href={`/ops/market/${o.polymarketId}`}
                className="rounded-md border border-line bg-white px-3 py-1.5 text-xs font-semibold text-ink"
              >
                Open market
              </Link>
              <a
                href={o.url}
                target="_blank"
                rel="noreferrer"
                className="rounded-md border border-line bg-white px-3 py-1.5 text-xs font-semibold text-ink"
              >
                Polymarket ↗
              </a>
              {(o.action === "BET_YES" || o.action === "BET_NO") && !compact ? (
                <button
                  type="button"
                  onClick={() =>
                    setLogFor(logFor === o.polymarketId ? null : o.polymarketId)
                  }
                  className="rounded-md bg-ink px-3 py-1.5 text-xs font-semibold text-white"
                >
                  Log fill…
                </button>
              ) : null}
            </div>
            {!compact ? (
              <div className="mt-3">
                <OpsWhyButton marketId={o.polymarketId} />
              </div>
            ) : null}
            {logFor === o.polymarketId ? (
              <div className="mt-3">
                <LogFillForm opportunity={o} onDone={() => setLogFor(null)} />
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
