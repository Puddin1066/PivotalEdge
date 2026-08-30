import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  lookupCompetitorApproval,
  lookupOrangeBookApproval,
  lookupRetrospectiveApproval,
  resolveOrangeBookCsvPath,
  searchOrangeBookByDrugName,
} from "@pivotaledge/adapters";
import { defaultFixturesRoot, loadProgramFixture } from "@pivotaledge/schemas";
import { loadGraphFromProgramFixtures, programToAssertions } from "@pivotaledge/kg";
import { inferredReviewWindowDays } from "@pivotaledge/models";

describe("Orange Book local CSV", () => {
  it("resolves fixture CSV path", async () => {
    const csvPath = await resolveOrangeBookCsvPath();
    expect(csvPath).toBeTruthy();
    expect(csvPath).toContain("orange_book");
  });

  it("finds gemcitabine approval date", async () => {
    const fixturesCsv = path.join(
      defaultFixturesRoot(),
      "regulatory/orange_book_products_2026.csv",
    );
    const hit = await lookupOrangeBookApproval("Gemcitabine", fixturesCsv);
    expect(hit).not.toBeNull();
    expect(hit!.approvalDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(hit!.productName.toLowerCase()).toContain("gemcitabine");
  });

  it("finds liraglutide for obesity competitor enrichment", async () => {
    const fixturesCsv = path.join(
      defaultFixturesRoot(),
      "regulatory/orange_book_products_2026.csv",
    );
    const hits = await searchOrangeBookByDrugName("Liraglutide", fixturesCsv);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.some((h) => h.approvalDate != null)).toBe(true);
  });
});

describe("Retrospective competitor approvals (biologics)", () => {
  it("resolves pembrolizumab from retrospective KG", async () => {
    const hit = await lookupRetrospectiveApproval("Pembrolizumab");
    expect(hit).not.toBeNull();
    expect(hit!.sourceSystem).toBe("kg.retrospective");
    expect(hit!.approvedAt.startsWith("2014-09-04")).toBe(true);
  });

  it("prefers Orange Book for gemcitabine, retrospective for nivolumab", async () => {
    const chemo = await lookupCompetitorApproval("Gemcitabine");
    expect(chemo?.sourceSystem).toBe("fda.orange_book_local");

    const nivo = await lookupCompetitorApproval("Nivolumab");
    expect(nivo?.sourceSystem).toBe("kg.retrospective");
    expect(nivo?.approvedAt.startsWith("2014-12-22")).toBe(true);
  });

  it("resolves tirzepatide from retrospective when absent from Orange Book", async () => {
    const hit = await lookupCompetitorApproval("Tirzepatide");
    expect(hit).not.toBeNull();
    expect(hit!.sourceSystem).toBe("kg.retrospective");
    expect(hit!.approvedAt.startsWith("2022-05-13")).toBe(true);
  });

  it("resolves semaglutide from curated override", async () => {
    const hit = await lookupCompetitorApproval("Semaglutide");
    expect(hit).not.toBeNull();
    expect(hit!.sourceSystem).toBe("enrichment_override");
    expect(hit!.approvedAt.startsWith("2017-12-05")).toBe(true);
  });

  it("resolves sotorasib via Orange Book brand alias Lumakras", async () => {
    const hit = await lookupCompetitorApproval("Sotorasib");
    expect(hit).not.toBeNull();
    expect(hit!.sourceSystem).toBe("fda.orange_book_local");
    expect(hit!.productLabel.toLowerCase()).toContain("lumakras");
  });
});

describe("programToAssertions regulatory clock", () => {
  it("emits clock facts when application has provenance", async () => {
    const fixture = await loadProgramFixture("corpus/live/retatrutide-obesity.json");
    const graph = loadGraphFromProgramFixtures([fixture]);
    const program = graph.listPrograms()[0]!;
    const assertions = programToAssertions(program);
    const claims = assertions.map((a) => a.claim);
    expect(claims.some((c) => c.includes("Sponsor filing guidance"))).toBe(true);
    expect(assertions.some((a) => a.id.includes("clock_expected_filing"))).toBe(true);
  });
});

describe("FDA review duration priors", () => {
  it("loads fixture windows for known review programs", () => {
    expect(inferredReviewWindowDays("cnpv")).toBe(45);
    expect(inferredReviewWindowDays("priority")).toBe(180);
    expect(inferredReviewWindowDays("standard")).toBe(300);
    expect(inferredReviewWindowDays(null)).toBe(240);
  });
});
