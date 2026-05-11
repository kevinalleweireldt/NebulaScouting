# Nebula Scouting — Project Context

## What It Is
A fast FRC scouting web app. Scouters fill in a match form; admins review aggregate data, manage pick lists, and administer accounts. Deployed on Vercel; backend is Firebase (Auth + Firestore).

## Stack
- **Frontend:** Vanilla HTML/CSS/JS (ES modules, no build step)
- **Auth:** Firebase Email/Password — two roles: `admin`, `scouter`
- **Database:** Firestore — collections: `matchHistory`, `pickList/current`, `users`
- **Deployment:** Vercel — clean URLs defined in `vercel.json`

## File Layout
```
/                       ← repo root
  index.html            ← redirects to /dashboard (or /login if unauthenticated)
  vercel.json           ← clean URL rewrites
  style/style.css       ← single stylesheet
  pages/
    login.html          ← standalone sign-in page (no navbar)
    dashboard.html
    matchform.html
    matchdata.html
    teamcomparison.html
    picklist.html
    admin.html          ← admin-only
    about.html
    contact.html
    navbar.html         ← fetched & injected by navbar.js
  script/
    firebase-config.js  ← Firebase init; paste real config here before deploying
    auth.js             ← requireAuth() — called at top of every protected page
    navbar.js           ← injects navbar.html, wires auth state + logout
    login.js
    admin.js            ← secondary Firebase app pattern for creating accounts
    app.js              ← match form submit → Firestore addDoc
    matchdata.js        ← Firestore-backed; admin sees all, scouter sees own
    picklist.js         ← Firestore-backed; scouter gets read-only view
    teamcomparison.js   ← Firestore-backed; role-filtered
    matchScore.js       ← counter UI logic, imported by app.js
    tba.js              ← TBA API integration (stub/WIP)
```

## Auth Flow
Every protected page body has `class="auth-loading"` (hides content). The page's module script calls `await requireAuth()`, which resolves or redirects. `auth-loading` is removed on success.

## Role Rules
| Feature | Admin | Scouter |
|---|---|---|
| See all match data | ✓ | Own submissions only |
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
```

## 2026 Game Tracking
- FUEL into HUB: auto + teleop counters
- Tower climbing: L1 (15 pts) / L2 (20 pts) / L3 (30 pts) — auto and endgame
- Defense and breakdown flags per match

## Known Gaps / Roadmap
- `firebase-config.js` still has placeholder values — needs real Firebase project config
- `tba.js` is a stub — TBA API integration not yet implemented
- Pit scouting not yet built
- Scouter schedule generation not yet built
- Composite Firestore index needed for scouter query (`submittedBy` + `timestamp`) — link appears in console on first run
