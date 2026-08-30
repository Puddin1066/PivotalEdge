# ADR 0016 — Edge-weighted Ops portfolio suggestion

## Status

Accepted

## Context

Single-name `betting-policy@1` stakes ignore concentration across correlated FDA/clinical Polymarket questions (same program ladder, same TA, same deadline quarter). Operators asked whether an edge-weighted book is a better risk posture than isolated bets.

## Decision

- Add `portfolio-policy@1`: suggestion-only deploy book from eligible `BET_*` live scores.
- Size by edge × confidence × liquidity, then clamp by program / TA / deadline-quarter / name caps.
- Surface at `/ops/portfolio` (+ Today strip). Never auto-execute.
- Document in `docs/PORTFOLIO_POLICY_SPEC.md`.

## Consequences

- Ops can budget risk without claiming diversification eliminates FDA regime risk.
- Kalshi (or other venues) can later feed the same builder once adapters exist.
- Paper and manual books stay separate; portfolio suggestion uses manual bankroll only.
