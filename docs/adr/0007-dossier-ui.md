# ADR 0007 — Thin dossier UI (S7)

## Status

Accepted (S7)

## Context

S7 requires one live opportunity viewable end-to-end without CLI. S6 policy and frozen snapshots are stable.

## Decision

- Scaffold `apps/web` (Next.js 15 App Router, Tailwind).
- Extract orchestration to `@pivotaledge/workflows` (`evaluateOpportunity`).
- Server-render `/dossier` from fixture pipeline; expose `GET /api/opportunity`.
- Clearly label mock order books in UI until live CLOB in S8.

## Consequences

- Human MVP for verifying BET_* output on Synalphimab fixture.
- Radar, timeline, and ingestion screens deferred.
