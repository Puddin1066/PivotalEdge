import { loadEventFixtures } from "../ingestion/aact.js";
import { auditLeakage } from "../backtest/leakage.js";
import { partitionBySplit } from "../backtest/temporal-split.js";
import { CatalystEventSchema } from "../schemas/event.js";

/** Milestone 2 — validate event corpus + cutoffs + chronological partition. */
async function main() {
  const events = await loadEventFixtures();
  const parsed = events.map((e) => CatalystEventSchema.parse(e));
  const leakage = parsed.map((e) => ({
    eventId: e.eventId,
    ...auditLeakage({
      informationCutoff: e.informationCutoff,
      eventDate: e.eventDate,
      evidence: [],
    }),
  }));
  const parts = partitionBySplit(parsed);
  console.log(
    JSON.stringify(
      {
        milestone: "M2",
        nEvents: parsed.length,
        splits: {
          train: parts.train.length,
          validate: parts.validate.length,
          test: parts.test.length,
          forward: parts.forward.length,
        },
        leakageFailures: leakage.filter((x) => !x.ok).length,
        events: parsed.map((e) => ({
          eventId: e.eventId,
          cutoff: e.informationCutoff,
          outcome: e.outcomeLabel,
        })),
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
