# ADR 0017 — Lite portfolio risk view (Ops)

## Status

Accepted

## Context

`portfolio-policy@1` sizes an edge-weighted book and the UI can imply large independent EVs. Operators correctly noted that summing line EVs without uncertainty, dependence, or liquidity is not how a desk would green-light a deploy. A full institutional risk stack is premature; a **lite** risk page is the next useful step.

## Decision

- Specify `/ops/risk` in `docs/UI_OPS_RISK_SPEC.md` before UI work.
- Engine `portfolio-risk@1`: naive EV, scenario shocks, Bernoulli loss distribution, fragility cushions, liquidity gates on the **existing** portfolio suggestion.
- Do not auto-trade; do not replace per-market rationale.

## Consequences

- Portfolio remains “what to size”; Risk becomes “how this book dies.”
- Implementation follows the spec’s acceptance criteria and versioned shock table.
- Future Kalshi / multi-venue risk is out of scope until adapters exist.
