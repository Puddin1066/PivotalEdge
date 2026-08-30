# ADR 0009 — Opportunity radar and prospective paper trading (S9)

## Status

Accepted (S9)

## Context

S9 is the live-trade release gate: a prospective sample must show calibration and positive simulated net before any live orders. Live execution remains disabled.

## Decision

- Freeze calibration weights at `freezeCutoff`; apply frozen model + `betting-policy@1` forward without refitting.
- `runProspectivePaperSample` produces `ProspectiveSampleReport` with `calibrationStatus: prospective`.
- Gate: `modelBrier ≤ marketBrier` AND `simulatedNetPnL > 0` AND ≥1 paper trade.
- `PaperPortfolio.liveTradingEnabled` is always `false`.
- Opportunity radar ranks fixture dossier + paper-sample signals; UI at `/radar` and `/paper`.

## Consequences

- Critical path S0–S9 complete for MVP simulation loop.
- Live CLOB execution and real Polymarket history remain deferred.
