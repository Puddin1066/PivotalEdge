/**
 * Smoke: clock-aware forecasts for live fixtures (as-of before Daraxonrasib approval).
 * Usage: pnpm exec tsx scripts/smoke-regulatory-clock.ts
 */
import {
  compileQueryPlan,
  InMemoryKnowledgeGraphRepository,
  loadGraphFromProgramFixtures,
} from "@pivotaledge/kg";
import { buildForecast } from "@pivotaledge/models";
import { loadProgramFixture } from "@pivotaledge/schemas";

async function main() {
  const cutoff = "2026-08-01T00:00:00.000Z";
  const darax = await loadProgramFixture("corpus/live/daraxonrasib-pdac.json");
  const reta = await loadProgramFixture("corpus/live/retatrutide-obesity.json");
  const graph = loadGraphFromProgramFixtures([darax, reta]);
  const repo = new InMemoryKnowledgeGraphRepository(graph);

  const cases = [
    {
      label: "daraxonrasib@Aug1 (pre-approval)",
      programId: "prog_daraxonrasib_pdac",
      ta: "oncology",
      deadline: "2026-12-31T00:00:00.000Z",
    },
    {
      label: "retatrutide@Aug1 (filing Q1'27)",
      programId: "prog_retatrutide_obesity",
      ta: "metabolic",
      deadline: "2026-12-31T00:00:00.000Z",
    },
  ] as const;

  for (const c of cases) {
    const prog = graph.getProgram(c.programId)!;
    const q = {
      marketId: `pm_${c.programId}`,
      eventType: "FDA_APPROVAL_BY_DATE" as const,
      drugAssetId: prog.drug.id,
      drugAliases: [] as string[],
      sponsorId: prog.sponsor.id,
      indicationId: prog.indication.id,
      population: null,
      applicationId: prog.application?.id ?? null,
      linkedTrialIds: [] as string[],
      endpointIds: [] as string[],
      eventDeadline: c.deadline,
      resolutionSource: "smoke",
      resolutionDefinition: "smoke",
      conditionalApprovalCounts: true,
      ambiguityFlags: [] as string[],
      parserConfidence: 1,
    };
    const plan = compileQueryPlan(q, { forecastCutoff: cutoff, therapeuticArea: c.ta });
    const bundle = repo.executePlan(plan);
    const fc = buildForecast({
      marketQuestion: q,
      precedentBundle: bundle,
      forecastCutoff: cutoff,
    });
    const snap = graph.clinicalFeaturesAtCutoff(prog, cutoff);
    console.log(`\n${c.label}`);
    console.log("  status@cutoff", bundle.currentProgram?.status);
    console.log("  deltas", {
      daysRegistrationToPrimaryCompletion: snap.daysRegistrationToPrimaryCompletion?.toFixed(0),
      daysPrimaryCompletionToAcceptance: snap.daysPrimaryCompletionToAcceptance?.toFixed(0),
      daysAcceptanceToAction: snap.daysAcceptanceToAction,
      reviewProgram: snap.reviewProgram,
      acceptedAt: snap.acceptedAt,
      expectedFilingAt: snap.expectedFilingAt,
    });
    console.log(
      "  components",
      Object.fromEntries(fc.components.map((x) => [x.name, Number(x.probability.toFixed(3))])),
    );
    console.log("  modelP", Number(fc.modelProbability.toFixed(3)));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
