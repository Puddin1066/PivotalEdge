# ADR 0010 — Clinical chronological calibration corpus (S8b)

## Status

Accepted (S8b)

## Context

S8 validated betting policy on 12 mock market cases. The spec’s principal training corpus is historical FDA decisions and trials, not prediction-market history. S5 holdout used 12 synthetic tabular cases. Before trusting probabilities at scale, we need a larger retrospective clinical sample with Brier and reliability reporting — without coupling to market PnL.

## Decision

- Add `clinical_calibration_corpus` fixture kind with ≥20 curated Drugs@FDA programs (`fixtures/calibration/fda-chrono-corpus.json`).
- Add `runClinicalChronoCalibration` in `@pivotaledge/evals` — expanding-window holdout, global Brier, reliability bins, per-stratum Brier (phase, therapeutic area, filing status, phase×TA).
- Add `ClinicalCalibrationReport` schema; gate via `pnpm s8b:calibration`.
- Optional `pnpm s8b:ingest` merges manifest + openFDA approval metadata for validation (clinical features remain hand-curated).
- No market prices or betting policy in S8b.

## Consequences

- Clinical calibration can scale independently of sparse historical Polymarket data.
- S8/S9 market backtests remain regression fixtures; S8b is the path to corpus depth.
- Full KG pipeline per program is deferred; cases use curated feature rows with public application numbers.
