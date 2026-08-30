import { evaluateOpportunity } from "@pivotaledge/workflows";

import { DossierView } from "../components/dossier-view";
import { loadResearchTraceForMarket } from "../lib/orchestration";

export const dynamic = "force-dynamic";

export default async function DossierPage() {
  const dossier = await evaluateOpportunity({ livePipeline: true });
  const enrichment = await loadResearchTraceForMarket(dossier.marketQuestion.marketId);

  return (
    <DossierView
      dossier={dossier}
      researchTrace={enrichment.trace}
      researchDiff={enrichment.diff}
      researchRunId={enrichment.run?.runId ?? null}
    />
  );
}
