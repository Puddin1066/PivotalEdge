import { buildOpsDashboard } from "@pivotaledge/workflows";

import { BookTable } from "../../components/ops-book-table";

export const dynamic = "force-dynamic";

export default async function OpsBookPage() {
  const dash = await buildOpsDashboard();

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium text-accent">Book</p>
        <h1 className="font-display mt-1 text-3xl font-semibold text-ink">Manual positions</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Everything you actually bought on Polymarket. Marks come from the quote vault (best ask
          for your side) — never treat midpoint as fillable. Paper BET_* count: {dash.paperOpen}{" "}
          (see Health / paper report).
        </p>
      </header>
      <BookTable open={dash.manual.open} closed={dash.manual.closed} />
    </div>
  );
}
