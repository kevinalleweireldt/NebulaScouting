# NebulaScouting — Project Overview

FRC 2026 **REBUILT** scouting app (FUEL into HUB + Tower climbing). Plain HTML/CSS/JS, no build step, deployed on Vercel.
Live: https://nebulascouting.vercel.app · Repo: github.com/kevinalleweireldt/NebulaScouting

## Files

```
index.html              # Hero landing
vercel.json             # cleanUrls + page rewrites
images/stars.jpg        # Site-wide background texture
pages/
  navbar.html           # Fragment, fetched & injected by navbar.js
  dashboard.html        # 4-card grid linking to all features
  matchform.html        # Per-match scoring form
  matchdata.html        # Sortable table + averages + Chart.js charts (3 tabs)
  teamcomparison.html   # 2–3 team side-by-side compare + line charts
  picklist.html         # Draggable ranked pick list
  about.html, contact.html
script/
  app.js                # Match form submit/validation; exports computeScore()
  matchScore.js         # Counter controls (data-attribute-driven)
  matchdata.js          # matchdata page (sort/filter/avgs/charts/CSV)
  teamcomparison.js     # Compare logic + Chart.js line charts
  picklist.js           # DnD + auto-populate by avg score
  navbar.js             # Fetches navbar.html and injects it
  tba.js                # The Blue Alliance API helper (NOT wired into UI)
style/style.css         # All styles, divided by comment headers
```

## Routes (Vercel rewrites)

`/` `/dashboard` `/matchform` `/matchdata` `/compare` `/picklist` `/about` `/contact`

## REBUILT scoring

Form sections: Match Info (matchNumber + teamNumber, both required) · Auto FUEL counter + Auto Tower (None/L1/L2/L3) · Teleop FUEL counter · Endgame Tower · Notes (Defense, BrokeDown, Comments).

```js
score = autoFuel + teleopFuel + climbPts[autoClimb] + climbPts[endgameClimb]
// climbPts = [0, 15, 20, 30]   // index = None/L1/L2/L3
```

Validation in `app.js`: blocks empty matchNumber/teamNumber, adds `.is-invalid`, shows `.form-error` banner, scrolls + focuses first invalid field, clears on input.

## Data (localStorage)

- `matchHistory` — array of:
  ```js
  { matchNumber, teamNumber,           // strings, required
    autoFuel, teleopFuel,              // numbers
    autoClimb, endgameClimb,           // 0|1|2|3
    defense, brokeDown,                // booleans
    score, timestamp, extraComments }
  ```
- `pickList` — ordered array of team-number strings (index 0 = rank 1)

Consumers use `?? 0` / `?? false` to tolerate entries from prior game versions.

## Patterns to know

- **Counter buttons:** any button with `data-counter="auto|teleop"` + `data-delta="N"` is auto-wired. No JS edit needed to add increments. Floors at 0.
- **Charts:** Chart.js v4 via CDN on matchdata + teamcomparison. Instances tracked in module-level `let`s and `.destroy()`'d before re-render to avoid "canvas already in use".
- **Navbar:** loaded as a fragment via `fetch('../pages/navbar.html')` on `DOMContentLoaded`.

## Styling

CSS variables in `:root` of `style.css` define the design system: 9-step purple scale, accents (magenta/cyan/emerald/amber/rose), surface/border/text tiers, shadows, radii, 8-step spacing. Fonts: Orbitron (hero), Space Grotesk (display), Inter (body), JetBrains Mono (numbers/code). Glassmorphism cards (blur + gradient border via `::before` mask trick). Breakpoints: 900px (charts collapse to 1 col), 768px (navbar wraps), 480px (single-col radios).

## Git

Remote: `git@github.com:kevinalleweireldt/NebulaScouting.git` · Branch: `main`
Auto-commit hook in `.claude/settings.json` (Stop event) commits + pushes once per Claude turn. `.claude/` is gitignored.

## Gaps

- TBA API stubbed, not wired in
- Pit scouting form planned
- Custom scouter schedule planned
- Contact page is a placeholder
