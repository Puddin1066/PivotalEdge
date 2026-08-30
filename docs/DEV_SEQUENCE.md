# Efficient sequential development

Optimized critical path for PivotalEdge. Prefer a thin vertical slice over horizontal breadth.

**Canvas:** open `dev-sequence` beside chat for the interactive view.

## Principle

Clinical corpus → calibrated probability is the hard path. Markets are the demand queue and monetization surface. Build both early, deepen corpus before expanding markets, and defer every adapter/model/UI that is not required for the first reproducible `BetRecommendation`.

## Steps (strict)

| Step   | Name                           | Depends | Gate                                                           |
| ------ | ------------------------------ | ------- | -------------------------------------------------------------- |
| **S0** | Contracts & tooling            | —       | 1 program + 1 FDA decision + 1 market validate against schemas |
| **S1** | Market → `MarketQuestion`      | S0      | ≥10 drug markets parsed; no silent ambiguity                   |
| **S2** | Evidence vault (2 programs)    | S0      | 1 approved + 1 CRL/failure reconstructible as-of cutoff        |
| **S3** | Cited extraction               | S2      | ≥95% schema validity; every critical non-null cites a passage  |
| **S4** | Relational KG + query plan     | S1, S3  | 1 market → plan → `PrecedentBundle` with zero leakage          |
| **S5** | Base-rate → calibrated P       | S4      | Chronological holdout beats base-rate Brier                    |
| **S6** | Edge + BET_* policy            | S1, S5  | Recommendation reproducible from frozen snapshots              |
| **S7** | Dossier UI (thin)              | S6      | One live opportunity end-to-end without CLI                    |
| **S8** | Corpus scale + chrono backtest | S6      | Edge-vs-market report after costs                              |
| **S9** | Radar + paper trading          | S7, S8  | Prospective sample: calibrated + positive simulated net        |

_\*First BET_* output: S6. First human MVP: S7. Live-trade gate: S9._*

## Parallelism

After S0 only:

- **Track A (demand):** S1
- **Track B (supply):** S2 → S3

Merge at **S4**. S5→S6 serial. S7 may overlap late S6. S8 may start once S6 policy is frozen on fixtures.

## Efficiency deltas vs Notion Phases 0–8

1. **S1 is thin** — parse/classify markets; deep entity resolution waits until S2 has canonical targets.
2. **S2 is narrow** — ClinicalTrials.gov + Drugs@FDA only; PubMed / SEC / openFDA move to S8.
3. **S5 is base-rate first** — Bayesian / GBM / survival only if base-rate loses and stays undercalibrated.
4. **S6 before full UI** — betting policy before screens; one dossier, not five.
5. **Defer forever until unlock:** Neo4j, Priority-2 sources, live execution, market-as-clinical-ground-truth.

## Do not reorder

Provenance before features → citations before probabilities → base-rate before complex models → CLOB executable prices before BET_* → chronological backtest before paper → prospective sample before live orders.

## Next

**S0–S9 complete** (simulation MVP). Clinical validation via ADR 0014 retrospective KG. **Trading readiness (ADR 0015):** `pnpm quotes:snapshot` archives executable asks; `pnpm paper:live` opens simulated positions and reports Bar A readiness. Live execution remains off; clinical conviction stays DEMO until graduation criteria.
