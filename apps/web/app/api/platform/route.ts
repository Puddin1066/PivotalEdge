import { NextResponse } from "next/server";

import { buildPlatformDashboard } from "@pivotaledge/workflows";

export const dynamic = "force-dynamic";

export async function GET() {
  const dashboard = await buildPlatformDashboard();
  return NextResponse.json(dashboard);
}
