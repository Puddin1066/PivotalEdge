# ADR 0008 — Chronological backtest and edge-vs-market report (S8)

## Status

Accepted (S8)

## Context

S8 requires corpus scale beyond the initial two-program slice and a chronological backtest producing an edge-vs-market report after transaction costs.

## Decision

- Add `@pivotaledge/evals` with `runChronologicalBacktest` (expanding-window, policy-frozen from S6).
- Expand fixture corpus: 4 programs in `fixtures/corpus/`, 12-case mock backtest in `fixtures/backtest/`.
- Market baseline: always-YES with identical stake sizing (no model selection).
- Report schema: `EdgeVsMarketReport` in `@pivotaledge/schemas`.
- Gate: `modelNetPnL > 0` and `modelNetPnL > marketBaselineNetPnL`.
- `/backtest` page and `GET /api/backtest` in web app.

## Consequences

- S9 paper trading can reuse eval harness.
- Live historical market prices replace mock asks when available.
