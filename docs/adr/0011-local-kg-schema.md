# ADR 0011 — Local clinical KG schema populate (Wave 1–4)

## Status

Accepted

## Context

Edge detection needs a temporal clinical knowledge graph for probability features, plus separate Polymarket CLOB quotes for executable prices. Neo4j is deferred (ADR 0002). Notion is unsuitable as a graph store. The in-memory KG loaded from JSON fixtures is the local store until SQLite/Postgres.

## Decision

- Extend `ProgramFixture` / entity schemas with: trial operational fields, `Endpoint.endpointFamily` enum, `Designation`, `ApprovedTherapyLink`, `PriorApprovalLink`, `Indication.efoId`, `Mechanism.firstInClass`.
- Populate all program fixtures under `fixtures/approved`, `fixtures/crl`, `fixtures/corpus`.
- Expose `clinicalFeaturesAtCutoff` on `InMemoryKnowledgeGraph` for as-of feature snapshots.
- Keep CLOB / `OrderBookSnapshot` outside clinical training features (market layer only).
- Validate with `pnpm kg:validate`.

## Consequences

- Forecasts use `base-rate-calibrated@2` with mild boosts for biomarker, orphan, prior approval, and designations.
- `pnpm kg:holdout` derives cases from local programs; Brier gate on this tiny set is informational until corpus scales.
- Frozen opportunity snapshot must be regenerated after model version bumps.
