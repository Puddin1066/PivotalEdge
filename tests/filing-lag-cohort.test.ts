import { describe, expect, it } from "vitest";

import {
  compileQueryPlan,
  computePeToFilingLag,
  executeQueryPlan,
  loadGraphFromProgramFixtures,
} from "@pivotaledge/kg";
import { defaultFixturesRoot, loadProgramFixture, type MarketQuestion } from "@pivotaledge/schemas";

describe("PE→filing lag cohort execution", () => {
  it("computes lag from PE public to expected filing guidance (retatrutide)", async () => {
    const root = defaultFixturesRoot();
    const fixture = await loadProgramFixture("corpus/live/retatrutide-obesity.json", root);
    const graphFixture = loadGraphFromProgramFixtures([fixture]);
    const lag = computePeToFilingLag(graphFixture.listPrograms()[0]!, "2026-08-01T00:00:00.000Z");
    expect(lag).not.toBeNull();
    expect(lag!.days).toBeGreaterThan(0);
    expect(lag!.guidanceProxy).toBe(true);
  });

  it("populates filing-lag cohort for NDA_BLA_SUBMISSION plans", async () => {
    const root = defaultFixturesRoot();
    const intismeran = await loadProgramFixture("corpus/live/intismeran-melanoma.json", root);
    const retatrutide = await loadProgramFixture("corpus/live/retatrutide-obesity.json", root);
    const graph = loadGraphFromProgramFixtures([intismeran, retatrutide]);

    const question: MarketQuestion = {
      marketId: "pm_intismeran_sub",
      eventType: "NDA_BLA_SUBMISSION",
      drugAssetId: intismeran.drugAsset.id,
      drugAliases: [intismeran.drugAsset.preferredName],
      sponsorId: intismeran.sponsor.id,
      indicationId: intismeran.indication.id,
      population: null,
      applicationId: intismeran.application?.id ?? null,
      linkedTrialIds: intismeran.trials.map((t) => t.id),
      endpointIds: intismeran.endpoints.map((e) => e.id),
      eventDeadline: "2027-06-30T00:00:00.000Z",
      resolutionSource: "FDA",
      resolutionDefinition: "BLA submitted by deadline",
      conditionalApprovalCounts: true,
      ambiguityFlags: [],
      parserConfidence: 0.9,
    };

    const plan = compileQueryPlan(question, {
      forecastCutoff: "2026-08-01T00:00:00.000Z",
      therapeuticArea: intismeran.indication.therapeuticArea,
    });
    const bundle = executeQueryPlan(plan, { graph });
    const lagCohort = bundle.cohorts.find((c) =>
      c.cohortDefinition.includes("PE public → historical filing lag"),
    );
    expect(lagCohort).toBeDefined();
    expect(lagCohort!.peToFilingLagSampleSize).toBeGreaterThan(0);
    expect(lagCohort!.peToFilingLagDaysMedian).toBeGreaterThan(0);
  });
});

describe("endpoint family alias matching", () => {
  it("matches OS to overall_survival filter", async () => {
    const syn = await loadProgramFixture("approved/synalphimab-nsclc.json");
    const nivo = await loadProgramFixture("corpus/retrospective/nivolumab-nsclc.json");
    const graph = loadGraphFromProgramFixtures([syn, nivo]);
    const question: MarketQuestion = {
      marketId: "pm_syn",
      eventType: "FDA_APPROVAL_BY_DATE",
      drugAssetId: syn.drugAsset.id,
      drugAliases: [syn.drugAsset.preferredName],
      sponsorId: syn.sponsor.id,
      indicationId: syn.indication.id,
      population: null,
      applicationId: syn.application?.id ?? null,
      linkedTrialIds: syn.trials.map((t) => t.id),
      endpointIds: syn.endpoints.map((e) => e.id),
      eventDeadline: "2024-12-31T00:00:00.000Z",
      resolutionSource: "FDA",
      resolutionDefinition: "Approval by date",
      conditionalApprovalCounts: true,
      ambiguityFlags: [],
      parserConfidence: 0.9,
    };
    const plan = compileQueryPlan(question, {
      forecastCutoff: "2024-06-01T00:00:00.000Z",
      therapeuticArea: "oncology",
    });
    const endpointCohort = plan.analogueCohorts.find((c) => c.label.includes("endpoint family"));
    expect(endpointCohort).toBeDefined();

    const bundle = executeQueryPlan(plan, { graph });
    const matched = bundle.cohorts.find((c) =>
      c.cohortDefinition.includes("endpoint family"),
    );
    expect(matched!.programs.length).toBeGreaterThan(0);
  });
});
