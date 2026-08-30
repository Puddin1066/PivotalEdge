import { NextResponse } from "next/server";

import { buildKgMetricsDashboard } from "@pivotaledge/workflows";

export const dynamic = "force-dynamic";

/** GET /api/ops/kg — KG inventory metrics + enrichment history */
export async function GET() {
  const dashboard = await buildKgMetricsDashboard();
  return NextResponse.json(dashboard);
}
