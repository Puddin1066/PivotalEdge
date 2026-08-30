# ADR 0001 — Greenfield pnpm monorepo

## Status

Accepted (S0)

## Context

PivotalEdge is a new product. The Notion spec defines a monorepo with `apps/*` and `packages/*`. MIRP exists separately and must not be mutated for this build.

## Decision

- Create `/Users/JJR/PivotalEdge` as a greenfield pnpm workspace.
- Use TypeScript for shared contracts (`@pivotaledge/schemas`).
- Defer wiring `apps/web`, `apps/worker`, and non-schema packages until their steps (S1+).
- Keep directory placeholders matching the spec layout.

## Consequences

- Clean install and CI target a single package in S0.
- Later steps add workspace members without renaming the root.
