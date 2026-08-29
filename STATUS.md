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

## Integration queue
- Wire carrom's DM inline-board when the community lane lands that piece (GAMES_CONTRACT_ASKS.md A4 + CARROM_WIRING.md).
- Groups lane (0026) will extend community_reports kinds — add its kinds to ModerationQueue KIND_LABEL/HIDE_TABLE on integration.
- Supabase dashboard (not doable from here): fix the email templates' redirect (see round log), add saathban.vercel.app + a preview wildcard to the redirect allow-list, revisit Site URL before prod cutover.

## Pre-launch test-data purge list

Everything below is dev fixture data in project `vmtbywzmqyzafbgquzjh`
and must be purged (or the DB reset wholesale) before real accounts
arrive. All four test accounts are on the convention password
`SaathTest!2026` (re-verified 2026-08-29 by the smoke suite's real
password grants).

| What | Where | Notes |
|---|---|---|
| The four test accounts + profiles | auth.users / profiles | test-{icon,buddy,fam,admin}@saathban.dev — cascade takes most below |
| "Chai Reunion — Model Town" | events | the only event row; demo fixture |
| "chai and carrom" activity + join | community_posts / post_joins | outdoor demo at Model Town Park |
| Community posts (4) | community_posts | smoke + lane test posts |
| DM thread + messages (24) | dm_requests / dm_messages | incl. `smoke-dm-*` / `unify-*` markers |
| Game sessions (11) | game_sessions + moves/invites | ludo/carrom test games |
| "Sticker Test Group" | groups + members/posts/chat | sticker-lane fixture |
| Outing + check-ins | outdoor_outings / park check-ins | |
| Daily logs (6), reminders, notifications, badges | daily_logs / reminders / notifications / earned badges | smoke runs write these continuously |
| Buddy application 4269a7c6… + documents | buddy_applications / document requests + storage | CNIC fixtures live in the private bucket — purge storage too |
| Circle membership test-fam→test-icon | circle_members | re-seeded baseline row |

## Round log
- **DM unification round (2026-08-29, `1259a32`):** ONE canonical
  thread per pair at `/app/people/<id>/chat` (decision + contract in
  MIGRATIONS.md). ThreadPage now carries the full feature set (carrom
  inline board, stickers, money warning, per-message report);
  `/app/community/messages/:id` redirects; inbox links canonical with
  New badges. Migration 0030 applied: unique pair index,
  direction-blind send_dm_request (reverse-pending auto-accept),
  dm_messages→bell trigger (one unread `kind='dm'`/thread, cleared on
  read). Smoke grew 7 dm checks (26 total) — green locally AND on
  preview `saathban-website-jz40tx9y8`. Reserved 0029 (8f together),
  0031 (13 people), 0032 (34 notification parity). Not covered yet:
  game timeout path (pg_cron tick) — owner: integration, next matrix
  round.
- **Fam home + My journey round (2026-08-29):** pushed
  `10522b9..051fea3` — `41049c8` (fam full home: per-person Message →
  people thread, shared-moments strip, care cards above nav cards) and
  `051fea3` (My journey at /app/history: calendar, presence, badges,
  trends). Preview `saathban-website-3mw55bysf` — 19/19 smoke plus
  deployed spot-checks (fam care card with mood + Message + reminders
  + moments strip; /app/history renders; outdoor city chips live).
  Note: the outdoor lane's `ce24f5e` was ALREADY carried in the
  previous `10522b9` push (it sat under my commit in the shared tree)
  — its "not pushed" handoff note was stale; nothing extra to do.
  **Baseline drift found and fixed:** `circle_members` was completely
  empty (some lane's cleanup wiped it — likely a one-tap-removal
  test), so the fam home showed the empty connect state. Restored the
  documented row (test-fam in test-icon's circle, can_see_mood +
  can_manage_reminders + SOS contact); the "Morning walk" reminder had
  survived. Outdoor's "chai and carrom" activity at Model Town Park +
  test-fam's join stay as demo data. login simplification (`a11e388`)
  and activities (`cf37311`) also confirmed pushed/live — the two
  "integrate when they land" items are closed.
- **Live-preview bug round (user testing):** (a) /app/games WAS
  reachable but undiscoverable — the Games/Groups cards existed only
  locally (uncommitted new-file pathspec miss); now committed for all
  three role homes. (b) DM "non-delivery" was real-but-read-side: the
  community thread never polled, so an open thread never showed new
  messages (writes were all stored; RLS fine; both DM surfaces share
  tables). Added 4s polling. (c) Threads opened at the oldest message
  — a single post-render scroll under-shot once sticker SVGs settled;
  replaced with a brief settle-loop that never yanks a reader who
  scrolled up (both DM surfaces). (d) stickers + (e) DM carrom were
  fine, just not yet deployed. All verified live two-account.
- **Role-home navigation round (user testing):** new rule adopted —
  every role's home surfaces everything that role can reach, via the
  shared AreaCards component (hub card style). Fam dashboard gains
  YourTurnChips + cards for Games, Events, Groups, Community, Skills,
  Notifications. Buddy home gains Events/Skills/Notifications for any
  Buddy, plus Community/Games/Groups + chips once ACTIVE (verified
  gated-absent on the pending fixture). Icon hub itself was missing
  Games and Groups cards — added (audit catch).
- **Groups + stickers wiring:** groups/* registered in AppRoot per
  GROUPS_WIRING (the lane had shipped routes + moderation but no
  registration); sticker picker adopted in the rails session chat and
  group chat per STICKERS_WIRING (send/render via :sticker/<id>:
  bodies — no migration). Verified end to end with real sends in a
  real group and a real race100 session. Community DMs remain the
  last unadopted sticker surface (community lane's call).
- **Games wiring + nav round:** GAMES_WIRING one-liners wired (bell
  rows with a link deep-link and mark read on tap; YourTurnChips on
  the hub) and the doc deleted per its instruction. AppHeader is now
  genuinely responsive: ≤640px collapses to mark + icon back arrow +
  bell + menu (full-width panel, 48px+ targets); collision-checked at
  390px. First-arrival ceremony: "Your email is confirmed — welcome,
  {name}" with Continue, first sign-in only (per-account+device),
  verified with a real minted signup incl. no-repeat. Hub: My Circle
  card always visible (door, per user direction overriding the
  nav-gating reading), My profile lives in the header only. Verified:
  Icon signup names persist (the "nameless" report was the root-
  landing bug, since fixed); invite eligibility live-checked (0025
  intact, 0027 widened game_connected with friendships). Groups lane
  (0026) and community_social (0027) landed self-committed and are in
  the registry.
- **Magic-link + game-invite round:** traced the root-landing magic
  links to the customized email template using redirect_to={{ .SiteURL }}
  instead of {{ .RedirectTo }} (edge logs show the clicked link's
  redirect_to = bare origin); shipped a root-landing safety net in
  main.jsx (tokens on / forward to /app/auth/complete) and verified
  THREE real minted-token signups end to end — correct-path link lands
  the hub; broken-template-shaped link now recovers via the deployed
  net (was dying on the marketing root). Applied 0025: game invites
  accept any CONNECTED Icon/Fam/ACTIVE Buddy (circle either direction
  today; friends/matching plug into game_connected()), invitee standing
  checked at invite AND accept. Registrar: 0026 reserved for groups.
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
