# Nebula Scouting — Project Context

Live: https://nebulascouting.vercel.app · Repo: git@github.com:kevinalleweireldt/NebulaScouting.git · Branch: `main`

Auto-commit hook in `.claude/settings.json` (Stop event) commits + pushes once per Claude turn. `.claude/` is gitignored.

## Verification — use Playwright after every deploy-affecting change

Because the Stop hook auto-pushes, **every turn ships to production**. Treat each turn like a live deploy.

After making changes that affect served output — `vercel.json`, any HTML/CSS/JS, anything in `script/` or `pages/` — verify on the live site with the Playwright MCP before ending the turn:

1. Wait ~30s after auto-push for Vercel to rebuild (or poll `curl -sI https://nebulascouting.vercel.app/login` until HTTP 200).
2. Use `mcp__playwright__browser_navigate` to hit at minimum: `/`, `/login`, `/dashboard` (or whichever pages your change touched).
3. Check `mcp__playwright__browser_console_messages` for errors and confirm the page renders.
4. For auth-gated changes, sign in (test creds may be provided in conversation) and re-verify.
5. If anything 404s, regresses, or throws — **roll back the offending change in the same turn** rather than ending the turn with prod broken.

Special caution for `vercel.json`: rewrites, redirects, and `cleanUrls` interact in subtle ways. `cleanUrls: true` plus explicit `.html` destinations broke all rewrites and 404'd every clean URL once — verify with `curl` immediately after touching this file.

## What It Is
A fast FRC scouting web app. Scouters fill in a match form; admins review aggregate data, manage pick lists, and administer accounts. Deployed on Vercel; backend is Firebase (Auth + Firestore).

## Stack
- **Frontend:** Vanilla HTML/CSS/JS (ES modules, no build step)
- **Auth:** Firebase Email/Password — two roles: `admin`, `scouter`
- **Database:** Firestore — collections: `matchHistory`, `pickList/current`, `users`, `config/app`
- **External data:** The Blue Alliance API, proxied through `/api/tba` (Vercel Serverless) so the read key stays server-side
- **Deployment:** Vercel — clean URLs defined in `vercel.json`

## File Layout
```
/                       ← repo root
  index.html            ← marketing landing page (hero, features, workflow, 2026 sections)
  404.html              ← branded not-found page
  vercel.json           ← clean URL rewrites
  style/style.css       ← single stylesheet
  api/
    tba.js              ← Vercel Serverless proxy → The Blue Alliance; injects X-TBA-Auth-Key
  pages/
    login.html          ← standalone sign-in page (no navbar)
    dashboard.html
    matchform.html
    matchdata.html
    teamcomparison.html
    picklist.html
    admin.html          ← admin-only; also sets/edits config/app.eventKey
    about.html
    contact.html
    navbar.html         ← fetched & injected by navbar.js
  script/
    firebase-config.js  ← Firebase init; paste real config here before deploying
    auth.js             ← requireAuth() — called at top of every protected page
    navbar.js           ← injects navbar.html, wires auth state + logout; hides on scroll-down, shows on scroll-up
    login.js
    landing.js          ← landing-page interactions (index.html)
    admin.js            ← secondary Firebase app pattern for creating accounts; manages active event key
    app.js              ← match form: typed match # validated against TBA quals; team # is a select populated from that qual's alliances; submit → Firestore addDoc
    dashboard.js        ← KPI strip (incl. Next Match via TBA), recent activity, top-5 leaderboard
    matchdata.js        ← Firestore-backed; everyone sees all rows; admin-only delete buttons + Clear All; tier heat-map green→red; team-nickname column from TBA
    picklist.js         ← Firestore-backed; scouter gets read-only view; sparkline per row; admin can seed roster from TBA event teams
    teamcomparison.js   ← Trend chart (per-match score + running avg) with multi-team chip rail; scouter sees only their own submissions (filters by submittedBy)
    matchScore.js       ← counter UI logic, imported by app.js
    chart-theme.js      ← shared Chart.js defaults, brand palette, drawSparkline() helper
    tba.js              ← TBA client: reads config/app.eventKey, fetches event/teams/matches via /api/tba, caches 15min
```

## Auth Flow
Every protected page body has `class="auth-loading"` (hides content). The page's module script calls `await requireAuth()`, which resolves or redirects. `auth-loading` is removed on success.

## Role Rules
| Feature | Admin | Scouter |
|---|---|---|
| See all matches on /matchdata and /picklist | ✓ | ✓ |
| /compare team comparison data | All submissions | Own submissions only |
| Delete matches | ✓ | ✗ |
| Clear all data | ✓ | ✗ |
| Edit pick list | ✓ | Read-only |
| Access /admin | ✓ | Redirected to /dashboard |

## Data Model
```
users/{uid}:           { email, displayName, role, createdAt }
matchHistory/{docId}:  { matchNumber, teamNumber, autoFuel, autoClimb, teleopFuel,
                         endgameClimb, defense, brokeDown, score, extraComments,
                         submittedBy, submittedByEmail, timestamp }
pickList/current:      { teams: [string] }
config/app:            { eventKey }   ← active TBA event (e.g. "2026txcmp2"); set via /admin
```

## 2026 Game Tracking
- FUEL into HUB: auto + teleop counters
- Tower climbing: L1 (15 pts) / L2 (20 pts) / L3 (30 pts) — auto and endgame
- Defense and breakdown flags per match

## Known Gaps / Roadmap
- Pit scouting not yet built
- Scouter schedule generation not yet built
