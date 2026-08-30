import Link from "next/link";
import { notFound } from "next/navigation";

import { buildOpsDashboard, loadOpsMarketRationale } from "@pivotaledge/workflows";

import {
  DateStrip,
  LaneBadge,
  TradabilityBadge,
  formatDateTime,
  pct,
} from "../../../components/data-provenance";
import { actionTone } from "../../../components/ops-ui";
import { LogFillForm } from "../../../components/ops-log-fill";
import { OpsRationalePanel } from "../../../components/ops-rationale";
import { OpsEnrichmentTrigger } from "../../../components/ops-enrichment-trigger";
import { ContractChecklistPanel, assessmentFromOpportunity } from "../../../components/contract-checklist-panel";
import { ResearchTracePanel } from "../../../components/research-trace-panel";
import { loadResearchTraceForOpsMarket } from "../../../lib/orchestration";

export const dynamic = "force-dynamic";

export default async function OpsMarketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const dash = await buildOpsDashboard();
  const opp = dash.platform.opportunities.find((o) => o.polymarketId === id);
  const positions = [...dash.manual.open, ...dash.manual.closed].filter((p) => p.marketId === id);
  const rationale = await loadOpsMarketRationale(id);
  const enrichment = await loadResearchTraceForOpsMarket(id);

  if (!opp && positions.length === 0 && !rationale) notFound();

  return (
    <div className="space-y-10">
      <header className="space-y-3">
        <p className="text-sm font-medium text-accent">Market</p>
        <h1 className="font-display text-3xl font-semibold leading-tight text-ink">
          {opp?.question ?? rationale?.question ?? positions[0]?.question}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          {opp ? <LaneBadge lane={opp.dataLane} /> : null}
          {opp ? <TradabilityBadge tradability={opp.tradability} /> : null}
          <span className="font-mono-pe text-xs text-muted">id {id}</span>
        </div>
        {(opp?.url ?? positions[0]?.polymarketUrl) ? (
          <a
            href={opp?.url ?? positions[0]!.polymarketUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-block text-sm font-semibold text-accent hover:underline"
          >
            Open on Polymarket ↗
          </a>
        ) : null}
        <DateStrip
          eventDeadline={opp?.eventDeadline ?? rationale?.eventDeadline}
          closesAt={opp?.closesAt ?? rationale?.eventDeadline}
          evaluatedAt={dash.platform.enrichment.lastScoreAt}
        />
      </header>

      {opp ? (
        <section className="rounded-xl border border-line bg-panel p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
                Decision
              </h2>
              <p className="mt-2 text-sm text-muted">
                Compare conservative clinical P to the ask you can actually hit. Midpoints are not
                shown as fillable.
              </p>
            </div>
            <span
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${actionTone(opp.action)}`}
            >
              {opp.action.replaceAll("_", " ")}
            </span>
          </div>
          <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <dt className="text-[11px] uppercase text-muted">Model P</dt>
              <dd className="font-mono-pe text-xl">{pct(opp.modelP)}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase text-muted">Conservative P</dt>
              <dd className="font-mono-pe text-xl">{pct(opp.conservativeP)}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase text-muted">YES / NO ask</dt>
              <dd className="font-mono-pe text-xl">
                {pct(opp.yesBestAsk)} / {pct(opp.noBestAsk)}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase text-muted">Net edge · stake</dt>
              <dd className="font-mono-pe text-xl">
                {pct(opp.netEdge)} · ${opp.stake}
              </dd>
            </div>
          </dl>
          <p className="mt-5 text-sm leading-relaxed text-ink">{opp.thesis}</p>
          <p className="mt-2 text-xs text-amber-900">{opp.clinicalNote}</p>
          <p className="mt-3">
            <a href="#rationale" className="text-sm font-semibold text-accent hover:underline">
              Jump to full rationale & citations ↓
            </a>
          </p>
          <p className="mt-4 font-mono-pe text-[11px] text-muted">
            fingerprint {opp.fingerprint.slice(0, 16)}… · scored{" "}
            {formatDateTime(dash.platform.enrichment.lastScoreAt)}
          </p>
        </section>
      ) : null}

      {rationale ? <OpsRationalePanel rationale={rationale} /> : null}

      <ContractChecklistPanel
        variant="ops"
        assessment={rationale?.contract ?? assessmentFromOpportunity(opp ?? {})}
        eventType={rationale?.eventType ?? opp?.eventType}
      />

      <OpsEnrichmentTrigger marketId={id} />

      <ResearchTracePanel
        variant="ops"
        trace={enrichment.trace}
        diff={enrichment.diff}
        runId={enrichment.run?.runId ?? null}
      />

      {opp && (opp.action === "BET_YES" || opp.action === "BET_NO") ? (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-ink">After you fill</h2>
          <LogFillForm opportunity={opp} />
        </section>
      ) : null}

      <section>
        <h2 className="text-lg font-semibold text-ink">Positions on this market</h2>
        {positions.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No manual fills logged yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line border-y border-line">
            {positions.map((p) => (
              <li key={p.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm">
                <span>
                  <strong>{p.side}</strong> · {p.status} · {formatDateTime(p.filledAt)}
                </span>
                <span className="font-mono-pe text-xs">
                  {pct(p.fillPrice)} · ${p.fillNotional}
                  {p.realizedPnL != null ? ` · PnL $${p.realizedPnL.toFixed(2)}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-sm">
        <Link href="/ops/edges" className="font-semibold text-accent hover:underline">
          ← Back to edges
        </Link>
      </p>
    </div>
  );
}
