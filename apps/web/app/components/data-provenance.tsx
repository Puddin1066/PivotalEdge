import type { RadarDataLane, RadarTradability } from "@pivotaledge/schemas";

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = iso.slice(0, 10);
  return d || "—";
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "UTC",
    });
  } catch {
    return iso;
  }
}

export function pct(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${(value * 100).toFixed(1)}%`;
}

export const LANE_COPY: Record<
  RadarDataLane,
  { label: string; short: string; className: string; buyHint: string }
> = {
  live_polymarket: {
    label: "Live on Polymarket",
    short: "LIVE",
    className: "bg-sky-100 text-sky-900 border-sky-300",
    buyHint: "Open on Polymarket to purchase manually. Not auto-traded by PivotalEdge.",
  },
  fixture_demo: {
    label: "Fixture demo (not purchasable)",
    short: "DEMO",
    className: "bg-amber-100 text-amber-950 border-amber-300",
    buyHint: "Synthetic market + mock order book. Cannot be bought on Polymarket.",
  },
  retrospective_paper: {
    label: "Retrospective paper (simulation)",
    short: "PAPER",
    className: "bg-violet-100 text-violet-950 border-violet-300",
    buyHint: "Historical simulation only. Already resolved in the paper sample.",
  },
};

export const TRADABILITY_COPY: Record<RadarTradability, { label: string; className: string }> = {
  purchasable_now: {
    label: "Purchasable now",
    className: "bg-emerald-100 text-emerald-900 border-emerald-300",
  },
  not_purchasable: {
    label: "Not accepting orders",
    className: "bg-slate-100 text-slate-700 border-slate-300",
  },
  simulation_only: {
    label: "Simulation only",
    className: "bg-amber-50 text-amber-900 border-amber-200",
  },
};

export function LaneBadge({ lane }: { lane: RadarDataLane }) {
  const c = LANE_COPY[lane];
  if (!c) return null;
  return (
    <span
      className={`inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-semibold tracking-wide ${c.className}`}
      title={c.buyHint}
    >
      {c.short}
    </span>
  );
}

export function TradabilityBadge({ tradability }: { tradability: RadarTradability }) {
  const c = TRADABILITY_COPY[tradability];
  if (!c) return null;
  return (
    <span
      className={`inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-medium ${c.className}`}
    >
      {c.label}
    </span>
  );
}

export function DataLaneLegend() {
  return (
    <aside className="rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-sm">
      <h2 className="text-sm font-semibold text-ink">How to read this page</h2>
      <ul className="mt-3 space-y-3">
        {(Object.keys(LANE_COPY) as RadarDataLane[]).map((lane) => {
          const c = LANE_COPY[lane];
          if (!c) return null;
          return (
            <li key={lane} className="flex gap-3">
              <LaneBadge lane={lane} />
              <div>
                <p className="font-medium">{c.label}</p>
                <p className="text-xs text-muted">{c.buyHint}</p>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-muted">
        Live trading is off. Manual Polymarket purchases are your responsibility — use executable
        asks only, never midpoints.
      </p>
    </aside>
  );
}

export function DateStrip({
  forecastCutoff,
  eventDeadline,
  closesAt,
  evaluatedAt,
}: {
  forecastCutoff?: string | null;
  eventDeadline?: string | null;
  closesAt?: string | null;
  evaluatedAt?: string | null;
}) {
  const rows = [
    {
      label: "Forecast cutoff",
      value: forecastCutoff,
      hint: "Evidence must be public by this date",
    },
    { label: "Event deadline", value: eventDeadline, hint: "Market resolution date" },
    { label: "Market closes", value: closesAt, hint: "Polymarket close / end" },
    { label: "Evaluated at", value: evaluatedAt, hint: "When this view was built" },
  ].filter((r) => r.value);

  if (rows.length === 0) return null;

  return (
    <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {rows.map((r) => (
        <div key={r.label} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <dt className="text-[11px] font-medium uppercase tracking-wide text-muted">{r.label}</dt>
          <dd className="mt-0.5 font-mono text-sm font-semibold tabular-nums">
            {formatDate(r.value)}
          </dd>
          <p className="mt-0.5 text-[11px] text-muted">{r.hint}</p>
        </div>
      ))}
    </dl>
  );
}
