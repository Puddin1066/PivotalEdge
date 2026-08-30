/** Shared Ops UI helpers — safe for server and client. */

export function actionTone(action: string): string {
  if (action === "BET_YES") return "border-emerald-300 bg-emerald-50 text-emerald-900";
  if (action === "BET_NO") return "border-rose-300 bg-rose-50 text-rose-900";
  if (action === "WAIT") return "border-amber-300 bg-amber-50 text-amber-950";
  return "border-line bg-slate-50 text-muted";
}

export function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="border-l border-line pl-4">
      <p className="text-[11px] uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 font-mono-pe text-2xl font-medium tabular-nums text-ink">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}
