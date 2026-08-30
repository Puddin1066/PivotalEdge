import { NextResponse } from "next/server";

import { runChronologicalBacktest } from "@pivotaledge/evals";
import { loadBacktestCorpus } from "@pivotaledge/schemas";

export const dynamic = "force-dynamic";

export async function GET() {
  const corpus = await loadBacktestCorpus();
  const report = runChronologicalBacktest(corpus);
  return NextResponse.json(report);
}
