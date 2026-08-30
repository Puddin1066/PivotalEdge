# UI Spec — Ops Portfolio Risk (lite)

**Status:** Implemented (`/ops/risk`, `portfolio-risk@1`)  
**Route:** `/ops/risk` (primary); Portfolio links here; optional embed summary on `/ops/portfolio`  
**Policy / engine version:** `portfolio-risk@1`  
**Depends on:** `portfolio-policy@1` (`docs/PORTFOLIO_POLICY_SPEC.md`), Ops console, live scores + quote vault  
**Constraint:** Decision support only. Never places orders. Live execution remains off.

---

## 1. Purpose

One job: **“How does this suggested book die — and what EV survives after that?”**

The current Portfolio page shows **sized lines + naive independent EV**. This page adds the lite quant layer:

1. **Point EV** (what we already imply) vs **stress / joint EV**  
2. **Probability uncertainty** — edge that vanishes if P is wrong by a few points  
3. **Dependence scenarios** — FDA clocks moving together  
4. **Liquidity realism** — refuse or haircut ghost asks  
5. **Loss distribution** — chance the $100 (or deploy) book finishes red / −50%  

This is **not** a full institutional risk platform. It is the minimum desk-honest view before trusting portfolio EV.

---

## 2. Users & jobs

| Actor | Job on this page |
|---|---|
| Solo operator | Before placing the Portfolio suggestion: see whether EV is fragile, correlated, or illiquid |
| Future desk | Same + risk version / limits audit |

**Out of scope for v1:** live VaR streaming, multi-venue netting, covariance estimation from equities, wallet PnL.

---

## 3. Information architecture

| Route | Name | Role |
|---|---|---|
| `/ops/portfolio` | Portfolio | Edge-weighted **deploy suggestion** (unchanged primary job) |
| `/ops/risk` | **Risk** | Lite risk on **that same suggestion** (this spec) |

Chrome: add **Risk** nav item (after Portfolio).

Today (`/ops`): one-line strip optional later — “Risk: fragile / OK” — **not** in v1.

Cross-links:

- Portfolio → “See how this book dies →” `/ops/risk`  
- Risk → “Edit / view sizes →” `/ops/portfolio`  
- Each line → `/ops/market/[id]`  

---

## 4. Global chrome (inherit Ops)

Same chips as elsewhere: PAPER READY / CALIBRATED|DEMO / LIVE EXECUTION OFF / ASKS FRESH.

Additional chip on this page only:

- `RISK ENGINE portfolio-risk@1`  
- Banner if conviction DEMO or asks stale: **“Risk numbers are illustrative — do not size up.”**

---

## 5. Screen layout (single column; one job per section)

### 5.1 Header

- Title: **Portfolio risk**  
- One sentence: “Point EV assumes independent wins. This page shows uncertainty, correlation scenarios, liquidity, and the loss distribution for the current suggestion.”  
- Deploy context: bankroll · deploy budget · suggested deploy $ · # lines · policy versions (`portfolio-policy@1` + `portfolio-risk@1`)

### 5.2 Status strip (≤4 stats — not a dashboard)

| Stat | Meaning |
|---|---|
| **Naive EV** | Σ line EV under conservative P, independence, current asks + fee |
| **Stress EV** | EV under default stress scenario (see §7) — usually lower |
| **P(loss)** | Approx. probability book PnL &lt; 0 (from scenario / Monte Carlo lite) |
| **Fragility** | Count of lines that flip non-actionable if P moves against by `deltaP` |

### 5.3 How to read this (compact legend — always visible)

Three bullets max:

1. **Naive EV** = sum of single-bet EVs (does **not** assume you win every line; *does* assume independence).  
2. **Stress / joint** = same bets when FDA-timing shocks hit several names together.  
3. **Liquidity** = if you cannot fill the ask size, that line’s EV is fantasy.

Risk statement (reuse / extend portfolio statement):

> Caps and scenarios reduce concentration blindness. They do not remove shared regulatory risk. High EV on thin asks is not a trade.

### 5.4 Loss distribution

**One job:** show the shape of outcomes for the **current suggested notionals** (and a control to rescale to custom stake, default = suggested deploy or $100).

Display:

| Element | Spec |
|---|---|
| Stake control | Input: evaluate at $X total (default: current `deployed`; presets $50 / $100 / suggested) |
| Summary row | Mean PnL · P(PnL&lt;0) · P(PnL≤−50% of stake) · 5th pct PnL · 95th pct PnL |
| Simple chart | Horizontal histogram or stacked bars: buckets e.g. ≤−100%, −100…−50%, −50…0%, 0…50%, 50…100%, &gt;100% of stake (return on capital) |
| Method label | `method: independent_bernoulli` vs `method: scenario_mixture` (see §7) — always show which |

No fancy 3D. Monospace numbers. Explain in one line under the chart.

### 5.5 Scenarios (dependence)

**One job:** “What if the world is not independent?”

Table of **named scenarios** (v1 fixed set):

| Scenario ID | Description | How it adjusts |
|---|---|---|
| `base_independent` | Independence (naive) | Line win probs = model/conservative as selected |
| `fda_delay_year` | Year-end approval clocks slip together | For BET_NO on `*this year*` / same deadline-year: boost P(NO); for BET_YES on those: cut P(YES) by `shock` |
| `ta_oncology_risk` | Oncology sentiment / review risk | Shock all lines with `therapeuticArea=oncology` |
| `same_quarter_cluster` | Shared deadline quarter | Shock all lines in the densest deadline cluster of the book |
| `adverse_p` | Model overconfident | Shift every P(win) toward 0.5 by `shrink`, or subtract `deltaP` from edge side |

Each row shows: scenario name · **EV** · **P(loss)** · **worst line** · one-sentence note.

Default selected for “Stress EV” strip: `fda_delay_year` (configurable constant in engine).

Operator can click a scenario to drive the loss-distribution section (v1: single select).

### 5.6 Fragility (probability uncertainty)

**One job:** which edges are knife-edge?

Per line:

| Column | Source |
|---|---|
| Market / side | Portfolio line |
| Ask | Executable ask used |
| P(win) | Conservative (toggle: model) |
| Edge (pp) | P − ask − fee |
| Break-even P | Ask + fee (approx.) |
| Cushion (pp) | P − break-even |
| Fragile? | Cushion &lt; `fragilityDeltaP` (default **5pp**) or EV→0 if P moves `deltaP` against |
| Liquidity flag | ask size vs suggested notional (see §5.7) |

Sort fragile first.

### 5.7 Liquidity & fill realism

**One job:** kill ghost EV.

Per line:

| Check | Rule (defaults) |
|---|---|
| Missing ask size | Flag `missing_size`; haircut EV × 0.5 in risk view |
| Suggested notional vs ask size | If `notional / ask > askSize × fillableFraction` (default fillableFraction **0.25**) → flag `size_exceeds_depth`; **zero** that line’s contribution to Stress EV and mark “not fillable at size” |
| Stale ask | Inherit ops freshness; flag |

Summary: “N of M lines liquidity-OK.”

### 5.8 Line detail (optional expand)

Click row → expand: link to market rationale, invalidators, haircuts from portfolio-policy, contribution to naive EV vs stress EV.

### 5.9 Exclusions & engine notes

- Lines excluded by portfolio-policy (with reasons) — read-only list  
- Risk engine notes (version, fee rate, shock sizes, Monte Carlo draw count if used)  
- Link to this spec + ADR  

### 5.10 Explicit non-goals on the page

Do **not** show:

- Midpoint as fillable  
- LLM-written “risk narrative” without cited numbers  
- Fake precision (more than 1 decimal on probs; EV to cents OK)  
- Live trading CTA  

CTA copy: “Adjust sizes on Portfolio / place fills yourself / Log fill in Book.”

---

## 6. Data contract (`PortfolioRiskReport`)

```text
kind: ops_portfolio_risk_report
riskVersion: portfolio-risk@1
generatedAt
portfolioRef: { policyVersion, deployed, deployBudget, bankroll, lineCount }
probabilityMode: conservative | model   # UI toggle; default conservative

naive: { stake, expectedPnl, expectedReturnOnStake, pLoss }
stress: { scenarioId, stake, expectedPnl, expectedReturnOnStake, pLoss }

scenarios[]: { id, label, expectedPnl, pLoss, note }
distribution: {
  stake,
  method,
  scenarioId | null,
  meanPnl, pLoss, pLossHalf, p05Pnl, p95Pnl,
  buckets[]: { id, label, probability, minReturn, maxReturn }
}
lines[]: {
  marketId, slug, question, side, href,
  stake, ask, askSize, pWin, netEdge, breakEvenP, cushionPp,
  naiveEv, stressEv,
  fragile, liquidityFlags[], fillable
}
fragileCount, liquidityOkCount
notes[], riskStatement
```

Built from the **same** `PortfolioSuggestion` as `/ops/portfolio` (do not re-size ad hoc on this page except the **evaluation stake rescale** control, which scales all line stakes proportionally).

---

## 7. Engine methods (`portfolio-risk@1`) — computation sketch

Implementation detail for engineers; UI must label the method used.

### 7.1 Single-line EV

Stake \(S\), ask \(a\), P(win) \(p\), fee rate \(f\) (default 0.02):

\[
EV = p \cdot (S / a) - S - f \cdot S
\]

(Assumes full fill at ask; liquidity module may zero \(S\)’s contribution.)

### 7.2 Naive portfolio EV

\[
EV_{\text{naive}} = \sum_i EV_i
\quad\text{(independence; not “win all”)}
\]

### 7.3 Loss distribution — v1 methods

**A. `independent_bernoulli` (required)**  
- Each line wins with \(p_i\) independently  
- Exact enumeration if \(n \le 12\) lines; else Monte Carlo \(N=5000\) draws  
- PnL path: sum of per-line win/lose outcomes  

**B. `scenario_mixture` (required for stress)**  
- Apply scenario shock to \(p_i\) → \(p_i'\)  
- Then run the same Bernoulli engine on \(p_i'\)  
- Shocks (defaults):  

| Scenario | Shock |
|---|---|
| `fda_delay_year` | For lines whose deadline year = current UTC year and side NO: \(p \leftarrow \min(1, p + 0.10)\); side YES: \(p \leftarrow \max(0, p - 0.10)\) |
| `ta_oncology_risk` | Oncology: NO \(+0.08\) / YES \(−0.08\) |
| `same_quarter_cluster` | Largest cluster in book: NO \(+0.08\) / YES \(−0.08\) |
| `adverse_p` | All: \(p \leftarrow p - 0.05\) toward the losing side of the bet (clamp [0.01, 0.99]) |

Exact shock table is versioned with `portfolio-risk@1`; changing shocks bumps version.

### 7.4 Fragility

Line is fragile if:

- `cushionPp < 0.05`, or  
- \(EV(p - 0.05) \le 0\) while \(EV(p) > 0\)

### 7.5 Liquidity gate

If not fillable at size (§5.7): set `fillable=false`, `stressEv=0`, exclude from stress distribution stakes (or treat as forced flat — pick one and document in engine notes; **v1: treat as flat / no position in stress**).

---

## 8. UI states

| State | UI |
|---|---|
| No portfolio lines | Empty: “No suggested deploy — see Portfolio / Rescore live” |
| DEMO conviction | Amber banner + haircut note |
| Asks stale | Amber banner |
| All lines illiquid | Stress EV = 0; explain |
| Engine error | Short error; no fake chart |

---

## 9. Design notes (match Ops)

- Same tokens: Newsreader + IBM Plex, teal accent, no purple marketing chrome  
- Dense tables; cards only for stake control + loss chart container  
- Explanatory microcopy over jargon (“P(loss)” defined inline once)  
- Brand in Ops chrome only  

---

## 10. Acceptance criteria

1. Spec reviewed; route listed in `UI_OPS_CONSOLE_SPEC` IA  
2. Given current fixtures, `/ops/risk` shows naive EV ≠ stress EV for `fda_delay_year` when book has year-end YES/NO mix  
3. Rescale to $100 updates distribution mean roughly linearly (before liquidity zeros)  
4. Fragile lines match cushion &lt; 5pp  
5. Illiquid line does not contribute to stress EV  
6. Copy never says “you will win” for EV  
7. LIVE EXECUTION OFF still visible  

---

## 11. Implementation sequence (when building — not now)

1. `packages/scoring` (or workflows): `buildPortfolioRiskReport(suggestion, opps, quotes, config)`  
2. Attach to `OpsDashboard` or `GET /api/ops/risk`  
3. Page `/ops/risk` + nav  
4. Link from Portfolio  
5. Tests: golden fixture book with known EV / fragility  

---

## 12. ADR

See `docs/adr/0017-portfolio-risk-lite.md`.
