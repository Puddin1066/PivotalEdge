# Enrichment priority plan (contract-semantics driven)

**Status:** Active working plan  
**Principle:** Polymarket `eventType` + `eventDeadline` define the resolving event. Enrich only facts on that causal path. CLOB stays outside the clinical KG (executable asks for edge).  
**Related:** ADR 0012 (Track A), ADR 0018 (regulatory clocks), `/ops/kg` coverage gaps.

## 0. Required-field matrix by contract

| `eventType` | Required (else low conf / NO_BET) | High-value optional | Deprioritize |
|-------------|-----------------------------------|---------------------|--------------|
| `NDA_BLA_SUBMISSION` | Timed PE (or explicit unknown); `expectedFilingAt` or explicit “no guidance”; linked NCT | BTD/Fast Track; PE→historical filing lag priors | PDUFA; AdCom; deep competitor lists |
| `FILING_ACCEPTANCE` | `filedAt` / application number | Refuse-to-file analogues | Approval clocks |
| `FDA_APPROVAL` / `FDA_APPROVAL_BY_DATE` | Acceptance **or** filing guidance **or** PDUFA/CNPV; PE package state; `eventDeadline` | Review program; CRL analogues in TA×phase; review-duration priors | Undated OT noise; midpoints |
| `TRIAL_PRIMARY_ENDPOINT` / `TRIAL_POSITIVE_TOPLINE` | Linked NCT; endpoint family; design; cutoff-safe PE label when public | Enrollment ratio; PCD slips | Filing/PDUFA |
| `ADVISORY_COMMITTEE_VOTE` | AdCom scheduled date; contested issues | Panel history | Filing date alone |

**Gate:** If required set missing at cutoff → do not treat `modelP` as calibrated for that contract (policy: WAIT / NO_BET / widen interval).

---

## 1. Live book priority (Track A — now)

Open contracts (as of last score):

| Priority | Market / program | Contract | Blocking gap | Enrich action |
|----------|------------------|----------|--------------|---------------|
| **A1** | Intismeran · BLA by 2027-06-30 | `NDA_BLA_SUBMISSION` | No `expectedFilingAt` | Watch Merck/Moderna IR only; **do not invent**. Seed filing guidance the day it is public. Until then: submission P must stay filing-clock–dominated / NO_BET-friendly. |
| **A2** | Intismeran · approve by 2027-06 / 2027-12 | `FDA_APPROVAL_BY_DATE` | No acceptance/PDUFA; filing unknown | Same as A1 first; approval markets secondary until filing exists. Keep BTD. |
| **A3** | Retatrutide · approve this year (YE 2026) | `FDA_APPROVAL_BY_DATE` | Filing guided **Q1 2027** (after deadline) | **Clock complete for this contract.** Maintain guidance provenance; refresh if Lilly revises. Competitors already dated (tirzepatide/semaglutide/liraglutide). |
| **A4** | Daraxonrasib · approve YE 2026 | `FDA_APPROVAL_BY_DATE` | Market may be resolved; openFDA lag on Rasonque | Backfill `applicationNumber` / openFDA when indexed; keep CNPV acceptance + approval action. Low ops priority if closed. |

**Do not prioritize for live P:** more Open Targets undated names, Purple Book dump, eligibility embeddings.

---

## 2. Platform work (ordered)

### P0 — Contract-aware pipeline (highest leverage)

1. **`compileQueryPlan` branches on `eventType`**  
   - Submission markets → filing-guidance + PE→file lag cohorts  
   - Approval-by-date → acceptance/PDUFA/CNPV + review-duration analogues  
   - Stop using one TA×Phase III template for every contract  

2. **Required-evidence checklist per opportunity**  
   - Emit on score + Ops rationale + `/ops/kg`  
   - `requiredPresent` / `requiredMissing[]`  

3. **Enrich gate in `kg:enrich` / seeds**  
   - Per seed: list `linkedMarketEventTypes[]`  
   - Manifest flags `contractCoverage: complete | partial | blocked`  

### P1 — Clock & submission facts (subject programs)

4. Intismeran filing guidance (when public) → `expectedFilingAt`  
5. Any new live `FDA_APPROVAL_BY_DATE` without acceptance/PDUFA/filing guide → block fade / force NO_BET (policy already partial)  
6. openFDA backfill for newly approved assets (Daraxonrasib/Rasonque)  

### P2 — Precedent density for *those* strata (Track B)

7. Retrospective programs with **typed clocks** (acceptance→action, PE→first filing) in:  
   - Oncology Phase III + BTD  
   - Metabolic / obesity BLA-like  
8. Expand `fda-review-duration-priors.json` from measured spans (not stubs)  
9. PE→BLA/NDA filing lag table (for `NDA_BLA_SUBMISSION` contracts)

### P3 — Trial-registry depth (only where contract needs it)

10. Versioned CT.gov PCD / status / enrollment for live NCTs (submission & topline markets)  
11. Termination reason when status ≠ completed  

### P4 — Explicitly later

- Purple Book wholesale  
- Neo4j  
- CLOB inside clinical KG  
- LLM probabilities as conviction  
- Competitor dating beyond curated fallbacks for live seeds  

---

## 3. CLOB (parallel, not KG)

| Priority | Action |
|----------|--------|
| C0 | Keep `quotes:snapshot` fresh on all seeded market IDs (asks only) |
| C1 | Multi-day vault span for Bar A |
| C2 | Optional depth / VWAP later for stake sizing |
| Never | Midpoint as fillable; Polymarket resolution as clinical labels |

---

## 4. Success metrics

| Metric | Target |
|--------|--------|
| Live markets with `contractCoverage=complete` | 100% of open BET_* candidates |
| Intismeran submission market | Filing guidance present **or** explicit blocked + NO_BET |
| Approval-by-date without clock | 0 actionable BET_NO @ ≥95¢ YES (policy) |
| `/ops/kg` gaps | `liveMissingClock` only when contractually honest (e.g. pre-guidance submission) |

---

## 5. Immediate next build (recommended sequence)

1. Encode `requiredEvidenceByEventType` + surface on Ops rationale / `/ops/kg`  
2. Branch `compileQueryPlan` on `eventType`  
3. Tag seeds with linked event types; enrich manifest `contractCoverage`  
4. Watch IR for intismeran filing date → one-line seed update + re-enrich  
5. Then Track B clocked precedents for oncology/metabolic strata  

**Rule of thumb:** If a fact cannot change P for the contract’s resolving event by T, do not enrich it on the critical path.
