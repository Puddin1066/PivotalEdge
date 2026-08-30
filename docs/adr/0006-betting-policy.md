# ADR 0006 — Deterministic betting policy with frozen snapshots (S6)

## Status

Accepted (S6)

## Context

S6 requires the first reproducible `BetRecommendation` comparing calibrated forecast to executable CLOB prices. Midpoints must never be used as fillable prices.

## Decision

- Implement `@pivotaledge/scoring` with edge calculation, risk assessment, and `betting-policy@1`.
- Add Polymarket CLOB read adapter (`fetchClobOrderBook`) for live books; S6 gate uses mock order-book fixtures.
- Introduce `FrozenOpportunitySnapshot` in `@pivotaledge/schemas` for reproducible inputs.
- Fingerprint recommendations by content hash (excludes wall-clock timestamps).

## Policy rules (v1)

- Executable YES price = best ask on YES token; NO price = best ask on NO token.
- Net edge = conservative probability minus executable price minus fee rate.
- `BET_YES` / `BET_NO` when edge ≥ 5% and evidence confidence ≥ moderate.
- `WAIT` when edge exists but evidence confidence is low.
- `NO_BET` otherwise.
- Stake capped at 2% bankroll via fractional Kelly.

## Consequences

- S7 dossier UI can render `BetRecommendation` without policy changes.
- Live CLOB integration available; gate remains fixture-driven for CI stability.
