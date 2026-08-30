import { NextResponse } from "next/server";

import type { PortfolioRiskScenarioId } from "@pivotaledge/schemas";
import { buildOpsRiskReport } from "@pivotaledge/workflows";

export const dynamic = "force-dynamic";

const SCENARIOS = new Set([
  "base_independent",
  "fda_delay_year",
  "ta_oncology_risk",
  "same_quarter_cluster",
  "adverse_p",
]);

/** GET /api/ops/risk?stake=100&scenario=fda_delay_year&mode=conservative */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const stakeRaw = url.searchParams.get("stake");
    const scenarioRaw = url.searchParams.get("scenario") ?? "fda_delay_year";
    const scenario = (
      SCENARIOS.has(scenarioRaw) ? scenarioRaw : "fda_delay_year"
    ) as PortfolioRiskScenarioId;
    const mode =
      url.searchParams.get("mode") === "model" ? ("model" as const) : ("conservative" as const);
    const evaluationStake =
      stakeRaw != null && Number.isFinite(Number(stakeRaw)) && Number(stakeRaw) > 0
        ? Number(stakeRaw)
        : undefined;

    const risk = await buildOpsRiskReport({
      evaluationStake,
      stressScenarioId: scenario,
      probabilityMode: mode,
    });
    return NextResponse.json(risk);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
