# ADR 0003 — LLM as evidence analyst, not probability oracle

## Status

Accepted (spec)

## Context

OpenAI models will parse markets, resolve entities, extract structured facts, and draft dossiers. Using model eloquence as trade conviction would violate scientific and product boundaries.

## Decision

- LLMs may only perform permitted tasks listed in the spec (parse, resolve, extract, rank analogues, cite, red-team).
- Probabilities and BET_* actions come from deterministic statistical models and a deterministic betting policy.
- Every non-null extracted critical fact requires document ID, exact passage, and locator.
- Model calls are recorded (`ModelCall`) with prompt/schema versions, tokens, and cost.

## Consequences

- `@pivotaledge/schemas` separates evidence layers and forbids treating midpoint prices as executable.
- S5+ model packages must not accept uncited LLM probabilities as inputs.
