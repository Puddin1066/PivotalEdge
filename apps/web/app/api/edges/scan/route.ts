import { NextResponse } from "next/server";

import { loadEdgeScanReport } from "@pivotaledge/workflows";

export const dynamic = "force-dynamic";

export async function GET() {
  const report = await loadEdgeScanReport();
  if (!report) {
    return NextResponse.json(
      { error: "No edge scan report — run pnpm edge:scan" },
      { status: 404 },
    );
  }
  return NextResponse.json(report);
}
