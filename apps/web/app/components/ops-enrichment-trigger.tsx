"use client";

import { useState, useTransition } from "react";

export function OpsEnrichmentTrigger({ marketId }: { marketId: string }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function runEnrichment() {
    startTransition(async () => {
      setMessage(null);
      try {
        const res = await fetch("/api/orchestration/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ marketId: `pm_${marketId}` }),
        });
        const data = (await res.json()) as {
          ok?: boolean;
          runId?: string;
          status?: string;
          error?: string;
          diff?: { probabilityDelta?: number; evidenceAdded?: number };
        };
        if (!res.ok || !data.ok) {
          setMessage(data.error ?? "Enrichment run failed");
          return;
        }
        setMessage(
          `Run ${data.runId} · ${data.status} · ΔP ${data.diff?.probabilityDelta?.toFixed(4) ?? "—"} · evidence +${data.diff?.evidenceAdded ?? 0}`,
        );
      } catch (err) {
        setMessage(err instanceof Error ? err.message : "Request failed");
      }
    });
  }

  return (
    <div className="rounded-xl border border-line bg-panel p-5 shadow-sm">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
        Evidence enrichment
      </h2>
      <p className="mt-2 text-sm text-muted">
        Run bounded research loop for this market (fixture research adapters in MVP).
      </p>
      <button
        type="button"
        onClick={runEnrichment}
        disabled={pending}
        className="mt-3 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Running…" : "Run enrichment"}
      </button>
      {message ? <p className="mt-3 font-mono-pe text-xs text-ink">{message}</p> : null}
    </div>
  );
}
