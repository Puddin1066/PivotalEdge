# ADR 0014 — Retrospective clinical trial KG for model validation

## Status

Accepted

## Context

CLOB history for closed FDA markets is sparse/unusable. Clinical probability should be validated primarily on trial → FDA outcome history. The flat S8b corpus (43 rows) lacked KG trial ops, designations, enrollment, and timed PE provenance. Local KG holdout was only ~6 programs.

## Decision

- Curate `fixtures/enrichment/retrospective-seeds.json` with approvals, CRLs, and Phase II/III failures (NCT + PE public date + action date + trial ops).
- `pnpm kg:ingest-retrospective` builds `fixtures/corpus/retrospective/*.json` via `buildRetrospectiveProgramFixture` (offline `trialOps`; optional `--fetch` for CT.gov).
- Holdout cutoff = day before regulatory action when PE precedes action; else result disclosure time for failure paths (PE available, no outcome leakage).
- Merge KG-derived enrich features into `fda-chrono-corpus.json` (`dataSource: curated_public_drugsfda+kg_retrospective`).
- S8b `toFeatures` passes enrich fields (biomarker, orphan, designations, enrollment, trialStatus).
- `kg:validate` / `kg:holdout` / Platform inventory include `corpus/retrospective`.

## Consequences

- Clinical validation no longer depends on Polymarket CLOB archives.
- Labels remain curated (PE met / CRL / discontinuation); do not auto-infer CRL from CT.gov alone.
- Continue expanding seeds for balance (more CRLs and non-oncology fails).
