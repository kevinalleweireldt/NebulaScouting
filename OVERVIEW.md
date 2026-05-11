# NebulaScouting — Project Overview

**Live Site:** https://nebulascouting.vercel.app  
**Author:** Kevin Alleweireldt  
**Status:** In progress  
**Game:** 2026 FRC **REBUILT** (FUEL into HUB + Tower climbing)

---

## What It Is

NebulaScouting is a web-based FRC (FIRST Robotics Competition) scouting app for recording and reviewing match data. Scouters use it during competitions to track how robots perform — scoring FUEL into the HUB during auto and teleop, and climbing the Tower (L1/L2/L3) in auto and endgame.

---

## File Structure

```
NebulaScoutingLocal/
├── index.html                  # Landing/home page
├── vercel.json                 # Vercel deployment config (clean URLs + rewrites)
├── .gitignore
├── images/
│   └── stars.jpg               # Background image used site-wide
├── pages/
│   ├── navbar.html             # Shared navbar injected via fetch
│   ├── dashboard.html          # Hub page with links to all sub-pages
│   ├── matchform.html          # Form for entering REBUILT match scores
│   ├── matchdata.html          # Sortable/filterable data + charts (tabs)
│   ├── teamcomparison.html     # Side-by-side stat & chart comparison for 2-3 teams
│   ├── picklist.html           # Manual draggable pick list
│   ├── about.html              # About page
│   └── contact.html            # Contact page
├── script/
│   ├── app.js                  # Match form submit: collects fields, computes score, saves
│   ├── matchScore.js           # Counter controls (+/- buttons) for auto/teleop FUEL
│   ├── matchdata.js            # All matchdata page logic (sort/filter/avgs/charts/CSV)
│   ├── teamcomparison.js       # Team comparison logic + Chart.js line charts
│   ├── picklist.js             # Drag-and-drop pick list + auto-populate by avg score
│   ├── navbar.js               # Fetches navbar.html and injects into .navbar divs
│   └── tba.js                  # The Blue Alliance API helper (unused in UI currently)
└── style/
    └── style.css               # Global styles — dark space theme, purple accent, responsive
```

---

## Pages

| Page | URL (Vercel) | Description |
|---|---|---|
| Home | `/` | Welcome screen with link to Dashboard |
| Dashboard | `/dashboard` | Hub with buttons for all features |
| Match Form | `/matchform` | Input form for one match (REBUILT fields) |
| Match Data | `/matchdata` | Tabbed view: All Matches, Team Averages, Charts |
| Team Comparison | `/compare` | Compare 2-3 teams side-by-side |
| Pick List | `/picklist` | Draggable ranked pick list with team stats |
| About | `/about` | Project description |
| Contact | `/contact` | Placeholder contact info |

---

## 2026 REBUILT Scouting Fields

The match form has three labeled sections plus flags and comments:

- **Autonomous:** FUEL counter + Auto Climb radio (None / L1=15 / L2=20 / L3=30)
- **Teleop:** FUEL counter
- **Endgame:** Tower Climb radio (None / L1=15 / L2=20 / L3=30)
- **Flags:** "Played Defense" and "Broke Down" checkboxes
- **Extra Comments:** free-text textarea

`computeScore` (exported from `app.js`): `autoFuel + teleopFuel + climbPts[autoClimb] + climbPts[endgameClimb]` where `climbPts = [0, 15, 20, 30]`.

---

## Data Storage

All data lives in **browser localStorage**:

- `matchHistory` — array of match entries (see below)
- `pickList` — array of team-number strings, ordered by rank (index 0 = rank 1)

### `matchHistory` entry shape

```js
{
  matchNumber: string,
  teamNumber: string,
  autoFuel: number,
  autoClimb: number,        // 0=None, 1=L1, 2=L2, 3=L3
  teleopFuel: number,
  endgameClimb: number,     // 0=None, 1=L1, 2=L2, 3=L3
  defense: boolean,
  brokeDown: boolean,
  score: number,            // computed via computeScore()
  timestamp: string,        // ISO 8601
  extraComments: string
}
```

All consumers read with `?? 0` / `?? false` defaults to gracefully handle old entries from prior game versions.

---

## JavaScript Modules

### `matchScore.js`
Exports `initScoreControls()`. Manages two in-memory counters (`autoFuelValue`, `teleopFuelValue`), floors at 0, and wires +/- click listeners.

### `app.js` *(module)*
Imports `initScoreControls`. Exports `computeScore(entry)`. On submit, reads counter spans, radio groups, checkboxes, and inputs, then pushes the new entry to localStorage.

### `matchdata.js` *(plain script)*
Sortable/filterable table, per-team averages, four Chart.js bar charts (avg score, avg auto fuel, avg teleop fuel, climb distribution stacked), CSV export, "Clear All Data". Three tabs handled by `switchTab()`. Charts rendered lazily on first switch.

### `teamcomparison.js` *(plain script)*
Populates three team `<select>`s from unique scouted teams. On Compare, computes per-team stats, renders a stat-comparison table, per-team recent-match sub-tables, and two Chart.js line charts (score-per-match, fuel-per-match) with one dataset per team.

### `picklist.js` *(plain script)*
HTML5 drag-and-drop reorder + ▲▼ arrow buttons for mobile. "Add Team" (manual), "Auto-Populate by Avg Score" (sorted from `matchHistory`), and "Clear List" controls. Below the ranked list, a stats summary table shows averages for each ranked team.

### `navbar.js`
On `DOMContentLoaded`, fetches `../pages/navbar.html` and injects into `.navbar` divs. Navbar now includes: Dashboard, Form, Data, Compare, Pick List, About, Contact.

### `tba.js`
Utility for **The Blue Alliance API v3**. Reads `TBA_API_KEY` from `process.env` — not currently wired into the browser UI.

---

## Charting

Chart.js loaded via CDN (`https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js`) on `matchdata.html` and `teamcomparison.html`. All chart instances are tracked in module-level `let` variables and `.destroy()`'d before re-creation to prevent "canvas already in use" errors.

---

## Styling

Single stylesheet at `style/style.css`. Key design choices preserved from the original:
- **Background:** `stars.jpg` with dark gradient overlay (parallax fixed)
- **Color scheme:** White text, purple buttons/accents, `lavenderblush` hover
- **Font:** `monospace` throughout
- **Layout:** Flexbox, centered 1200px content column
- **Responsive:** breakpoints at 900px, 768px, 600px — navbar hides, tables shrink, charts stack to 1 column

New style blocks added for: `.radio-group`, `.checkbox-row`, `.data-controls`, `.tab-bar` / `.tab-btn`, `.chart-grid` / `.chart-card`, `.comparison-selectors` / `.selector-slot`, `.picklist-row` / `.drag-handle` / `.arrow-btn`, `.btn-danger`, `.btn-sm`, `.section-card`, `.sort-active`.

---

## Deployment

Deployed on **Vercel**. `vercel.json` maps short URLs to `/pages/*.html` and adds `/compare` and `/picklist` rewrites.

---

## Git & GitHub

- **Remote:** `git@github.com:kevinalleweireldt/NebulaScouting.git` (SSH)
- **Branch:** `main`
- **Auto-commit hook:** `.claude/settings.json` runs `git add -A && commit && push` after every Write/Edit by Claude Code. `.claude/` is gitignored.

---

## Known Gaps / Planned Features

- TBA API integration is stubbed but not connected to the UI.
- Pit scouting form is planned but not yet built.
- Custom scouter schedule generation is planned but not implemented.
- Contact page is a placeholder.
- About page has a minor HTML typo (`</body>` placement) and predates the 2026 update.
