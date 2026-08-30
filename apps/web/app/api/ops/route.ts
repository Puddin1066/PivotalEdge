import { NextResponse } from "next/server";

import { buildOpsDashboard } from "@pivotaledge/workflows";

export const dynamic = "force-dynamic";

export async function GET() {
  const dashboard = await buildOpsDashboard();
  return NextResponse.json(dashboard);
}
