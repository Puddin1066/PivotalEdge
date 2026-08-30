# ADR 0012 — Polymarket-prioritized KG enrichment (Track A)

## Status

Accepted

## Context

Live FDA/clinical Polymarket markets are sparse. Enriching only for those assets is efficient for opportunity scoring (T1) but insufficient for calibration (T2). Track A prioritizes open markets; Track B (chrono FDA corpus) remains separate.

## Decision

- Seed live programs in `fixtures/enrichment/seed-programs.json`.
- `pnpm kg:enrich` pulls CT.gov (+ Open Targets competition when available), stores raw payloads in `data/vault`, writes `fixtures/corpus/live/*.json`.
- `pnpm kg:score-live` joins enriched programs to live CLOB asks → `fixtures/opportunities/live/` + `enrichment/live-score-report.json` (`dataLane: live_polymarket`, conviction still DEMO until T2 calibration).
- Web **Platform** dashboard (`/platform`) exhibits pipeline logic, KG inventory, ranked live opportunities, and buttons to run enrich / rescore (`POST /api/kg/run`).
- Priority queue (2026-08): intismeran (skin-cancer vaccine ladder), retatrutide, daraxonrasib.
- `pnpm kg:validate` / `kg:holdout` include `corpus/live`.
- CLOB quotes stay outside the clinical KG (joined at score time).
- Track B retrospective is ADR 0013 (`pnpm retro:validate`), not this enrichment path.

## Consequences

- Live programs are mostly `status: active` (not yet approval-labeled), so they expand feature coverage for scoring but do not all enter chrono holdout until resolved.
- Re-run `pnpm kg:enrich` when seeds or public trial/FDA facts change.
