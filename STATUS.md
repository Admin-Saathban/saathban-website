# Overnight status — feature/app

Maintained by the overnight integration session. Last update:
**2026-08-29, morning priority round.**

## Test data baseline (reset this morning — keep it legible)

| Account | State |
|---|---|
| test-icon@saathban.dev | Icon; some daily_logs from smoke runs; sees the hub at /app/home |
| test-fam@saathban.dev | In test-icon's circle with **can_see_mood + can_manage_reminders + can_configure_daily_log** (the last added with 0033, deliberately ON so the "set up with help from Test" path is exercised; flip it to false to check the ungranted state); owns the "Morning walk" reminder (08:00 + 17:30, notifies the Icon) |
| smoke-fam@saathban.dev | **The open-defaults fixture (0037).** In test-icon's circle, created through the real request → approve path: mood + health + reminders + SOS all ON, `quiet_days_notice` false. Kept deliberately — the only membership in the database showing post-0037 behaviour, while test-fam above stays the pre-0037 membership with its deliberately mixed grants, so old and new sit side by side |
| smoke-icon@saathban.dev / smoke-fam@saathban.dev | **Dedicated suite accounts** — in each other's circle, same password. Every check that WRITES a message or opens a table uses this pair so the test-icon ↔ test-fam thread stays clean for retesting |
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

## Pre-launch test-data purge — THERE IS NOW A SCRIPT

**`scripts/purge-test-data.mjs`** — dry run by default, `--execute`
to run it, needs `SUPABASE_SERVICE_ROLE_KEY` (deleting an account
touches the auth schema, which the anon key cannot).

```
node scripts/purge-test-data.mjs                 # show what would go
SUPABASE_SERVICE_ROLE_KEY=... node scripts/purge-test-data.mjs --execute
```

The list below is no longer maintained by hand — the script holds it,
and the volume is why: at the last count 16 accounts, **51 game
sessions and 30,247 move rows**, 334 notifications, 23 cancelled
sessions on smoke-icon alone, plus posts, DMs, logs and fixtures.
That is past the size where a person reliably clears it by hand the
night before launch.

**The safety property**: this database holds REAL accounts beside the
test ones (`hr@saathban.com`, `saathban@gmail.com`,
`tahirsajeel2002@gmail.com`). The script deletes only from an explicit
allow-list of addresses — never a pattern like `%@saathban.dev`, never
"everything except". Meeting an account on neither list, it STOPS and
prints it rather than guessing. Adding a test account means adding it
to `PURGE_EMAILS`; that friction is deliberate. Verified 2026-08-29:
the lists reconcile against the live 16 with nothing unaccounted and
no real address on the purge list.

Nearly everything cascades from `profiles.id`, so deleting the account
takes its logs, seats, messages, notifications and memberships with
it. Ownerless fixtures (the "Chai Reunion — Model Town" event, the
"Sticker Test Group") are named and removed explicitly. The script
then RE-READS to confirm the accounts are gone and no rows still point
at the deleted ids — agreement 10, because a delete that removed
nothing looks exactly like one that worked.

**Not automated, do by hand in the dashboard afterwards:** empty the
`cnic` bucket (identity documents — the most sensitive thing here),
`dm-images`, and `voice-notes`. Storage is not covered by the cascade.

Still worth doing before launch, beyond the data: fix the email
template redirect, add the production domain to the redirect
allow-list, revisit Site URL, and have the Urdu reviewed by a native
speaker.

### The old hand-maintained inventory (kept for reference)

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

## Database load discipline (2026-08-29 — READ BEFORE RUNNING A SUITE)

The Supabase project (`vmtbywzmqyzafbgquzjh`) is on small compute and
goes intermittently unresponsive under concurrent load: profile-fetch
OPTIONS hang pending, and the app sits on loading screens app-wide.

**Rule: at most ONE lane runs a DB-heavy suite (smoke, games, together,
community-social, any Playwright run) at a time.** Announce in the
cross-session channel before starting one and when it finishes. Prefer
a deployed preview over a local dev server while another lane is
testing, and keep browser contexts to what the check needs.

Investigated 2026-08-29, and the database is NOT the culprit:

| Checked | Finding |
|---|---|
| `cron.job` | ONE job — `saathban_game_tick`, `* * * * *`, `select public.game_tick()`. 120 runs in 2h, **0 failures, avg 26ms, max 233ms**. Not a runaway. |
| `cron.job_run_details` | No overlap, no growth in duration. |
| `pg_stat_statements` | No slow app query. Heaviest app statements are polls: game_seats 2837 calls @0.7ms, game_sessions 1946 @0.6ms, game_moves 891 @8.3ms, dm_messages 562 @2.1ms. The two genuinely slow statements (`pg_timezone_names` 324ms mean, extension listing 408ms) are **dashboard/MCP tooling, not the app**. |
| `pg_stat_activity` | max_connections 60; 16 open, 1 active, **0 idle-in-transaction, 0 lock waits**. No leak, no blocking. |

So what eats it: **volume, not cost**. Every open screen polls (session
2.5s, thread 4s, bell 6s), and several lanes each drive several browser
contexts at once, on top of password grants — each login is a bcrypt
verify, which is real CPU on a micro instance, and our suites log in
many times per run. The fix is the one-suite-at-a-time rule above plus
a compute upgrade; nothing in a migration needs undoing.

If a suite fails with hangs or an empty auth response, that is this —
re-run when the channel is clear before filing a bug.

## Known gap: "Cancel" on a game waiting room (2026-08-29)

The new one-screen setup (entry-flow lane) has a **Cancel** that
navigates away but leaves the table joinable — there is no cancel
RPC. Flagged honestly by that lane; deliberately NOT invented
mid-round, because it is a schema decision on a surface two lanes
are rebuilding. **Owner: the games/entry-flow lane (saathban-website-38), migration
0038** — transferred 2026-08-29 when their user assigned the same
work; integration had not started it. The analysis below stands as
the brief, and the recommended option (widen the CHECK, never
delete) is the one being built.

What makes it non-trivial, so nobody repeats the analysis:
`game_sessions_status_check` allows only lobby/active/finished, so
there is no "cancelled" state to move to, and each obvious route
costs something.

| Option | Cost |
|---|---|
| DELETE the session (host-only, lobby-only, refuse if another human is seated) | Cascades to seats, invites and moves — and `dm_messages.game_session_id` is ON DELETE CASCADE (0029d), so cancelling a carrom table started in a DM **deletes that chat message**. An invite notification already sent then deep-links to a missing session, which today renders "This table is private to its players" — misleading for a table that was called off. |
| Widen the CHECK to add `cancelled` | Touches every status filter (join_by_code, claim_open_seat, invite/respond, the cron tick) — each must exclude it — plus new copy ("this table was called off") on the session page. |

Recommendation: the second, done properly, with the deep-link copy —
the first quietly destroys a message in someone else's conversation.
Until then Cancel is honest read as "leave this table"; the table
stays open, which is harmless because a lobby table is only
reachable by its code or an invite.

## Working agreements (learned the hard way, 2026-08-29)

Several sessions share one working tree and one database here. Every
rule below was written after something actually broke — none is
theoretical, and each names the failure it prevents.

**1. A green local build proves nothing about origin.** Vite builds
the WORKING TREE; a dev server serves the working tree; only a build
from a clean checkout answers "can origin build this". Integration
broke origin by wiring a route to `NewGame.jsx` while that file was
still untracked — the local build passed, every build from git
failed. Run `git ls-files <path>` before wiring an import, and verify
in the isolated worktree before pushing.

**1b. The same trap catches STRINGS, not just modules.** A commit
shipped code calling `games.wait.calledOff` while that key sat
unstaged in the shared locale files — it builds, it deploys, and it
fails as a missing string in front of a person. The rule is anything
the code NAMES must be on the branch: imports, locale keys, RPC names,
routes, storage buckets. Grep the branch for the identifier, not just
the file.

**1c. Only running it catches a scope error.** A handler defined in a
parent while the button lives in the child builds perfectly and throws
"not defined" on the first tap. Build, run, AND check the branch —
they each catch a different class, and none substitutes for another.

**2. Say which tree you verified against.** "Verified" against a dev
server and "verified" against origin are different claims, and they
diverged today. State which one you mean when you report a run.

**3. `git commit -- <pathspec>` ignores your index.** It commits the
working tree at those paths, silently discarding hunk-level staging —
this swept one lane's locale keys into another lane's commit twice.
Pathspec ONLY when you own every changed line in those files; for
shared files (locales above all), stage hunks and commit with NO
pathspec. Never `git add -A`.

**4. The channel holds one DB-heavy suite at a time.** The holder's
own release is the authoritative event — if they hand it to you
directly, it is yours; the registrar is a convenience, not a gate.
Announcing your own intent is NOT taking it, and silence is not a
release.

**5. Don't change a function while another lane is measuring it —
and don't measure while another lane holds the channel.** Both
produce a result that describes nothing, which is worse than no
result because it looks like evidence.

**6. Verify the claim, don't relay it.** Read the LIVE function or
constraint rather than the migration file that was supposed to create
it. This caught a board map that had to match SQL exactly, confirmed
a partial index a whole design rested on, and disproved a dice bug
that three plausible arguments supported.

**13. The invariant is about the TABLE, not the seat: a game that
cannot progress must stop.** Four siblings, each retiring the
previous framing. Ludo declared a bot player it did not have (0042d);
`start_with_bots` seated bots where none could play (0043); `leave`
seated one through another door (0044). Each time the rule was
restated as "never seat a player that cannot act" — and the fourth
case has no seating decision anywhere in it: two people start a
carrom game, both walk away, both go `away` after three missed turns,
and game_tick spins 350 writes a minute for ever against a table
nobody is at. A rule about seats could not have prevented it. State
the property as termination — progress must be possible, or the game
ends — and it covers all four.

Corollary, because this one was found by MEASURING rather than
reasoning: a loop that writes steadily and forever looks exactly like
a busy app. Watch write RATE per minute, not just correctness.
**12. Unreadable is not clean, and a test written from a fix
inherits that fix's blind spot.** Two lessons that met in one check.
A suite guarding `start_with_bots` could never notice that
`leave_game_session` seats bots through a different door — so assert
the INVARIANT ("no live table in a bot-less game holds a bot seat")
reached by any route, not the RPC the fix happened to touch. And when
that invariant was written, it read RLS-hidden rows as empty and
reported the invariant HOLDING while seven violations sat in front of
it: this account's own seat had been converted to a bot, so it was no
longer a participant and could no longer read the seats proving the
bug. A row you cannot see is UNVERIFIABLE and must fail, never pass.
Silence is not evidence of absence.

**11. A crash before the cleanup is a SILENT skip — isolate every
case.** A suite threw on its fourth case, so cases five and six, all
the drops, and the final leaves-nothing-live assertion never ran. The
litter it left went unreported not because the check was wrong but
because the check never executed, and an early exit looks like a
shorter run rather than a missing one. Run each case inside a guard so
a throw is reported as a failed check instead of taking the rest of
the suite and its cleanup with it. Two failures stacked here — a
cleanup convention that did not clean, and a crash that hid it — and
either alone would have been visible.

The sharper form: the early exit skipped not just the cleanup but the
REPORT of it. The run printed fewer PASS lines and looked SHORTER
rather than broken. **A suite that can end early without saying so is
a suite whose green is conditional.** So make truncation visible: end
with an explicit completion line, or assert the number of checks that
ran, so a short run cannot be mistaken for a clean one.

**10. A cleanup that is not verified is not a cleanup.** A suite
deleted its fixtures with `DELETE /game_sessions?id=eq.<id>` and
checked the response was ok. That table has ONE policy — SELECT only —
so the delete matched zero rows and PostgREST answered **204**:
success-shaped, nothing removed. It silently left a live table per
game per run on the SHARED smoke account, where each one counts
against the one-live-table rule and surfaces as somebody's active
game. A borrowed account is not yours to leave dirty. Delete through
an RPC that RLS actually permits, and end the suite by asserting the
account is clean — the count, not the status code.

**9. A declaration is not a capability — test the capability.** Two
sibling defects, hours apart: ludo declared `bot_plays` while its
executor raised at every bot (tables froze, the exception swallowed);
carrom declared `pass_turn` and had no bot player, yet bots were
seatable (tables unfinishable). Each fix guards a different proxy and
NEITHER catches the other case — 0043 would have waved the broken
ludo through, because ludo was declaring the right intent and failing
to honour it. No runtime predicate can ask whether an executor works.
A test can: `tests/bot-players.mjs` reads the registry, fills each
table with bots, ticks it, and demands the board actually MOVE. When
you catch yourself guarding a flag that stands in for a behaviour,
assert the behaviour instead.

**8. Prove the check can FAIL before you trust it passing.** A
sweep of 120 locale keys first reported all 120 missing — the regex
was wrong, not the branch. The same bug in the other direction (a
check that silently matches nothing and reports everything present)
looks exactly like success and is how you ship believing you
verified. Run every new check once against something you KNOW is
absent, and only trust it after it has failed on cue. Prefer the
dumbest matcher that can work: plain `indexOf(leafName + ":")` beat
a regex here — no escaping, no CRLF sensitivity, re-runnable by
anyone in one line, and a false "present" is the only dangerous
answer.

**7. Test the row, not the return value.** A function that reports
success while changing nothing passes a return-value assertion. Check
the seat is gone, the flag is set, the write was refused BY THE
DATABASE.

## Attribution notes

History is not rewritten on a shared branch that several sessions are
committing to continuously — a rebase for a byline would cost everyone
more than it is worth. Where a commit carries another lane's work,
it is recorded here instead.

- **`62d8126`** (games lane) also contains the CARROM lane's work: the
  rewritten Timeouts paragraph and the `by_bot` note in
  GAMES_CONTRACT.md. Swept in by a whole-file `git add` on the most
  edited shared document in the repo, with three lanes in it that day.
  Content verified intact and verbatim — 10 `by_bot` references, the
  `Rules of record` heading and the queen material all present, nothing
  left uncommitted.

## Round log
- **Carrom/dispatch bugs + Snakes & Ladders (2026-08-29, `262fda7`, preview `saathban-website-ped79l9r9`):** user retest found 🎯 in a DM leading to a Race-to-100-looking screen and one session rendering blank. Causes and fixes: (a) SessionPage rendered the generic reference board for ANY game key — now dispatches carrom → CarromRailsController, ludo → its own screen once ACTIVE (the lobby stays on the rails, which owns the invite card/picker/code), else the reference board; (b) the DM inline embed had no lobby state, so the invitee saw a dead board and every DM table stayed in the lobby — the embed now offers "Take my seat" in-thread and shows the host a waiting line; (c) the "blank" session was a NON-PARTICIPANT view on a pre-3699012 deploy (RLS correctly returns no row) — it now reads "This table is private to its players", and a loading-or-failed session says so with a retry instead of a bare page; (d) bell poll 60s → 6s with visibility/focus refresh. **Race to 100 → Snakes & Ladders** (0035 applied): registry key race100 → snakes, both languages, existing sessions migrated, `game_exec_snakes()` with classic rules (server dice, ladders/snakes via `snakes_board_jump()`, exact roll needed for 100), SVG board in the brand palette with the move narrated in words. **Hygiene:** 40 junk messages purged from the real test-icon ↔ test-fam thread; the smoke suite now writes as dedicated `smoke-icon`/`smoke-fam` accounts (seeded, in each other's circle) so retest threads stay clean. Verified on the preview as both players: snakes create → invite → accept → auto-start → roll → both sides see the new cell; ludo lands on the ludo board and records a roll; carrom board inline for both, striker drag → play_turn. Ludo's one FAIL line in my run was a bad assertion (ludo legitimately has a Roll button), not a product bug.
- **Together/My-People/parity integration + full matrix (2026-08-29,
  tip `3d802a8`, preview `saathban-website-kfu76nujc`):** integrated
  and pushed, in order: 13's My People (`4923dcb`, rode the STATUS
  push), 8f's together layer (`4f44a82` rails 0029/0029b/0029c/0029d
  all applied + `97902f1` UI), 34's parity round (`c644a22` 0032
  applied, `3c89474` live bell, `3035c42` cross-role fixes incl. my
  suspended-buddy finding, `f420150` PARITY.md), and 13's pending-pane
  fix (`3d802a8`). **Matrix run in the real browser:** 34 role×route
  cells green (icon 13, fam 9, buddy 7, admin 5); suspended-buddy
  fixture flip verified UI + RLS gates (0 rows leak) then restored;
  deep flows all green — people-first create → invite → accept →
  auto-start → dice turn, open-table spoken code → buddy code-join,
  riddle solve + people strip + Shabash (daily cap renders 👏 ✓),
  group post, activity join state, game_tick RPC. **Smoke suite now
  37 checks** (games/riddle/group/activity sections added) — 37/37 on
  the preview. Deferred (owners): server-minted notification text is
  English-only in every writer — needs key+params design (34 flagged;
  future round); game timeout end-to-end beyond game_tick's 200 (pg
  cron minute — integration).
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
