# Launch Waterfall — CLAUDE.md

## What this is
A React dashboard for forecasting **March 2026 go-live launches** from Closed Won (CW) cohorts. It models how many accounts from each cohort are expected to activate ("launch") during March, using historical activation rate data as a baseline.

## Tech stack
- React 18 (Create React App / react-scripts)
- Recharts for charts (BarChart waterfall, LineChart)
- All styling is inline (no CSS files, no Tailwind)
- Fonts: DM Sans (UI), JetBrains Mono (numbers)
- Single component file: `src/App.jsx`

## Running locally
```bash
npm install
npm start          # defaults to port 3000
PORT=3001 npm start  # if 3000 is taken
```

## Deployment
- **Vercel**: https://launch-pacing.vercel.app
- **GitHub repo**: https://github.com/neilkhurana/launch-pacing
- Deploy command: `npx vercel deploy --prod`
- Vercel project ID: `prj_PXBsL12p4TWpzEtaZMi4EFsyBWFU`, org ID: `team_OoUhMb0tqvFMVOARct1GOZXy`

## Daily auto-refresh (GitHub Actions)
- Workflow: `.github/workflows/daily-refresh.yml` — runs at 12 AM PST (8 AM UTC) daily
- Script: `scripts/refresh_data.py` — queries Snowflake, updates hardcoded values in `src/App.jsx`, commits, pushes, deploys to Vercel
- Trigger manually: `gh workflow run daily-refresh.yml --repo neilkhurana/launch-pacing`
- GitHub secrets already set: `SNOWFLAKE_ACCOUNT`, `SNOWFLAKE_USER`, `SNOWFLAKE_PRIVATE_KEY`, `SNOWFLAKE_WAREHOUSE`, `SNOWFLAKE_ROLE`, `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `GH_PAT`

### Vercel token issue (in progress)
The stored `vca_*` session token in `~/Library/Application Support/com.vercel.cli/auth.json` does NOT work with `vercel deploy --token` or written to `auth.json` on the runner. It requires a **personal access token** created at vercel.com/account/tokens (format differs from session tokens). The Snowflake refresh + commit + push steps all work — only the Vercel deploy step is failing.

## Snowflake data sources
- **CW source**: `DBT_ANALYTICS_PROD.ANALYTICS_GTM.FACT_GTM_FUNNEL`
  - `COUNT(DISTINCT OPPORTUNITY_ID)` where `S5_CLOSED_WON_FLAG = TRUE`
  - Group by `DATE_TRUNC('month', S5_CLOSED_WON_DATE)`
- **Launch source**: `DBT_ANALYTICS_PROD.ANALYTICS_PRODUCT.LOCATIONS`
  - `COUNT(DISTINCT LOCATION_ID)`
  - Uses `ACCOUNT_MOST_RECENT_GO_LIVE_DATE` and `ACCOUNT_MOST_RECENT_CLOSE_WON_DATE`
  - Filter: `ACCOUNT_MOST_RECENT_GO_LIVE_DATE <= CURRENT_DATE()` (exclude future dates)
- **Snowflake connection**: key-pair auth, account `gvszsbn-tea10269`, user `CLAUDE_SNOWFLAKE_AI_USER`, warehouse `CLAUDE_SNOWFLAKE_AI_WH`, role `CLAUDE_SNOWFLAKE_AI_ROLE`, key at `~/snowflake-mcp/ai_read_only_user_rsa_key.p8`

## App structure (`src/App.jsx`)

### Data
- `cohortHistorical` — 14 monthly CW cohorts (Jan 25 – Feb 26), each with:
  - `cw`: total Closed Won count
  - `m0–m3`: launches in month 0/1/2/3+
  - `nl`: not launched
  - `p0–p3`: cumulative activation rates at each month milestone
  - `p2`/`p3` are `null` if the month hasn't been reached yet
- `AVG` — pre-2026 average cumulative rates (computed from Jan '25–Dec '25 cohorts only)
- `CUR` — current in-progress rates: `decM3`, `janM2`, `febM1`, `marM0`
- `MTD` — March MTD actual launches per cohort: `preJan`, `jan`, `feb`, `mar`
- `MTD_TOTAL` — total March launches across all cohorts (includes pre-Dec '25 long-tail)
- `PREV` — end-of-Feb baseline rates used for avgLaunches/adjLaunches formula
- `FIXED` — locked CW counts for Dec 25, Jan 26, Feb 26
- `defaultAdj` — adjusted rates (manually set, not auto-refreshed)

### Model logic
avgLaunches / adjLaunches = `CW × (rate - prevRate)` — total expected March launches based on end-of-Feb baseline (NOT remaining launches from today).

Cohorts in the March model:
| Cohort | CW | Milestone | prevRate source |
|--------|-----|-----------|-----------------|
| Dec '25 | 831 | M3+ avg | M2 rate end of Feb |
| Jan '26 | 810 | M2 avg | M1 rate end of Feb |
| Feb '26 | 839 | M1 avg | M0 rate end of Feb |
| Mar '26 | 974 (editable) | M0 avg | 0 |

### Two tabs
1. **March Model** — waterfall chart + editable inputs + model detail table
   - Toggle: Average vs Adjusted rates
   - Editable: March CW target (default 974), per-cohort adjusted rates
   - "Mar Launches (Act.)" column in amber shows MTD actuals
   - MTD total shows with "incl. N from pre-Dec '25" footnote
2. **Historical Activations** — line chart of cumulative activation % by cohort over time + raw data table (excludes March '26)

### Key components
- `EditableRate` — click-to-edit inline rate (%, validated 0–100)
- `EditableNumber` — click-to-edit inline integer (CW count)
- `WaterfallChart` — stacked bar chart simulating waterfall via invisible offset bars
- `WaterfallTooltip` / `CumTooltip` — custom recharts tooltips
