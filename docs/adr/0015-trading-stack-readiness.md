# ADR 0015 — Trading-stack readiness: quote vault + paper path

## Status

Accepted

## Context

Simulation MVP (S0–S9) exists, but live BET_* still carries DEMO clinical conviction. Retrospective clinical validation is progressing (ADR 0014); closed-market CLOB history is weak (ADR 0013). The binding gap for Bar A (paper-ready) is an append-only archive of **executable** asks on open seeded markets.

## Decision

- **Quote vault** (`fixtures/quotes/archive.jsonl`): append-only YES/NO best ask + size; never stored in the clinical KG.
- `pnpm quotes:snapshot` snapshots all `seed-programs.json` Polymarket IDs.
- `pnpm kg:score-live` also appends vault rows when it fetches CLOB.
- `pnpm paper:live` opens simulated positions from latest vault quotes + frozen clinical weights; writes `fixtures/evals/live-paper-report.json` and `trading-readiness-report.json`.
- **Bar A paper-ready:** clinical + KG holdout beat base rate **and** vault covers all seeded markets with **fresh** asks (≤48h).
- **Calibrated conviction (exit DEMO):** ≥80 clinical chrono cases, stable KG holdout (≥15), and fresh executable asks for seeded markets. Multi-day vault depth is **informational** for later edge-vs-market proof — FDA Polymarket books and clinical labels do not refresh on a daily novelty cadence, so calendar waiting is not a graduation gate.
- **Bar B live trading:** remains disabled (`liveTradingEnabled: false`) until calibrated conviction + resolved prospective PnL gate + execution adapter + release review.

## Consequences

- Running `quotes:snapshot` on a schedule is now the primary way to build CLOB history going forward.
- Platform should surface readiness blockers; DEMO label stays until calibrated conviction criteria pass.
