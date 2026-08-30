"use client";

import { useState, useTransition } from "react";

import type { OpsMarketRationale } from "@pivotaledge/workflows";

import { OpsRationalePanel } from "./ops-rationale";

/** Inline “Why” drawer on Edges — loads full rationale on demand. */
export function OpsWhyButton({ marketId }: { marketId: string }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<OpsMarketRationale | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (data) return;
    startTransition(async () => {
      try {
        const res = await fetch(`/api/ops/market/${encodeURIComponent(marketId)}/rationale`);
        if (!res.ok) {
          setError(`Failed (${res.status})`);
          return;
        }
        setData((await res.json()) as OpsMarketRationale);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={toggle}
        className="rounded-md border border-line bg-white px-3 py-1.5 text-xs font-semibold text-ink"
      >
        {open ? "Hide rationale" : "Why this call…"}
      </button>
      {open ? (
        <div className="mt-4 rounded-xl border border-line bg-panel p-4 shadow-sm">
          {pending && !data ? (
            <p className="text-sm text-muted">Loading rationale…</p>
          ) : error ? (
            <p className="text-sm text-danger">{error}</p>
          ) : data ? (
            <OpsRationalePanel rationale={data} />
          ) : (
            <p className="text-sm text-muted">No frozen snapshot for this market.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
