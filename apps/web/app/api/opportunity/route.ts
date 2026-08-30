import { NextResponse } from "next/server";

import { evaluateOpportunity } from "@pivotaledge/workflows";

export const dynamic = "force-dynamic";

export async function GET() {
  const dossier = await evaluateOpportunity({ livePipeline: true });
  return NextResponse.json(dossier);
}
