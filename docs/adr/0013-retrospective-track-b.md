# ADR 0013 — Retrospective Track B (clinical + resolved markets)

## Status

Accepted

## Context

Live Polymarket FDA markets are sparse and resolve slowly (YE2026+). Track A enrichment supports live scoring but cannot calibrate conviction. Track B needs a solid retrospective path: clinical chrono holdout plus resolved-market Brier/edge, without waiting for live payouts.

## Decision

- Expand curated FDA chrono corpus via `fixtures/calibration/fda-application-manifest.json` → `pnpm s8b:ingest` → `fda-chrono-corpus.json` (includes Jul-2025 PDUFA-window outcomes).
- Clinical calibration (`pnpm s8b:calibration`) trains only on cases with `forecastCutoff <` test cutoff (no same-day leakage).
- Resolved Polymarket corpus: `fixtures/backtest/resolved-fda-july2025.json` (Gamma outcomes; curated as-of asks with explicit mid±spread provenance when CLOB history is unavailable).
- `pnpm retro:validate` runs:
  1. **Hard:** S8b clinical Brier beats base-rate
  2. **Hard:** resolved markets scored (n≥6) with clinical train `forecastCutoff <` market cutoff; skill on **Brier and/or edge** vs market (proxy asks may beat simple clinical Brier while policy still finds edge)
  3. **Hard:** synthetic S8 edge smoke still passes
  4. **Reported:** model vs market Brier, edge after costs, ask provenance
- Report written to `fixtures/evals/retrospective-report.json`; Platform dashboard surfaces last gate summary.
- CLOB archives remain outside the clinical KG; join only at score/backtest time.

## Consequences

- Ask proxies are weaker than archived CLOB; replace when historical executable quotes are available.
- Prefer upgrading ask provenance over softening clinical features to chase Brier.
- Live opportunity conviction remains DEMO until retrospective gates pass consistently at larger N with real CLOB history.
