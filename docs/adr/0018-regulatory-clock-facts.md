# ADR 0018 — Regulatory clock facts in the clinical KG

## Status

Accepted

## Context

`decision_by_T` failed on high-priced YES markets (e.g. daraxonrasib @ ~99¢) because the model lacked typed PDUFA / acceptance / filing-guidance clocks. Seeds carried only clinical endpoints and designations. Orange Book covers small-molecule ANDAs; biologics (Keytruda, Opdivo, Mounjaro) need another approval-date path.

## Decision

1. **Typed application clock fields** on `RegulatoryApplication`: `filedAt`, `acceptedAt`, `pdufaDate`, `expectedFilingAt`, `reviewProgram`, `clockProvenance` (schemas + enrich pipeline).
2. **Sourced facts only** — clock values come from IR press / FDA disclosures with `firstPublicAt`; never invent filing dates. Missing clock → betting policy blocks fading ≥95¢ YES (`betting-policy@2`).
3. **Competitor approval dates** resolve in order: local Orange Book CSV → retrospective KG `regulatoryAction` (biologics / branded products not in Orange Book). Purple Book download is deferred until a local dump exists.
4. **openFDA drugsfda** is best-effort at enrich time; curated `regulatoryActionDate` remains authoritative when openFDA lags (new approvals).
5. **Review-duration priors** live in `fixtures/calibration/fda-review-duration-priors.json` and drive `inferredReviewWindowDays` defaults (`cnpv` / priority / standard).
6. `programToAssertions` emits clock claims for Ops rationale when `clockProvenance` is present.

## Consequences

- Live enrich (`pnpm kg:enrich`) must re-run when seeds or public clock facts change.
- Intismeran has BTD + “engage regulators” passage but **no** `expectedFilingAt` until sponsors publish guidance.
- Retrospective fixtures are now dual-use: calibration corpus **and** biologic competitor date index.
