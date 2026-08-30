# ADR 0019 — Catalyst Markets track (Lo event-study / listed derivatives)

## Status

Accepted

## Context

PivotalEdge Track A is a **Polymarket**-queued clinical-regulatory probability engine (BET YES/NO). The Notion *Lo Event-Study Multi-Agent AI Implementation Spec* defines a second product surface: reproduce Lo/MIT clinical-trial event studies, then add AI-native representations to predict **abnormal equity returns** and identify edge on **listed financial assets/derivatives** — not prediction markets.

Mixing venues in one package risks Polymarket coupling, BET_\* policy leakage into equity labels, and unclear live-trading gates.

## Decision

1. Create an independent product tree at `tracks/catalyst-markets/` (`@pivotaledge/catalyst-markets`).
2. Venue = listed equity / hedges / later options — **Polymarket adapters and BET_\* scoring are forbidden imports**.
3. Share only clinical/temporal primitives via `@pivotaledge/schemas` (and later thin KG adapters). Do not fork AACT/cutoff rules.
4. Implement Notion multi-agent assembly as a deterministic pipeline (`orchestration/graph.ts`) with structured agent JSON contracts.
5. Storage: event-scoped fixtures first; Postgres + pgvector later; no Neo4j until joins fail; no commercial licensed biomedical DBs.
6. Milestones M1–M5 match Notion §19 (baseline → corpus → representations → edge → frozen forward).
7. Portfolio/hedging layer is downstream of demonstrated event-level chronological OOS edge.

## Consequences

- `pnpm-workspace.yaml` includes `tracks/*`.
- Name “Track B” in docs refers to this catalyst-markets product when discussing Lo/equity; ADR 0013 “retrospective Track B” remains the Polymarket retrospective clinical path — do not conflate.
- Live brokerage execution remains gated; package may freeze forecasts and rank opportunities only.
- Cost/storage: embed only event-scoped corpus; mock/hash embeddings until paid APIs are justified by OOS lift.

## References

- Notion: Pivotal Edge — Lo Event-Study Multi-Agent AI Implementation Spec
- `tracks/catalyst-markets/README.md`
- ADR 0002 (Postgres-first), ADR 0003 (LLM not probability oracle)
