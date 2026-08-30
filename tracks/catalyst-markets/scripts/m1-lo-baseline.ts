import { loadEventFixtures } from "../ingestion/aact.js";
import { computeEventStudy } from "../event-study/abnormal-returns.js";
import { fetchDailyPrices } from "../ingestion/prices.js";
import { estimatePSuccessBaseline } from "../models/baselines.js";
import type { StructuredTrialFeatures } from "../schemas/event.js";

/** Milestone 1 — reproduce Lo-style AR/CAR + structured baseline on fixtures. */
async function main() {
  const events = (await loadEventFixtures()).filter((e) => e.outcomeLabel != null);
  const rows = [];
  for (const e of events) {
    const stock = await fetchDailyPrices(e.ticker);
    const xbi = await fetchDailyPrices("XBI");
    const study = computeEventStudy({
      stockBars: stock,
      marketBars: xbi,
      eventDate: e.eventDate,
    });
    const features: StructuredTrialFeatures = {
      phase: e.phase,
      enrollment: null,
      isOncology: true,
      isRareDisease: false,
      hasPriorApprovalSameAsset: e.eventId.includes("NCT01234567"),
      sponsorIsLargeCap: false,
      logMarketCap:
        e.companyMarketCapPreEvent != null
          ? Math.log(e.companyMarketCapPreEvent)
          : null,
      pipelineConcentration: e.pipelineConcentration,
    };
    const { pSuccess } = estimatePSuccessBaseline(features, {});
    rows.push({
      eventId: e.eventId,
      ticker: e.ticker,
      arD0: study.arD0,
      carM1P1: study.carM1P1,
      estimationDays: study.estimationDays,
      baselinePSuccess: pSuccess,
    });
  }
  console.log(JSON.stringify({ milestone: "M1", gate: "lo_baseline", rows }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
