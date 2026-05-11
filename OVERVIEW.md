# NebulaScouting — Project Overview

**Live Site:** https://nebulascouting.vercel.app
**Author:** Kevin Alleweireldt
**Status:** In progress
**Game:** 2026 FRC **REBUILT** (FUEL into HUB + Tower climbing)

---

## What It Is

NebulaScouting is a web-based FRC (FIRST Robotics Competition) scouting app for recording and reviewing match data. Scouters use it during competitions to track how robots perform — scoring FUEL into the HUB during auto and teleop, and climbing the Tower (L1/L2/L3) in auto and endgame. The app also provides per-team analytics, side-by-side team comparison, and a draggable pick list for alliance selection.

---

## File Structure

```
NebulaScoutingLocal/
├── index.html                  # Hero landing page (primary + ghost CTAs)
├── vercel.json                 # Vercel deployment config (clean URLs + rewrites)
├── .gitignore
├── images/
│   └── stars.jpg               # Background texture used site-wide
├── pages/
│   ├── navbar.html             # Navbar fragment (logo + menu only), injected via fetch
│   ├── dashboard.html          # Hub page — 4-card grid linking to all features
│   ├── matchform.html          # Form for entering REBUILT match scores
│   ├── matchdata.html          # Sortable/filterable data + charts (tabs)
│   ├── teamcomparison.html     # Side-by-side stat & chart comparison for 2-3 teams
│   ├── picklist.html           # Manual draggable pick list
│   ├── about.html              # About page
│   └── contact.html            # Contact page
├── script/
│   ├── app.js                  # Match form submit + validation; exports computeScore()
│   ├── matchScore.js           # Counter controls (data-attribute driven)
│   ├── matchdata.js            # matchdata page logic (sort/filter/avgs/charts/CSV)
│   ├── teamcomparison.js       # Team comparison logic + Chart.js line charts
│   ├── picklist.js             # Drag-and-drop pick list + auto-populate by avg score
│   ├── navbar.js               # Fetches navbar.html fragment and injects it
│   └── tba.js                  # The Blue Alliance API helper (unused in UI currently)
└── style/
    └── style.css               # Global styles — modern dark theme, CSS variables
```

---

## Pages

| Page | URL (Vercel) | Description |
|---|---|---|
| Home | `/` | Hero landing with Dashboard + Quick Scout CTAs |
| Dashboard | `/dashboard` | Card grid linking to Match Form, Match Data, Compare, Pick List |
| Match Form | `/matchform` | Input form for one match (validated REBUILT fields) |
| Match Data | `/matchdata` | Tabs: All Matches (sortable/filterable), Team Averages, Charts |
| Team Comparison | `/compare` | Compare 2–3 teams side-by-side with stats + line charts |
| Pick List | `/picklist` | Draggable ranked pick list with team stats summary |
| About | `/about` | Project description |
| Contact | `/contact` | Placeholder contact info |

---

## 2026 REBUILT Scouting Fields

The match form is split into card sections:

- **Match Info:** Match Number + Team Number — **both required** (HTML5 `required` + JS validation)
- **Autonomous:** Auto FUEL counter (−1 / +1 / +5 / +10 / +20 buttons) + Auto Tower Climb radio (None / L1=15 / L2=20 / L3=30)
- **Teleop:** Teleop FUEL counter (same bulk increments)
- **Endgame:** Tower Climb radio (None / L1=15 / L2=20 / L3=30)
- **Notes:** "Played Defense" and "Broke Down" checkbox tiles + Extra Comments textarea

### Score Formula

`computeScore` (exported from `app.js`):
```js
score = autoFuel + teleopFuel + climbPts[autoClimb] + climbPts[endgameClimb]
// where climbPts = [0, 15, 20, 30]
```

### Form Validation

`app.js` blocks submission if `matchNumber` or `teamNumber` is empty. On failure:
- Invalid input(s) get `.is-invalid` class (red border + shake animation)
- An inline `.form-error` banner appears above the submit button
- Page scrolls to and focuses the first invalid field
- Error state clears as soon as the user types in the field

---

## Data Storage

All data lives in **browser localStorage**:

- `matchHistory` — array of match entries (see below)
- `pickList` — array of team-number strings, ordered by rank (index 0 = rank 1)

### `matchHistory` entry shape

```js
{
  matchNumber: string,        // required, non-empty
  teamNumber: string,         // required, non-empty
  autoFuel: number,
  autoClimb: number,          // 0=None, 1=L1, 2=L2, 3=L3
  teleopFuel: number,
  endgameClimb: number,       // 0=None, 1=L1, 2=L2, 3=L3
  defense: boolean,
  brokeDown: boolean,
  score: number,              // computed via computeScore()
  timestamp: string,          // ISO 8601
  extraComments: string
}
```

All consumers read with `?? 0` / `?? false` defaults to gracefully handle old entries from prior game versions.

---

## JavaScript Modules

### `matchScore.js` *(module)*
Exports `initScoreControls()`. Manages two in-memory counters (`autoFuelValue`, `teleopFuelValue`). Uses a **data-attribute pattern**: any button with `data-counter="auto|teleop"` and `data-delta="N"` is automatically wired up — no JS changes needed to add or remove increment buttons. Floors at 0.

### `app.js` *(module)*
Imports `initScoreControls`. Exports `computeScore(entry)`. On submit: validates required fields, reads counter spans, radio groups, checkboxes, and inputs, then pushes the new entry to localStorage and redirects to dashboard. Wires `input` listeners on required fields to clear the invalid state as the user types.

### `matchdata.js` *(plain script)*
Sortable/filterable table, per-team averages, four Chart.js bar charts (avg score, avg auto fuel, avg teleop fuel, climb distribution stacked), CSV export, "Clear All Data". Three tabs handled by `switchTab()`. Charts rendered lazily on first switch.

### `teamcomparison.js` *(plain script)*
Populates three team `<select>`s from unique scouted teams. On Compare, computes per-team stats, renders a stat-comparison table, per-team recent-match sub-tables, and two Chart.js line charts (score-per-match, fuel-per-match) with one dataset per team.

### `picklist.js` *(plain script)*
HTML5 drag-and-drop reorder + ▲▼ arrow buttons (mobile fallback). "Add Team" (manual), "Auto-Populate by Avg Score" (sorted from `matchHistory`), and "Clear List" controls. Below the ranked list, a stats summary table shows averages for each ranked team.

### `navbar.js`
On `DOMContentLoaded`, fetches `../pages/navbar.html` and sets `innerHTML` of the page's `.navbar` div. Navbar fragment contains: Dashboard, Form, Data, Compare, Pick List, About, Contact.

### `tba.js`
Utility for **The Blue Alliance API v3**. Reads `TBA_API_KEY` from `process.env` — not currently wired into the browser UI.

---

## Charting

Chart.js v4 loaded via CDN (`https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js`) on `matchdata.html` and `teamcomparison.html`. All chart instances are tracked in module-level `let` variables and `.destroy()`'d before re-creation to prevent "canvas already in use" errors. Chart options use white tick labels, transparent backgrounds, and purple/magenta/cyan/emerald accent colors to match the theme.

---

## Styling / Design System

Single stylesheet at `style/style.css`, organized into sections with comment dividers. **No build step** — plain CSS, deployed as-is.

### Design Tokens (CSS variables in `:root`)

- **Brand purples:** `--purple-50` through `--purple-900` (9-step scale)
- **Accents:** `--magenta` (#d946ef), `--cyan`, `--emerald`, `--amber`, `--rose`
- **Surfaces:** `--bg-0` (page), `--bg-1/2/3` (cards), `--bg-glass`
- **Borders:** `--border-1/2/3` (subtle / standard / accent)
- **Text:** `--text`, `--text-muted`, `--text-dim`
- **Effects:** `--shadow-soft/glow/deep`
- **Radii:** `--radius-sm`, `--radius`, `--radius-lg`, `--radius-xl`
- **Spacing scale:** `--space-1` (4px) through `--space-8` (64px)

### Fonts (Google Fonts)

- **`--font-hero`** — `Orbitron` (sci-fi geometric) — used for the logo, page `h1`s, dashboard card icons, and pick-list rank badges
- **`--font-display`** — `Space Grotesk` — used for `h2`, `h3`, card titles
- **`--font-body`** — `Inter` — body text, buttons, form controls
- **`--font-mono`** — `JetBrains Mono` — counter digits, team numbers, code

### Visual Language

- **Background:** Radial-gradient purple aurora + linear-gradient base + stars.jpg overlay, fixed-attached
- **Cards:** Glassmorphism — semi-transparent purple bg + `backdrop-filter: blur(12px)` + subtle gradient border via `::before` mask trick
- **Navbar:** Fixed-position, frosted-glass (blur + saturate), gradient-text logo
- **Buttons:** Purple gradient with inset highlight + soft shadow; hover lifts 1px and brightens. Variants: `.btn-danger`, `.btn-ghost`, `.btn-lg`, `.btn-sm`, `.btn-counter` (and `--med/--lg/--xl/--subtract`)
- **Counters:** Big gradient digits (white→purple) with purple text-shadow glow
- **Radio/checkbox tiles:** Selectable card-style with `:has(input:checked)` styling
- **Dropdowns:** Native `<select>` styled with custom SVG chevron + dark themed `<option>` list
- **Tables:** Glass background, uppercase header pills, hover rows, active-sort indicator (arrow + highlight)
- **Pick list rows:** Glass cards with gradient rank badges, lift on hover, magenta glow when drag-target
- **Dashboard:** Card grid (`auto-fit, minmax(240px, 1fr)`) with gradient-icon tiles
- **Scrollbar:** Custom purple gradient

### Responsive Breakpoints

- **900px:** content padding shrinks, table fonts shrink, charts collapse to 1 column
- **768px:** navbar wraps to two rows, hero text shrinks, radio grid → 2 columns, picklist rows wrap
- **480px:** radio grid → 1 column, counters shrink

---

## Deployment

Deployed on **Vercel**. `vercel.json` enables `cleanUrls` and adds rewrites for `/dashboard`, `/matchform`, `/matchdata`, `/compare`, `/picklist`, `/about`, `/contact`.

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
