# PivotalEdge

Clinical-regulatory probability intelligence: turn drug-related prediction markets into structured questions, query a temporal knowledge graph of historical trials and FDA decisions, and return **BET YES / BET NO / WAIT / NO BET** with max price and stake.

**Spec (authoritative):** [Notion](https://app.notion.com/p/3c3bc227e87581adb4d3e9aa81bdfb5b) · local mirror: [`docs/PIVOTALEDGE_SPEC.md`](docs/PIVOTALEDGE_SPEC.md)

## Status

**S0–S9 complete.**

```bash
pnpm check
pnpm s9:paper
pnpm web:dev      # /radar /dossier /backtest /paper
```

`OPENAI_API_KEY` is loaded from `.env` (copied from sibling `MIRP/.env`).

```
apps/web          Next.js UI (radar, dossier, timeline, validation, ingestion)
apps/worker       Python ingestion / extraction / forecast jobs
packages/db       PostgreSQL schema, migrations, queries
packages/schemas  Shared domain + provenance contracts
packages/adapters ClinicalTrials.gov, Drugs@FDA, openFDA, PubMed, SEC, Polymarket
packages/agents   Market parser, entity resolver, extractors, analogue ranker
packages/features Feature engineering
packages/models   Baseline, Bayesian, GBM, survival, calibration
packages/scoring  Edge / opportunity scoring
packages/workflows Orchestration
packages/evals    Chronological validation
fixtures/         Synthetic approved / CRL / failed-trial / market cases
docs/adr          Architecture decision records
```

## Non-negotiables

- No future leakage: features only from `first_public_at <= forecast_cutoff`
- Separate sourced facts, extractions, metrics, inferences, and labels
- Never train primary clinical model on Polymarket resolutions
- Executable prices only (not midpoints)
- Chronological validation only

## Quick start (S0)

```bash
pnpm install
pnpm check          # format, lint, typecheck, tests
pnpm validate:env   # optional; needs built schemas or tsx path
```

S0 gate: one approved program, one CRL program, and one Polymarket market validate against `@pivotaledge/schemas`.

## Phases

| Phase | Scope                                      |
| ----- | ------------------------------------------ |
| 0     | Schemas, provenance, tooling, fixtures, CI |
| 1     | Polymarket discovery + entity mapping      |
| 2     | Evidence adapters + document vault         |
| 3     | Structured extraction + citations          |
| 4     | Temporal KG + query plans                  |
| 5     | Probability / timing models                |
| 6     | Edge engine + dashboard                    |
| 7     | Retrospective market comparison            |
| 8     | Prospective paper trading                  |
