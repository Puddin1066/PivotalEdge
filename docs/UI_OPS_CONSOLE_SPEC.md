# UI Spec — Operations Console (Edges + Manual Bets)

**Status:** Implemented (v1 Ops console at `/ops`) 
**Product:** PivotalEdge operator surface for daily use  
**Constraint:** No autonomous live trading. Polymarket fills are **manual**; the UI logs, monitors, and explains them.

---

## 1. Purpose

Give one operator a place to:

1. **See** ranked edges from clinical P vs executable CLOB asks  
2. **Act** by opening Polymarket in the browser and placing a bet themselves  
3. **Record** that manual fill (price, size, side, time) against a recommendation  
4. **Maintain** open positions: edge drift, invalidators, ask freshness, resolution  
5. **Trust labels** — always know clinical conviction (`calibrated` / `demo`) and that live execution is off  

This is an **operations cockpit**, not a marketing site and not an exchange.

---

## 2. Users & jobs

| Actor | Job |
|---|---|
| Solo operator (you) | Triage edges → decide → place on Polymarket → log fill → watch until resolve |
| Future: small desk | Same flows with bankroll / position limits visible |

**Out of scope for v1:** signing Polymarket orders, wallet connect, auto-rebalance, social feed.

---

## 3. Information architecture

Consolidate today’s scattered pages (`/platform`, `/radar`, `/paper`, `/dossier`, `/backtest`) into one **Ops** app with tabs (or left nav):

| Route | Name | Role |
|---|---|---|
| `/ops` | **Today** | Readiness strip + top edges + open book summary |
| `/ops/edges` | **Edges** | Full ranked opportunity table + filters |
| `/ops/portfolio` | **Portfolio** | Edge-weighted deploy suggestion (`portfolio-policy@1`) |
| `/ops/risk` | **Risk** | Lite portfolio risk (`portfolio-risk@1`) — [spec](./UI_OPS_RISK_SPEC.md) |
| `/ops/book` | **Book** | Open + closed **manual** positions (and optional paper) |
| `/ops/market/[id]` | **Market** | Dossier: thesis, asks, evidence, log fill, invalidators |
| `/ops/health` | **Health** | Clinical gates, quote vault freshness, pipeline actions |
| `/ops/history` | **History** | Resolved bets, Brier / PnL vs model (post-hoc) |

Keep existing `/platform` as alias → `/ops/health` during migration, or redirect.

---

## 4. Global chrome (every page)

**Top bar**
- Product name **PivotalEdge**
- Readiness chip: `PAPER READY` / `NOT READY`
- Conviction chip: `CALIBRATED` | `DEMO` (from `trading-readiness-report`)
- Live trading chip: always `LIVE EXECUTION OFF` (red/muted, non-toggleable in v1)
- Quote freshness: `Asks fresh` | `Asks stale (>48h)` + last snapshot time
- Bankroll display: configured paper/manual bankroll (e.g. $10,000)

**Primary actions (always available)**
- `Snapshot asks` → `pnpm quotes:snapshot`
- `Rescore live` → `pnpm kg:score-live`
- `Refresh paper` → `pnpm paper:live`
- `Run retrospective` → `pnpm retro:validate` (secondary)

**Provenance legend** (compact, always one click away)  
LIVE market · CALIBRATED / DEMO clinical · PAPER sim · MANUAL fill

---

## 5. Screen specs

### 5.1 Today (`/ops`)

**One job:** “What needs attention now?”

**Layout (single column, desktop; stack on mobile)**

1. **Status strip** (not a dashboard of 12 KPIs — 4 numbers max)  
   - Open manual bets · Open paper · Edges with `|netEdge| ≥ policy min` · Stale asks  

2. **Attention list** (max ~8 rows)  
   Priority order:  
   - Invalidator fired / resolution approaching (<14d)  
   - Ask moved through `maximumEntryPrice`  
   - Edge flipped sign vs last score  
   - Stale quote on a market you hold  

3. **Top edges** (5 rows)  
   Same columns as Edges table (compact). CTA: `Open market` → Market page.

4. **Open book snapshot**  
   Side · market · entry ask · mark ask · unrealized (if markable) · days to deadline  

No hero marketing. Brand is in the chrome, not a landing pitch.

---

### 5.2 Edges (`/ops/edges`)

**One job:** Rank and filter tradable disagreements.

**Table columns**

| Column | Source |
|---|---|
| Rank | local sort |
| Question | Gamma |
| Drug / program | KG |
| Action | `BET_YES` / `BET_NO` / `WAIT` / `NO_BET` |
| Model P · Cons. P | forecast |
| YES ask · NO ask · sizes | CLOB / vault |
| Net edge | policy |
| Stake (suggested) | policy |
| Confidence | evidenceConfidence |
| Conviction | calibrated / demo |
| Tradability | purchasable_now / not |
| Ask age | vault / score time |
| Deadline | market |

**Filters:** action, TA, min \|edge\|, conviction, tradability, “held in book”, stale asks only.

**Row actions**
- `Open` → Market dossier  
- `Polymarket ↗` → external URL (new tab)  
- `Log fill…` → quick modal (if action is BET_*)  

**Sort default:** `|netEdge|` desc, then stake, then confidence.

**Empty / degraded states**
- No live scores → prompt Rescore  
- Asks stale → prompt Snapshot asks  
- Conviction DEMO → amber banner: “Clinical P usable for triage; treat stake caps conservatively”

---

### 5.3 Market dossier (`/ops/market/[id]`)

**One job:** Decide and (if betting) log a manual fill with full context.

**Sections (top → bottom, one purpose each)**

1. **Header**  
   Question · Polymarket link · deadline · lane badges · last scored at  

2. **Decision card** (interaction container — this *is* a card)  
   - Action badge  
   - Cons. P vs executable ask vs max entry  
   - Net edge · suggested stake · fee assumption  
   - Primary thesis (1–3 sentences)  
   - Strongest counterargument  
   - Invalidators (checklist, editable notes later)  
   - Buttons: `Open on Polymarket` · `Log manual fill` · `Dismiss / NO_BET note`  

3. **Book strip**  
   Best ask YES/NO + size · mid shown only as *reference* and labeled non-executable  

4. **Clinical features @ cutoff**  
   Phase · TA · PE met · filed · designations · enrollment · endpoint family  
   Link to KG program / NCT  

5. **Evidence / precedents** (cited passages only; no LLM probability)  

6. **Position history on this market**  
   Manual fills + paper opens · marks · resolves  

7. **Audit**  
   modelVersion · policyVersion · forecastId · fingerprint · quote capturedAt  

---

### 5.4 Book (`/ops/book`)

**One job:** Maintain everything you actually risked (manual) and optionally paper.

**Tabs:** `Manual` (default) · `Paper` · `All`

#### Manual position model (new; v1 must add schema)

```ts
ManualPosition {
  id
  marketId                 // Polymarket numeric / pm_*
  polymarketUrl
  question
  side: "YES" | "NO"
  status: "open" | "resolved" | "cancelled"
  // Intent (from system)
  recommendationFingerprint?
  modelPAtEntry
  conservativePAtEntry
  recommendedAction        // BET_YES | BET_NO | …
  maxEntryPriceAtEntry?
  // Fill (from you)
  fillPrice                // executable price you paid (ask)
  fillSize                 // shares or USDC stake — pick one unit and stick to it
  fillNotional
  feesPaid?
  filledAt
  notes?
  // Marks / exit
  markAsk?                 // latest vault ask for that side
  markedAt?
  closedAt?
  resolvedYes?             // market resolution
  realizedPnL?
  closeReason?: "resolved" | "manual_exit" | "invalidated" | "expired_no_fill"
  invalidatorsNoted: string[]
}
```

**Open book table**

| Column | Notes |
|---|---|
| Side · Question | |
| Entry price · Size | your fill |
| Mark ask · Δ vs entry | from vault |
| Model P now · Cons. P now | latest rescore |
| Edge now | vs mark ask |
| Max entry | warn if mark > max |
| Deadline | |
| Actions | Update mark · Add note · Resolve · Close |

**Alerts on row**
- Mark ask crossed max entry → `EDGE BROKEN`  
- Invalidator flagged → `REVIEW`  
- Ask stale → `REFRESH ASKS`  
- Resolution < 7d → `ENDING`

**Log fill flow (modal)**
1. Prefill from recommendation (side, market, suggested max price)  
2. Operator enters **actual fill price**, **size/notional**, **time** (default now), optional fee  
3. Confirm: “This is a manual Polymarket fill. PivotalEdge did not place the order.”  
4. Persist; show on Book + Market  

**Resolve flow**
- Set `resolvedYes` from Gamma/closed market or manual toggle  
- Compute realized PnL with same fee assumptions as policy (document formula)  
- Lock row  

---

### 5.5 Health (`/ops/health`)

**One job:** Run the machine and see if conviction is honest.

**Blocks**
1. Trading readiness report (paperReady, clinicalConviction, blockers list)  
2. Clinical S8b / KG holdout / retro gate summaries  
3. Quote vault: rows, markets, last capture, freshness  
4. Pipeline buttons (same as chrome) with stdout tail  
5. KG inventory (programs, live vs retrospective counts)  

---

### 5.6 History (`/ops/history`)

**One job:** Learn after resolution.

- Closed manual bets with entry vs resolve, PnL, model P at entry, market implied at entry  
- Simple aggregates: hit rate, net PnL, average edge at entry, Brier on your bet set (optional)  
- Export CSV  

---

## 6. Edge maintenance (cross-cutting behavior)

| Event | System behavior | UI |
|---|---|---|
| New CLOB snapshot | Update marks on open book | Toast if held market moved ≥X pp |
| Rescore live | Refresh edges + model P on open rows | Diff “P then → P now” |
| Ask > maxEntry on open YES/NO | Flag position | Attention list |
| Invalidator note added | Status `REVIEW` | Today + Book |
| Market resolved | Prompt resolve if open manual | History after close |
| Conviction flips DEMO↔calibrated | Banner | Chrome chip |

**Edge “maintain” does not mean auto-trade.** It means: keep marks honest, surface broken theses, force re-decision.

---

## 7. Copy & labeling rules

- Never imply the app placed the order.  
- Never show midpoint as the fillable price without `non-executable` label.  
- `BET_*` = recommendation, not an order.  
- Manual fill confirmation must include: market, side, price, size, timestamp.  
- LIVE EXECUTION OFF is permanent in v1 UI (no fake toggle).  

---

## 8. Data & API (implementation contract)

| Need | Approach |
|---|---|
| Edges | Existing live score report + `/api/platform` |
| Pipeline runs | Existing `POST /api/kg/run` actions |
| Manual positions | New `fixtures/ops/manual-book.json` (git-friendly) **or** local SQLite later; v1 JSON OK |
| CRUD fills | `GET/POST/PATCH /api/ops/manual-positions` |
| Marks | Join vault `latestQuotesByMarket` on read |
| Readiness | `trading-readiness-report.json` |

Schemas live in `@pivotaledge/schemas` (new `ManualPositionSchema`).

---

## 9. Non-functional

- Desktop-first (operator at a desk); usable tablet.  
- Prefer dense tables over card grids.  
- Actions that shell out (`quotes:snapshot`, etc.) show running state + log tail (as Platform does today).  
- All timestamps UTC, labeled.  
- No MNPI workflows; only public sources.  

---

## 10. MVP build order

1. **Manual book schema + API + Log fill** on existing Market/Platform row  
2. **Book page** with marks from quote vault  
3. **Today** attention list (broken edge / stale / ending)  
4. **Edges** page = promoted Platform table  
5. **Health** = current Platform readiness + buttons  
6. **History** + CSV  

---

## 11. Acceptance criteria (v1)

- [ ] Operator can go Edges → Polymarket → return → Log fill in <2 minutes  
- [ ] Open manual positions show mark ask and edge-vs-entry after `quotes:snapshot`  
- [ ] Broken max-entry and stale-ask states are visible without opening each market  
- [ ] Chrome always shows conviction + LIVE EXECUTION OFF  
- [ ] Resolving a market stores realized PnL and removes from Open  
- [ ] No UI path enables live order placement  

---

## 12. Explicit non-goals (v1)

- Wallet / CLOB signed orders  
- Multi-user auth  
- Mobile-first trading UX  
- Treating paper PnL as bankroll for manual bets without a clear toggle  
- Hiding DEMO/calibrated status  

---

## 13. Relationship to product endpoint

This UI operationalizes the terminal loop:

> Market → clinical P → executable ask → BET recommendation → **human fill** → track → resolve → recalibrate  

Until Bar B exists, the UI is the **control plane for manual trading guided by the model**, not an automated trader.
