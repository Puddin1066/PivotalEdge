# ADR 0004 — In-memory KnowledgeGraphRepository for S4

## Status

Accepted (S4)

## Context

S4 requires `KnowledgeGraphQueryPlan` compilation, parameterized traversals, and `PrecedentBundle` retrieval with cutoff audits. PostgreSQL schema is not yet migrated.

## Decision

- Implement `@pivotaledge/kg` with `InMemoryKnowledgeGraph` loaded from `ProgramFixture` JSON.
- Expose `KnowledgeGraphRepository` interface; `InMemoryKnowledgeGraphRepository` is the S4 implementation.
- Deterministic `compileQueryPlan` (no LLM) for gate reproducibility.
- PostgreSQL-backed repository replaces in-memory when `packages/db` lands.

## Consequences

- S4 gate passes on fixtures without a running database.
- S5+ can swap repository implementation without changing plan/bundle schemas.
