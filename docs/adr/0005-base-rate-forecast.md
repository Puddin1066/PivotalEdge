# ADR 0005 — Base-rate-first calibrated forecast (S5)

## Status

Accepted (S5)

## Context

S5 requires deterministic probabilities with component decomposition, intervals, model version, and chronological holdout that beats naive base-rate Brier. Complex models (Bayesian, GBM, survival) are deferred per `DEV_SEQUENCE.md`.

## Decision

- Implement `@pivotaledge/models` with illustrative phase × therapeutic-area base-rate table.
- Shrink cohort empirical rates toward base-rate prior (Beta-binomial).
- Apply deterministic feature adjustments (primary endpoint met, application filed).
- Decompose `FDA_APPROVAL_BY_DATE` into `ForecastComponent` chain ending in `decision_by_T`.
- Calibrate holdout weights via grid search on strictly prior cases (chronological expanding window).
- Synthetic holdout corpus in `fixtures/holdout/` for gate (mock data, not live API).

## Consequences

- S6 can consume `Forecast` without model package changes.
- Bayesian / GBM only if base-rate pipeline underperforms on expanded corpus (S8).
