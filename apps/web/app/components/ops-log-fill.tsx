"use client";

import { useState, useTransition } from "react";

import type { LiveScoredOpportunity } from "@pivotaledge/workflows";

import { pct } from "./data-provenance";

export function LogFillForm({
  opportunity,
  onDone,
}: {
  opportunity: LiveScoredOpportunity;
  onDone?: () => void;
}) {
  const side = opportunity.action === "BET_YES" ? "YES" : "NO";
  const defaultPrice =
    side === "YES" ? (opportunity.yesBestAsk ?? 0.5) : (opportunity.noBestAsk ?? 0.5);
  const [fillPrice, setFillPrice] = useState(String(defaultPrice));
  const [fillNotional, setFillNotional] = useState(String(Math.max(10, opportunity.stake || 50)));
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/ops/manual-positions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            marketId: opportunity.polymarketId,
            polymarketUrl: opportunity.url,
            question: opportunity.question,
            slug: opportunity.slug,
            side,
            recommendationFingerprint: opportunity.fingerprint,
            modelPAtEntry: opportunity.modelP,
            conservativePAtEntry: opportunity.conservativeP,
            recommendedAction: opportunity.action,
            maxEntryPriceAtEntry:
              side === "YES"
                ? (opportunity.yesBestAsk ?? null)
                : (opportunity.noBestAsk ?? null),
            netEdgeAtEntry: opportunity.netEdge,
            fillPrice: Number(fillPrice),
            fillNotional: Number(fillNotional),
            notes: notes || undefined,
          }),
        });
        const body = (await res.json()) as { ok?: boolean; error?: string };
        if (!res.ok || !body.ok) {
          setError(body.error || `HTTP ${res.status}`);
          return;
        }
        setOk(true);
        onDone?.();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  if (ok) {
    return (
      <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
        Fill logged. It appears on Book. PivotalEdge did not place the Polymarket order.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-lg border border-line bg-panel p-4">
      <div>
        <h3 className="text-sm font-semibold text-ink">Log manual fill</h3>
        <p className="mt-1 text-xs text-muted">
          After you buy on Polymarket, record the fill here so edges and PnL stay honest. This is
          not an order ticket.
        </p>
      </div>
      <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        <div>
          <dt className="text-muted">Side</dt>
          <dd className="font-semibold">{side}</dd>
        </div>
        <div>
          <dt className="text-muted">Model P</dt>
          <dd className="font-mono-pe">{pct(opportunity.modelP)}</dd>
        </div>
        <div>
          <dt className="text-muted">Cons. P</dt>
          <dd className="font-mono-pe">{pct(opportunity.conservativeP)}</dd>
        </div>
        <div>
          <dt className="text-muted">Suggested stake</dt>
          <dd className="font-mono-pe">${opportunity.stake}</dd>
        </div>
      </dl>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="text-muted">Fill price (ask you paid)</span>
          <input
            required
            type="number"
            step="0.001"
            min="0.001"
            max="0.999"
            value={fillPrice}
            onChange={(e) => setFillPrice(e.target.value)}
            className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 font-mono-pe text-ink"
          />
        </label>
        <label className="block text-sm">
          <span className="text-muted">Notional USDC</span>
          <input
            required
            type="number"
            step="1"
            min="1"
            value={fillNotional}
            onChange={(e) => setFillNotional(e.target.value)}
            className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 font-mono-pe text-ink"
          />
        </label>
      </div>
      <label className="block text-sm">
        <span className="text-muted">Notes (optional)</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-ink"
        />
      </label>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <button
        type="submit"
        disabled={pending || (opportunity.action !== "BET_YES" && opportunity.action !== "BET_NO")}
        className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {pending ? "Saving…" : "Confirm manual fill"}
      </button>
    </form>
  );
}
