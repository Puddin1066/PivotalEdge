import { NextResponse } from "next/server";

import { buildOpportunityRadar } from "@pivotaledge/workflows";

export const dynamic = "force-dynamic";

export async function GET() {
  const radar = await buildOpportunityRadar();
  return NextResponse.json(radar);
}
