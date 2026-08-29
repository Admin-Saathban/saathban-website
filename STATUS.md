# Overnight status — feature/app

Maintained by the overnight integration session. Last update:
**2026-08-29, morning priority round.**

## Test data baseline (reset this morning — keep it legible)

| Account | State |
|---|---|
| test-icon@saathban.dev | Icon; some daily_logs from smoke runs; sees the hub at /app/home |
| test-fam@saathban.dev | In test-icon's circle with **can_see_mood + can_manage_reminders**; owns the "Morning walk" reminder (08:00 + 17:30, notifies the Icon) |
| test-buddy@saathban.dev | Application `4269a7c6…` status **active** (a community-lane suite activated it); several document requests incl. one uploaded response |
| test-admin@saathban.dev | Support-level admin |

Password for all four: `SaathTest!2026`. Circle invites, RSVPs and
older reminders were wiped this morning; everything above was
re-seeded deliberately. Don't use these accounts for password-reset
testing (QUESTIONS.md).

## TL;DR
Everything landed and integrated; build clean; the full smoke suite
(17 checks) passes locally against real Supabase. Open decisions live
in [QUESTIONS.md](QUESTIONS.md). Preview verification for the latest
push is noted per round below.

## What landed tonight (integration round 1)

| Commit | What |
|---|---|
| `cecff3c` | Fam lane on real data: circle memberships via lib/circle.js, permitted daily-log views, join requests, reminders (migration 0011 — applied to the project) |
| `ac6831d` | My Circle, Icon side: permission toggles (default OFF), one-tap removal, SOS ordering, request approval, 48-hour invite codes |
| `58e8cc1` | i18n: Icon home + front door extracted to locales (home.*, appHome.*), Urdu drafted, Intl dates |
| `6797ac6` | Integration: `circle/*` wired per CIRCLE_WIRING.md (CircleRoutes), ensureProfile retry (3 attempts, backoff) per yesterday's preview anomaly |
| (this)   | Smoke suite in `tests/` (`npm run smoke`), STATUS.md, QUESTIONS.md |

All three wiring docs (CIRCLE, FAM, VETTING) are applied and marked
WIRED in place.

## How to run the checks
```
npm run dev            # port 5173
npm run smoke          # 17 checks against localhost
BASE_URL=<preview url> npm run smoke   # against a deployment
```
Test accounts: `test-{icon,buddy,fam,admin}@saathban.dev` /
`SaathTest!2026` (see QUESTIONS.md #2 before touching passwords).

## Working / verified
- All four role homes on real data (icon logs, admin review queue +
  questions + broadcasts, fam dashboard, buddy vetting status).
- Guards + cross-role bounces; no guarded-content flash.
- Icon daily-log persistence: server round-trip verified in a fresh
  browser session.
- /app/circle (Icon) wired and rendering.
- Missing-env deploys can no longer white-screen the marketing site
  (lazy client + /app boundary screen).
- Vercel Preview env vars fixed; latest verified preview:
  see the round log below.

## Broken / stubbed / watch out
- Moderation queue: mock (no reports table until step 11).
- Rest day: session-only UI state (QUESTIONS.md #5).
- iconPrefs: device-local, shared across accounts (QUESTIONS.md #1).
- SOS: deferred by design (SPEC — PWA push limits).
- Email onboarding blocked on custom SMTP (QUESTIONS.md #3).

## Round log
- **Outdoor + Milestones round:** Outdoor registration verified (rode
  along in 7152295). Milestones wired: milestones/* registered
  (Icons + admins), hub gains a Milestones card with the celebration
  hook (award catch-up on hub load; the card turns 🎉 "Something to
  celebrate!" while unseen badges exist — one is deliberately left
  unseen on test-icon so the next visit celebrates), AdminLayout gains
  a Milestones desk link. Rest day adopted onto the log (M2/#5
  closed): the toggle now writes a rest_day daily_logs row via
  logStore and survives reloads — presence/points/streaks count it
  server-side. Moderation queue handles park_board reports (O7):
  proper label + one-tap Hide for park_board_messages.
  QUESTIONS sweep O1–O10, M1–M6: all reviewed; O7 and M2 actioned
  (this round); O9's dedicated fixture test-buddy-pending@saathban.dev
  is part of the baseline; the rest are recorded decisions needing no
  code. Two in-flight quality-lane syntax breaks fixed/absorbed at the
  seam (Thread.jsx comment-in-expression; PlaceView.jsx self-fixed).
- **Morning priority round:** all lanes registered in AppRoot
  (events, skills, notifications + header bell, profile; community,
  circle, outdoor were already in). New **Icon hub** at /app/home
  (greeting, log summary, today's reminders, area cards; log at
  /app/home/log). New **Buddy home** at /app/buddy reflecting live
  pipeline status — active Buddies never see "start my application";
  suspended Buddies lose documents + matching (verified). **Documents
  channel** (migration 0015): buddy uploads to their private folder,
  request flips to received, requesting admin notified — verified end
  to end. **Multi-time reminders** (0015): fam-created reminders with
  several times render on the Icon hub and notify the Icon on create —
  verified (also fixed circle.js dropping remind_times on insert).
  Login forms are role-neutral now. Admin login lands on /app/admin in
  both flows (the reported mis-landing matches the transient profile
  read the ensureProfile retry now covers; not reproducible).
  Migration renumbering from between-rounds: bb63c03. Smoke suite:
  19 checks. Deferred: milestones lane (0017, mid-flight).
- **Round 1 (early morning):** committed fam/circle/i18n lanes, wired
  circle per CIRCLE_WIRING.md, ensureProfile retry, smoke suite added.
  Later in the round: vetting+fam i18n extraction committed
  (`bc060d8`), QUESTIONS.md merged with the events lane's product
  questions. **Preview verified: 17/17 smoke checks against
  https://saathban-website-h8w2o8yxt-basil-farooqs-projects.vercel.app**
  (deployment of `bc060d8`).
- **Pending for round 2:** events lane (migration 0012 committed by
  its lane as `e140ca8`; `routes/events/` still mid-flight),
  `routes/notifications/` (components ready, unwired — needs an
  AppRoot registration + probably the bell in AppHeader),
  `routes/profile/` (stores only so far). Check whether 0012 is
  applied to the live project before wiring events.
