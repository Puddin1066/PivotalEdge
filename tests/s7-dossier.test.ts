import { describe, expect, it } from "vitest";

import { evaluateOpportunity } from "@pivotaledge/workflows";
import { BetRecommendationSchema, ForecastSchema } from "@pivotaledge/schemas";

describe("S7: dossier workflow gate", () => {
  it("evaluates synalphimab opportunity end-to-end from fixtures", async () => {
    const dossier = await evaluateOpportunity({ livePipeline: true });

    expect(dossier.market.question).toContain("Synalphimab");
    expect(ForecastSchema.safeParse(dossier.forecast).success).toBe(true);
    expect(BetRecommendationSchema.safeParse(dossier.recommendation).success).toBe(true);
    expect(dossier.recommendation.action).toBe("BET_YES");
    expect(dossier.fingerprint.contentHash).toHaveLength(64);
    expect(dossier.metadata.orderBooksAreMock).toBe(true);
  });

  it("frozen snapshot and live pipeline produce matching fingerprints", async () => {
    const frozen = await evaluateOpportunity({ livePipeline: false });
    const live = await evaluateOpportunity({ livePipeline: true });
    expect(frozen.fingerprint.contentHash).toBe(live.fingerprint.contentHash);
  });
});
