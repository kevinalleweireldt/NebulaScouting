# NebulaScouting — Project Overview

**Live Site:** https://nebulascouting.vercel.app  
**Author:** Kevin Alleweireldt  
**Status:** In progress

---

## What It Is

NebulaScouting is a web-based FRC (FIRST Robotics Competition) scouting app for recording and reviewing match data. Scouters use it during competitions to track how robots perform — scoring coral at different reef levels and algae in the processor and barge.

---

## File Structure

```
NebulaScoutingLocal/
├── index.html              # Landing/home page
├── vercel.json             # Vercel deployment config (clean URLs + rewrites)
├── .gitignore
├── images/
│   └── stars.jpg           # Background image used site-wide
├── pages/
│   ├── navbar.html         # Shared navbar injected via fetch
│   ├── dashboard.html      # Hub page with links to Match Form and Match Data
│   ├── matchform.html      # Form for entering match scores
│   ├── matchdata.html      # Table view of all saved match history
│   ├── about.html          # About page
│   └── contact.html        # Contact page
├── script/
│   ├── app.js              # Match form logic: collects scores, saves to localStorage, redirects
│   ├── matchScore.js       # Score counter controls (+/- buttons) exported as initScoreControls()
│   ├── navbar.js           # Fetches navbar.html and injects it into .navbar divs
│   └── tba.js              # The Blue Alliance API helper (uses TBA_API_KEY env var — unused in UI currently)
└── style/
    └── style.css           # Global styles — dark space theme, purple accent, monospace font, responsive
```

---

## Pages

| Page | URL (Vercel) | Description |
|---|---|---|
| Home | `/` | Welcome screen with a link to the Dashboard |
| Dashboard | `/dashboard` | Links to Match Form and Match Data viewer |
| Match Form | `/matchform` | Input form for recording a single match |
| Match Data | `/matchdata` | Table of all saved matches from localStorage |
| About | `/about` | Project description |
| Contact | `/contact` | Placeholder contact info |

---

## How Match Scouting Works

1. Scouter opens **Match Form** and enters Match # and Team #.
2. They tap `+`/`-` buttons to record scores in six categories:
   - **Coral:** Level 1, Level 2, Level 3, Level 4
   - **Algae:** Processor, Barge
3. They can add free-text comments in the Extra Comments box.
4. On Submit, `app.js` bundles all scores plus metadata into an object and pushes it to `localStorage` under the key `matchHistory`.
5. The page redirects to the Dashboard.
6. **Match Data** reads `matchHistory` from localStorage and renders it as a table.

---

## JavaScript Modules

### `matchScore.js`
Exports `initScoreControls()`. Manages six in-memory score counters (floors at 0) and wires up all `+`/`-` button click listeners to update the displayed values.

### `app.js`
Imports `initScoreControls`. On `DOMContentLoaded`, initializes score controls, then listens for the Submit button click. Reads all score spans and form inputs, builds a `matchData` object (with `timestamp`), appends it to the localStorage array, alerts the user, and redirects to the dashboard.

### `navbar.js`
On `DOMContentLoaded`, fetches `../pages/navbar.html` and injects the HTML into `.navbar` divs. Provides the shared nav (logo + Dashboard / Data / About / Contact links).

### `tba.js`
Utility for querying **The Blue Alliance API v3**. Reads `TBA_API_KEY` from `process.env` (Node-style — not currently wired into the browser UI). Exports `fetchTBAData(endpoint)` which calls `GET ${BASE_URL}${endpoint}`.

---

## Styling

Single stylesheet at `style/style.css`. Key design choices:

- **Background:** `stars.jpg` with a dark gradient overlay, fixed attachment — creates a parallax space effect.
- **Color scheme:** White text, purple (`purple`) buttons and accents, `lavenderblush` hover state.
- **Font:** `monospace` throughout.
- **Layout:** Flexbox, centered content column (1200px max-width on desktop).
- **Responsive:** Media queries at 900px, 768px, and 600px shrink fonts, stack flex containers, and hide the navbar on mobile.

---

## Deployment

Deployed on **Vercel**. `vercel.json` enables `cleanUrls` and maps short paths (`/dashboard`, `/matchform`, etc.) to their HTML files in `/pages/`.

---

## Git & GitHub

- **Remote:** `git@github.com:kevinalleweireldt/NebulaScouting.git` (SSH)
- **Branch:** `main`
- **Auto-commit hook:** `.claude/settings.json` (gitignored, project-local) contains a `PostToolUse` hook that triggers after every `Write` or `Edit` tool call by Claude Code. It runs `git add -A`, commits with an `Auto-save: YYYY-MM-DD HH:MM:SS` message if there are changes, and pushes to `origin main`.
- `.claude/` is excluded from git via `.gitignore` so the local Claude Code config is never committed.

---

## Data Storage

All match data is stored in **browser localStorage** (`matchHistory` key). There is no backend database. Data is local to the device and browser session.

---

## Known Gaps / Planned Features

- TBA API integration is stubbed but not connected to the UI.
- Pit scouting is mentioned in the About page but not yet built.
- Custom scouter schedule generation is planned but not implemented.
- Contact page is a placeholder.
- About page has a minor HTML typo (`</body>` is misplaced before content).
