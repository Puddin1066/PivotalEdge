# Spec — Edge-weighted Ops Portfolio Policy

**Status:** Accepted for implementation (v1 suggestion-only)  
**Policy version:** `portfolio-policy@1`  
**Depends on:** `betting-policy@1` (ADR 0006), Ops console (`docs/UI_OPS_CONSOLE_SPEC.md`)  
**Constraint:** Suggestion only. Never places Polymarket/Kalshi orders. Live execution remains off.

---

## 1. Purpose

Turn ranked single-market edges into one **deploy-this-week** book:

1. Size each BET_* by **edge × confidence × liquidity**, not equal notional  
2. Apply **correlation / concentration caps** (program, therapeutic area, deadline cluster)  
3. Show residual cash and **excluded** names with reasons  
4. Keep per-market thesis/citations as the decision unit; portfolio is risk budgeting  

This mitigates **idiosyncratic over-concentration**. It does **not** eliminate shared FDA/timing regime risk.

---

## 2. Inputs

| Input | Source |
|---|---|
| Opportunities | `live-score-report` (`BET_YES` / `BET_NO` only) |
| Bankroll | Manual ops book bankroll (default $10,000) |
| Ask freshness | Quote vault / ops `asksFresh` |
| Clinical conviction | `trading-readiness-report` (`calibrated` \| `demo`) |
| Program metadata | Enrichment seeds + KG fixture (slug → TA, sponsor) |
| Ask size (optional) | Latest vault row for market |

Single-name stake from `betting-policy@1` is a **prior ceiling**, not the portfolio weight itself.

---

## 3. Eligibility (hard filters)

Include only if **all** hold:

1. `action ∈ {BET_YES, BET_NO}`  
2. `tradability === purchasable_now` (or equivalent live lane)  
3. `|netEdge| ≥ minNetEdge` (default **5pp**, same as betting policy)  
4. `evidenceConfidence ≠ low`  
5. Executable ask present for the action side  

Soft (does not exclude; labels / haircuts):

- Asks stale (>48h) → haircut weight × `staleAskHaircut` (default **0.5**) and flag  
- Conviction `demo` → haircut all weights × `demoConvictionHaircut` (default **0.5**) and banner  

---

## 4. Raw score → uncapped notional

For each eligible market \(i\):

\[
\text{conf}_i =
\begin{cases}
1.0 & \text{high} \\
0.7 & \text{moderate} \\
0.0 & \text{low (excluded)}
\end{cases}
\]

\[
\text{liq}_i = \min\!\left(1,\ \frac{\text{askSize}_i}{\text{minAskSize}}\right)
\quad (\text{default minAskSize}=50;\ \text{missing size} \Rightarrow 0.75)
\]

\[
\text{score}_i = |\text{netEdge}_i| \cdot \text{conf}_i \cdot \text{liq}_i \cdot h_{\text{stale}} \cdot h_{\text{demo}}
\]

\[
\text{uncapped}_i = \min\!\left(
  \text{bankroll} \cdot \text{maxNameFraction},\;
  \text{singleNameStake}_i,\;
  \text{deployBudget} \cdot \frac{\text{score}_i}{\sum_j \text{score}_j}
\right)
\]

Defaults:

| Knob | Default |
|---|---|
| `maxDeployFraction` | 0.10 (10% bankroll this suggestion) |
| `maxNameFraction` | 0.02 (2% bankroll per market) |
| `minAskSize` | 50 (shares / USDC size units from vault) |
| `staleAskHaircut` | 0.5 |
| `demoConvictionHaircut` | 0.5 |
| `kellyFraction` / fee | inherit betting-policy@1 |

`deployBudget = bankroll × maxDeployFraction`.

---

## 5. Correlation / concentration caps

Apply **after** uncapped notionals, greedily by descending score:

| Cap | Default | Key |
|---|---|---|
| Per **program slug** | 25% of deployBudget | `slug` |
| Per **therapeutic area** | 40% of deployBudget | `therapeuticArea` (unknown → `"unknown"`) |
| Per **deadline cluster** | 40% of deployBudget | calendar quarter of `eventDeadline` (`YYYY-Qn`) |
| Per **sponsor** | 30% of deployBudget | sponsor name (optional if known) |

Algorithm:

1. Sort eligible by `score` desc  
2. For each name, `suggested = uncapped` then clamp so no cap bucket exceeds its limit  
3. If clamp reduces to `< minLineNotional` (default **$25**), **exclude** with reason `below_min_after_caps`  
4. Leftover budget stays as `cashReserve`

Rationale: FDA “approve by date” markets in the same quarter / same TA share timing and sentiment risk; same slug is the same program dressed as multiple Polymarket questions.

---

## 6. Output artifact

`PortfolioSuggestion` (`kind: ops_portfolio_suggestion`):

```text
policyVersion, generatedAt, bankroll, deployBudget, cashReserve
conviction, asksFresh
lines[]: marketId, slug, question, side, netEdge, score,
         uncappedNotional, suggestedNotional, weightOfDeploy,
         therapeuticArea, deadlineCluster, haircuts[], href
excluded[]: marketId, reason
notes[]: human-readable policy reminders
```

**Never** treat midpoints as fillable. Lines cite the **ask** used at score time.

---

## 7. Ops UI

| Route | Role |
|---|---|
| `/ops/portfolio` | Full suggestion: deploy summary, sized lines, exclusions, knobs (read-only) |
| `/ops` (Today) | Compact strip: deploy $ · #lines · top 3 weights → link Portfolio |
| Chrome | Nav item **Portfolio** |

Each line links to `/ops/market/[id]` (rationale/citations). CTA copy: “Size suggestion only — place fills yourself, then Log fill.”

---

## 8. Non-goals (v1)

- Auto-rebalance or wallet orders  
- Mean-variance / covariance matrix estimation  
- Kalshi dual-venue netting (future adapter)  
- Mixing paper BET_* notionals into manual deploy budget  

---

## 9. Risk statement (must show in UI)

> Edge-weighted caps reduce concentration in one name or one TA/deadline cluster. They do **not** remove shared regulatory or calendar risk. Correlated FDA clocks can still move together.

---

## 10. Versioning

Bump `portfolio-policy@N` when caps, haircuts, or eligibility change. Fingerprint suggestions by policy version + opportunity fingerprints (optional later).
