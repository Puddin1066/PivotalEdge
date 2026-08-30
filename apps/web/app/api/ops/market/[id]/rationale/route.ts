import { NextResponse } from "next/server";

import { loadOpsMarketRationale } from "@pivotaledge/workflows";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const rationale = await loadOpsMarketRationale(id);
  if (!rationale) {
    return NextResponse.json({ error: "rationale not found" }, { status: 404 });
  }
  return NextResponse.json(rationale);
}
