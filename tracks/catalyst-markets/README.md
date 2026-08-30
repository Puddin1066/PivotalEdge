# Catalyst Markets (Lo Event-Study Track)

**Venue:** listed equity and financial derivatives around clinical/regulatory catalysts.  
**Not Polymarket.** Prediction-market BET_\* policy and CLOB adapters are out of scope for this package.

Inspired by the Andrew Lo / MIT clinical-trial event-study framework (reproduce as Model 0 baseline), then layer semantic trial representations, graph precedents, company exposure, and market-expectation features to identify **investable edge** on real-market instruments.

Authoritative Notion source: *Pivotal Edge — Lo Event-Study Multi-Agent AI Implementation Spec*.

## Objectives

1. **Multi-agent assembly** — deterministic orchestration of trial → lineage → company → market → literature → graph retrieval → clinical P → equity response → ensemble → audit → thesis.
2. **Retrospective testing** — chronological train/validate/test only; leakage audit fails closed.
3. **Live opportunity identification** — freeze pre-catalyst forecasts; rank by model vs market-implied edge and probability-weighted CAR.

## Independence

| May use | Must not use |
| -------- | ------------- |
| `@pivotaledge/schemas` (cutoffs, provenance) | `@pivotaledge/scoring` BET_\* / PM policy |
| Shared clinical IDs later via thin adapters | Polymarket quote vault / CLOB |
| Public AACT, FDA, PubMed, SEC, listed prices | Commercial licensed biomedical DBs |
| Postgres + pgvector (when wired) | Neo4j until joins prove inadequate |

## Package layout

Mirrors Notion §18 under `tracks/catalyst-markets/`:

- `schemas/` — canonical event, outcomes, agent contracts, predictions
- `event-study/` — expected return, AR, CAR windows (Lo baseline)
- `agents/` — structured JSON agents (no prose handoff)
- `orchestration/` — multi-agent pipeline + shared state
- `models/` — Model 0→4 ladder (baseline first)
- `backtest/` — temporal splits, leakage, metrics
- `portfolio/` — hedges / optimizer (after event-level OOS edge)
- `embeddings/` — field-aware, **event-scoped only** (not all CT.gov)
- `fixtures/` — offline catalyst + price windows

## Milestones

| Script | Gate |
| ------ | ---- |
| `pnpm --filter @pivotaledge/catalyst-markets m1:baseline` | Reproducible AR/CAR + structured baseline |
| `m2:corpus` | Leakage-controlled event objects |
| `m3:repr` | Embeddings + minimal graph features |
| `m4:edge` | Ranked edge / expected catalyst return |
| `m5:forward` | Frozen live forecasts (no retrospective edits) |

## Run

```bash
pnpm --filter @pivotaledge/catalyst-markets pipeline:run
pnpm --filter @pivotaledge/catalyst-markets live:scan
pnpm --filter @pivotaledge/catalyst-markets test
```

## Operating principle

Smallest system that can test whether clinical-trial-informed representations produce chronological out-of-sample equity edge. Agents are tools; the event-study dataset and temporal integrity are the product foundation.
