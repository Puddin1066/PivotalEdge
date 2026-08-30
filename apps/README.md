Next.js UI for PivotalEdge.

```bash
pnpm web:dev
```

| Route       | Purpose                               |
| ----------- | ------------------------------------- |
| `/radar`    | Opportunity radar + paper PnL summary |
| `/dossier`  | Single regulatory dossier             |
| `/backtest` | Chronological edge-vs-market report   |
| `/paper`    | Prospective paper trading sample      |

Order books and paper fills are **mock / simulated** until live CLOB wiring. Live trading is disabled.
