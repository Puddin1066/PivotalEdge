# Lo Event-Study — Catalyst Markets Spec (synced excerpt)

Source: Notion *Pivotal Edge — Lo Event-Study Multi-Agent AI Implementation Spec* (2026-08-30).  
Implementation: `tracks/catalyst-markets/` (ADR 0019).

## Thesis

Estimate:

1. \(P(\text{success} \mid \text{info before catalyst})\)
2. \(E(\text{abnormal return} \mid \text{outcome, exposure, expectations})\)

Edge = \(P_{model} - P_{market}\); EV = \(P \cdot R_{+}+(1-P)\cdot R_{-}\).

Venue: **listed equity / derivatives**. Not Polymarket.

## Hard constraints

- Mandatory `informationCutoff` on every event
- Chronological validation only
- Postgres + pgvector first; Neo4j optional later
- Do not embed all ~600k trials — event-scoped only
- Agents exchange structured JSON; thesis is the prose layer
- No commercial licensed biomedical DBs for MVP

## Agent set

Trial → Outcome → Lineage → Company → Market → Event-Study → Literature → Graph Retrieval → Clinical Prediction → Equity Response → Ensemble → Audit → Thesis

## Modeling ladder

A structured baseline → B + embeddings → C + KG features → D + market expectations. Stop only after A–D on frozen holdout.

## Package map

See `tracks/catalyst-markets/README.md` for directory ↔ Notion §18 mapping.
