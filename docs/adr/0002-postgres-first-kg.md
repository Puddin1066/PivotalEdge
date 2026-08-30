# ADR 0002 — PostgreSQL-first knowledge graph (defer Neo4j)

## Status

Accepted (S0 / spec)

## Context

The domain is a temporal clinical-regulatory graph. Neo4j is attractive for multi-hop traversal but adds ops cost and premature commitment.

## Decision

- Represent the graph as relational tables and join tables in PostgreSQL (Supabase later).
- Expose a `KnowledgeGraphRepository` interface so Neo4j can be introduced later if multi-hop retrieval proves inadequate.
- Do not add Neo4j in S0–S7.

## Consequences

- S4 implements parameterized SQL (or query-builder) traversals behind the interface.
- Cypher examples in the spec are contracts, not runtime requirements.
