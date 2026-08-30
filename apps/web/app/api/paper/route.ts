import { NextResponse } from "next/server";

import { runProspectivePaperSample } from "@pivotaledge/evals";
import { loadProspectiveCorpus } from "@pivotaledge/schemas";

export const dynamic = "force-dynamic";

export async function GET() {
  const corpus = await loadProspectiveCorpus();
  const report = runProspectivePaperSample(corpus);
  return NextResponse.json(report);
}
