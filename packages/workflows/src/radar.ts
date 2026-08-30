import type { RadarOpportunity, RadarSnapshot } from "@pivotaledge/schemas";
import { loadProspectiveCorpus, RadarSnapshotSchema } from "@pivotaledge/schemas";
import { portfolioFromProspectiveReport, runProspectivePaperSample } from "@pivotaledge/evals";

import { evaluateOpportunity } from "./evaluate-opportunity.js";
import { loadLiveScoreReport } from "./platform-dashboard.js";
import { loadEdgeScanReport } from "./edge-scan.js";
import { opportunityRankScore } from "./live-market-scoring.js";

function opportunityScore(netEdge: number, stake: number, confidence: string): number {
  const conf = confidence === "high" ? 1 : confidence === "moderate" ? 0.7 : 0.4;
  return Math.max(0, Math.abs(netEdge)) * 100 + Math.min(stake / 50, 10) * conf;
}

/** Build opportunity radar: significant live edges + fixture demo + paper sample. */
export async function buildOpportunityRadar(): Promise<RadarSnapshot> {
  const edgeScan = await loadEdgeScanReport();
  const liveReport = await loadLiveScoreReport();
  const liveSource = edgeScan?.significantEdges.length
    ? edgeScan.significantEdges
    : (edgeScan?.allScored ?? liveReport?.opportunities ?? []);
  const liveRows: RadarOpportunity[] = liveSource.map((o) => ({
    id: `radar_live_${o.slug}_${o.polymarketId}`,
    marketId: `pm_${o.polymarketId}`,
    question: o.question,
    action: o.action as RadarOpportunity["action"],
    modelProbability: o.modelP,
    conservativeProbability: o.conservativeP,
    executablePrice:
      o.action === "BET_NO" ? (o.noBestAsk ?? o.yesBestAsk ?? 0) : (o.yesBestAsk ?? 0),
    netEdge: o.netEdge,
    recommendedStake: o.stake,
    evidenceConfidence: o.evidenceConfidence as RadarOpportunity["evidenceConfidence"],
    opportunityScore: opportunityRankScore(o),
    dossierPath: o.url,
    orderBooksAreMock: false,
    generatedAt: liveReport?.at ?? new Date().toISOString(),
    dataLane: o.dataLane,
    tradability: o.tradability,
  }));

  const dossier = await evaluateOpportunity({ livePipeline: true });
  const rec = dossier.recommendation;

  const primary: RadarOpportunity = {
    id: `radar_${rec.marketId}`,
    marketId: rec.marketId,
    question: dossier.market.question,
    action: rec.action,
    modelProbability: rec.modelProbability,
    conservativeProbability: rec.conservativeProbability,
    executablePrice: rec.executablePrice,
    netEdge: rec.netEdge,
    recommendedStake: rec.recommendedStake,
    evidenceConfidence: rec.evidenceConfidence,
    opportunityScore: opportunityScore(rec.netEdge, rec.recommendedStake, rec.evidenceConfidence),
    dossierPath: "/dossier",
    orderBooksAreMock: dossier.metadata.orderBooksAreMock,
    generatedAt: rec.generatedAt,
    dataLane: "fixture_demo",
    tradability: "simulation_only",
  };

  const corpus = await loadProspectiveCorpus();
  const report = runProspectivePaperSample(corpus);
  const portfolio = portfolioFromProspectiveReport(report);

  const secondary: RadarOpportunity[] = report.trades
    .filter((t) => t.action === "BET_YES" || t.action === "BET_NO")
    .slice(0, 5)
    .map((t) => ({
      id: `radar_paper_${t.caseId}`,
      marketId: t.caseId,
      question: `Paper sample ${t.caseId} (${t.action})`,
      action: t.action,
      modelProbability: t.modelProbability,
      conservativeProbability: t.conservativeProbability,
      executablePrice: t.executablePrice ?? 0,
      netEdge: t.netPnL != null && t.stake > 0 ? t.netPnL / t.stake : 0,
      recommendedStake: t.stake,
      evidenceConfidence: "moderate" as const,
      opportunityScore: opportunityScore(
        t.netPnL != null && t.stake > 0 ? t.netPnL / t.stake : 0,
        t.stake,
        "moderate",
      ),
      dossierPath: "/paper",
      orderBooksAreMock: true,
      generatedAt: t.openedAt,
      dataLane: "retrospective_paper",
      tradability: "simulation_only",
    }));

  const opportunities = [...liveRows, primary, ...secondary].sort(
    (a, b) => b.opportunityScore - a.opportunityScore,
  );

  return RadarSnapshotSchema.parse({
    kind: "opportunity_radar",
    generatedAt: new Date().toISOString(),
    opportunities,
    paperPortfolio: portfolio,
  });
}
