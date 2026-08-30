# AGENTS.md — PivotalEdge

## Product

PivotalEdge is a clinical-regulatory probability engine with two venue tracks:

- **Track A (Polymarket):** Prediction markets queue questions; a temporal KG of trials and FDA decisions supplies evidence; deterministic models produce calibrated probabilities; a betting policy emits BET YES / BET NO / WAIT / NO BET. Spec: `docs/PIVOTALEDGE_SPEC.md`.
- **Catalyst Markets (listed equity/derivatives):** Lo-inspired event study for clinical-trial-informed edge on real-market assets — multi-agent assembly, chronological backtests, frozen live opportunity ranking. **Not Polymarket.** Package: `tracks/catalyst-markets/` (ADR 0019). Spec: `docs/LO_EVENT_STUDY_SPEC.md`.

Authoritative Track A spec: `docs/PIVOTALEDGE_SPEC.md` (synced from Notion).

## Hard rules

1. **LLM is evidence analyst, not probability oracle.** Never use uncited LLM probabilities as trade conviction.
2. **No future leakage.** Historical features require `first_public_at <= forecast_cutoff`.
3. **Separate evidence layers:** raw documents → sourced facts → extractions → calculated metrics → model inferences → user judgments → outcome labels.
4. **Outcome labels never enter model inputs** before their valid public timestamps.
5. **No Neo4j** until relational joins prove inadequate.
6. **No commercial biomedical DBs** requiring licenses in MVP.
7. **No live trading** until Phase 8 release gate passes.
8. **No MNPI.** Never seek or trade on material nonpublic information.
9. **Executable prices only** — never treat midpoint as fillable.
10. **Chronological validation only** — no random train/test splits; no asset/indication/sponsor leakage across folds.

## Current phase

**S0–S9 complete** (radar + paper trading). Local clinical KG schema populated on fixtures (ADR 0011). Critical path finished for simulation MVP. Live trading remains gated.
See `docs/DEV_SEQUENCE.md`.

## Return format after implementation work

- Files changed
- Commands run and results
- Architectural decisions
- Assumptions
- Unresolved questions
- Exact Phase 1 blockers
