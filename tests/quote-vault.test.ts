import { describe, expect, it } from "vitest";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  appendQuoteRows,
  latestQuotesByMarket,
  loadQuoteArchive,
  quoteAsOf,
  summarizeQuoteVault,
} from "@pivotaledge/adapters";
import { yesNoTokenIds } from "@pivotaledge/adapters";
import type { ArchivedQuoteRow } from "@pivotaledge/schemas";

describe("quote vault", () => {
  it("maps YES/NO token indices from outcomes", () => {
    const tokens = yesNoTokenIds({
      clobTokenIds: ["tok_a", "tok_b"],
      outcomes: ["No", "Yes"],
    });
    expect(tokens).toEqual({ yes: "tok_b", no: "tok_a" });
  });

  it("appends and loads JSONL archive", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "pe-quotes-"));
    const row: ArchivedQuoteRow = {
      kind: "archived_clob_quote",
      capturedAt: "2026-08-25T12:00:00.000Z",
      marketId: "1162139",
      tokenYesId: "yes",
      tokenNoId: "no",
      bestAskYes: 0.03,
      bestAskNo: 0.98,
      bestAskYesSize: 100,
      bestAskNoSize: 200,
      source: "quotes_snapshot",
      slug: "retatrutide-obesity",
    };
    await appendQuoteRows([row], root);
    await appendQuoteRows(
      [
        {
          ...row,
          capturedAt: "2026-08-25T18:00:00.000Z",
          bestAskYes: 0.04,
        },
      ],
      root,
    );

    const all = await loadQuoteArchive(root);
    expect(all).toHaveLength(2);
    const latest = latestQuotesByMarket(all).get("1162139");
    expect(latest?.bestAskYes).toBe(0.04);
    expect(quoteAsOf(all, "1162139", "2026-08-25T15:00:00.000Z")?.bestAskYes).toBe(0.03);

    const summary = summarizeQuoteVault(all, root);
    expect(summary.totalRows).toBe(2);
    expect(summary.distinctMarkets).toBe(1);

    const raw = await readFile(path.join(root, "quotes/archive.jsonl"), "utf8");
    expect(raw.trim().split("\n")).toHaveLength(2);
  });
});
