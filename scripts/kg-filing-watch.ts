#!/usr/bin/env tsx
/**
 * Filing guidance watch list for live seed programs (Track A).
 * Reads seeds + local corpus; flags programs awaiting public filing guidance.
 * Does not scrape IR — operator updates seed when guidance is public.
 *
 * Usage: pnpm kg:filing-watch
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  assessProgramContractCoverage,
  eventTypesFromSeed,
} from "@pivotaledge/kg";
import { defaultFixturesRoot, loadProgramFixture } from "@pivotaledge/schemas";
import type { MarketEventType } from "@pivotaledge/schemas";

type SeedProgram = {
  slug: string;
  preferredName: string;
  sponsorName: string;
  nctId: string;
  polymarketMarketIds: string[];
  marketEventTypes?: Record<string, MarketEventType>;
  regulatoryClock?: {
    expectedFilingAt?: string | null;
    clockPassage?: string | null;
    clockSourceUrl?: string | null;
  };
  notes?: string;
};

async function main() {
  const root = defaultFixturesRoot();
  const seedRaw = JSON.parse(
    await readFile(path.join(root, "enrichment/seed-programs.json"), "utf8"),
  ) as { programs: SeedProgram[] };

  const watches: Record<string, unknown>[] = [];

  for (const seed of seedRaw.programs) {
    const fixturePath = `corpus/live/${seed.slug}.json`;
    let fixture;
    try {
      fixture = await loadProgramFixture(fixturePath, root);
    } catch {
      watches.push({
        slug: seed.slug,
        status: "missing_fixture",
        action: `Run pnpm kg:enrich for ${seed.slug}`,
      });
      continue;
    }

    const eventTypes = eventTypesFromSeed(seed);
    const assessments = eventTypes.map((eventType) => ({
      eventType,
      ...assessProgramContractCoverage(fixture, eventType),
    }));

    const needsReviewClockWatch = assessments.some(
      (a) =>
        a.eventType === "FDA_APPROVAL_BY_DATE" &&
        a.requiredMissing.includes("review_clock") &&
        !a.requiredPresent.includes("review_clock") &&
        !a.requiredPresent.includes("review_clock_inferred"),
    );

    const needsFilingGuidance = assessments.some(
      (a) =>
        a.eventType === "NDA_BLA_SUBMISSION" &&
        a.requiredMissing.includes("expectedFilingAt") &&
        !a.requiredPresent.includes("acceptedAt") &&
        !a.requiredPresent.includes("pdufaDate"),
    );

    const worst = assessments.reduce<"complete" | "partial" | "blocked">((w, a) => {
      if (a.contractCoverage === "blocked") return "blocked";
      if (a.contractCoverage === "partial" && w !== "blocked") return "partial";
      return w;
    }, "complete");

    watches.push({
      slug: seed.slug,
      preferredName: seed.preferredName,
      sponsorName: seed.sponsorName,
      nctId: seed.nctId,
      polymarketMarketIds: seed.polymarketMarketIds,
      contractCoverage: worst,
      needsFilingGuidanceWatch: needsFilingGuidance,
      needsReviewClockWatch,
      seedExpectedFilingAt: seed.regulatoryClock?.expectedFilingAt ?? null,
      fixtureExpectedFilingAt: fixture.application?.expectedFilingAt ?? null,
      assessments: assessments.map((a) => ({
        eventType: a.eventType,
        contractCoverage: a.contractCoverage,
        requiredMissing: a.requiredMissing,
        contractNotes: a.contractNotes,
      })),
      operatorAction: needsFilingGuidance
        ? "Watch sponsor IR; when filing guidance is public, set regulatoryClock.expectedFilingAt on seed + re-run pnpm kg:enrich && pnpm edge:scan"
        : needsReviewClockWatch
          ? "Watch for BLA acceptance / PDUFA / sponsor filing date — review_clock still missing (no cohort-only YES bets)"
          : worst === "complete"
            ? "No filing watch — contract clocks satisfied for linked event types"
            : worst === "partial"
              ? "Partial review_clock_inferred — BET_NO may be actionable; await sponsor clock for YES"
              : "Review contract gaps on /ops/kg",
      clockSourceUrl: seed.regulatoryClock?.clockSourceUrl ?? null,
      notes: seed.notes ?? null,
    });
  }

  const report = {
    kind: "filing_watch_report",
    generatedAt: new Date().toISOString(),
    programs: watches,
    summary: {
      total: watches.length,
      filingWatch: watches.filter((w) => w.needsFilingGuidanceWatch === true).length,
      blocked: watches.filter((w) => w.contractCoverage === "blocked").length,
    },
  };

  await mkdir(path.join(root, "enrichment"), { recursive: true });
  const outPath = path.join(root, "enrichment/filing-watch-report.json");
  await writeFile(outPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ report: "fixtures/enrichment/filing-watch-report.json", ...report.summary }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
