# Migration numbering convention

**Before claiming a number: check this folder for the highest existing
number AND ask the integration session (the one that owns pushes) to
reserve it.** Two lanes both claimed 0012 on 2026-08-29; the files were
renumbered afterwards to match the order actually applied to the
project. A number is claimed the moment either a file exists here or
the integration session has reserved it — whichever happens first.

Sequence = applied order on the live project, always. If your file's
number no longer matches by the time you apply, renumber the file, not
the database.

## Applied-name → file mapping (where they differ)

| Applied migration (live project) | Repo file |
|---|---|
| `skill_interest` | `0012_skill_interest.sql` |
| `0012_events_calendar` | `0013_events_calendar.sql` (renumbered) |
| `0012b_calendar_rls` | no own file — the RLS block it applied is contained in `0013_events_calendar.sql` (it was omitted from the first live apply and patched separately) |
| `0014_community` | `0014_community.sql` |

Everything earlier matches 1:1 by name.

## Reservations

A row here claims the number even before the file lands.
**Number ranges, from 2026-08-30.** Three lanes claiming "the next free
number" collided three times in one night — twice because I offered a lane
"0055 upward" and then took 0055 and 0056 myself, and once because two
commits landed one second apart. Sequential allocation cannot work when
claimers are concurrent: by the time you have read the tip, it has moved.
So each lane now owns a RANGE and never needs to ask:

| Lane | Range |
|---|---|
| integration (registrar) | 0060–0069 |
| messages / community / Fam | 0070–0079 |
| games / sharing (Lane A) | 0080–0089 |
| board, navigation, onboarding | 0090–0099 |

Register the row when you APPLY, not when you plan. Everything below 0060
is history and keeps the number it shipped with.


| Number | Claimed by | For | Date |
|---|---|---|---|
| 0015 | integration | `0015_document_responses_reminder_times.sql` — applied | 2026-08-29 |
| 0016 | outdoor lane | `0016_outdoor.sql` — applied | 2026-08-29 |
| 0017 | milestones lane | `0017_milestones.sql` — applied | 2026-08-29 |
| 0018 | community shares lane | `0018_community_shares.sql` — applied | 2026-08-29 |
| 0019 | people/circle-DM lane | `0019_circle_dms.sql` — applied | 2026-08-29 |
| 0020 | ludo lane | `0020_ludo.sql` — **applied live 2026-08-29 07:40** (tables empty at resolution time) | 2026-08-29 |
| 0021 | events lane | `0021_event_proposals.sql` — applied (renumbered out of the 0019 collision; applied name `event_proposals`) | 2026-08-29 |
| 0022 | games-rails lane | `0022_games.sql` — **applied** (ALTER-rebase over live 0020_ludo, including data migration of live test rows; registry, moves/invites, engine RPCs, Daily Riddle, pg_cron tick). Contract: `GAMES_CONTRACT.md` | 2026-08-29 |
| 0023 | ludo lane (saathban-website-34) | ludo follow-up — `game_exec_ludo` contract rewrite onto the 0022 rails dispatch | 2026-08-29 |
| 0024 | carrom lane (saathban-website-13) | carrom — `games` registry row + `game_exec_carrom` executor on the rails tables | 2026-08-29 |
| 0025 | integration | `0025_game_invite_eligibility.sql` — **applied**: mixed-role invitees (connected Icon/Fam/ACTIVE Buddy), connection + standing checks on invite and accept | 2026-08-29 |
| 0026 | groups lane (saathban-website-13) | `0026_groups.sql` — **applied** (groups, members, invites, posts, chat; reports kinds extended keeping park_board) | 2026-08-29 |
| 0027 | games/community lane (saathban-website-8f) | `0027_community_social.sql` — **applied** (activity posts + joins, friendships widening game_connected(), DM game embeds) | 2026-08-29 |
| 0028 | games/community lane (saathban-website-8f) | `0028_activity_rsvp.sql` — join_activity RSVP wording + announce_activity() | 2026-08-29 |
| 0029b–d | games lane (saathban-website-d3) | applied, no number consumed: `0029b_warmth_presolve` (person_warmth veiled until the caller solves), `0029c_claim_consumes_invite` (claim_open_seat accepts the caller's own pending invite), `0029d_dm_attachment_cascade` (dm_messages.game_session_id ON DELETE CASCADE) | 2026-08-29 |
| 0029 | games/community lane (saathban-website-8f) | `0029_together.sql` — together layer: game_people() picker, join_by_code() (server-side rate limit), invite/respond v2 (replaces invite_to_game/respond_game_invite, preserving 0025's eligibility + connection gates — 0025's shape is unchanged since it applied), riddle_touches (once-per-day cap) + riddle_people(), person_warmth(), boast_to_people() | 2026-08-29 |
| 0030 | integration | `0030_dm_unify.sql` — **applied**: unique DM pair index, direction-blind send_dm_request() (a reverse-pending request is accepted by the caller's ask), dm_messages → bell trigger (one unread `kind='dm'` notification per thread, link `/app/people/<sender>/chat`, no content leak) | 2026-08-29 |
| 0031 | people lane (saathban-website-13) | `people` — my_people() RPC (deduped connections + away flag). Riddle nudges belong to 0029's riddle_touches — call 8f's, don't ship a second table | 2026-08-29 |
| 0032 | parity lane (saathban-website-34) | notification parity — deep-link backfills on existing notification writers (milestone/document/reminder/event-proposal, from live pg_get_functiondef, link value only) + circle notifications (approve notifies member, accept-invite notifies icon). No table changes. NOTE: dm notifications are 0030's trigger — don't touch kind='dm' | 2026-08-29 |
| 0033 | daily-log lane (saathban-website-f2) | `0033_daily_log_prefs_voice.sql` — daily_log_prefs (server-side iconPrefs), circle_members.can_configure_daily_log, private `voice-notes` bucket + policies, prefs-change notification trigger. Claimed by ledger row at f2's request while registrar 84 was unreachable (row written by -38 to keep one writer) | 2026-08-29 |
| 0035 | integration | `0035_snakes_ladders.sql` — **applied**: Race to 100 → Snakes & Ladders. Registry key `race100` → `snakes` (names/taglines en+ur; existing sessions migrated), `game_exec_snakes()` (server dice, classic exact-100 finish, ladders/snakes via `snakes_board_jump()`), `game_exec_race100` dropped. Board map mirrored in `src/app/routes/games/snakes/board.js` — the two must agree | 2026-08-29 |
| 0040 | games lane (saathban-website-d3) | `0040_leave_game_session.sql` — **applied** — `leave_game_session()` for the one-active-table flow, covering the cases 0038 deliberately cannot: lobby-as-host delegates to cancel_game_session (single source of truth), lobby-as-guest releases the seat, ACTIVE converts my seat to a bot (`is_bot = profile_id IS NULL` makes this legal, and game_tick plays bot seats for bot_plays games) so nobody is stranded mid-game, and last-human-leaving cancels the table. No table changes; 0025/0029 gates and 0038 triggers untouched | 2026-08-29 |
| 0041 | games lane (saathban-website-d3) | `0041_leave_result_detail.sql` — create-or-replace of `leave_game_session` only: return `{result, seat: released|bot}` so the client states what actually happened instead of inferring it from `session.status` at tap time (wrong when a table fills between render and tap). Cancelled branches keep their shape — that sentence is about the table, not the seat. Applied AFTER the entry-flow lane commits, so their in-flight verification is not measuring a function that changed underneath it | 2026-08-29 |
| 0042 | games lane (saathban-website-d3) | `0042_desi_ludo.sql` + `0042b` + `0042c` (letter-suffixed, no numbers consumed) — **applied** — Desi Ludo ruleset, all server-validated: two-dice mode via `house_rules.dice_count`, the jota (paired pieces walling opponents, even-only at half the die, killable only by an exact jota, must split before the finish), and the sixes chain (3/6/9 voids, 4th/7th redeems). Replaces the ludo engine internals (ludo_legal / ludo_apply / ludo_roll / game_exec_ludo) from 0020/0023 — **the original ludo lane (saathban-website-34) is no longer running; ownership passes to d3, recorded in the migration header**. Additive at the rails: the 0022 contract and game_exec_ludo’s {move, winner, again} shape are unchanged. Old tables finish under old rules — `ludo_is_desi()` is `coalesce(state->>'ruleset','classic') = 'desi'`, verified live, so anything without the marker plays classic. 0042c grants execute on the PURE rule functions to authenticated: verified live that none is SECURITY DEFINER and none touches game_sessions/game_seats/game_moves/game_invites/profiles — they take a board as an argument, so a hypothetical board reveals nothing about a real game. `game_exec_ludo` stays revoked; `ludo_roll` remains executable as it always was (it is the ludo screen's own entry point) and now enforces the same desi gate | 2026-08-29 |
| 0043 | integration | `0043_no_bots_without_a_bot_player.sql` — **applied**: `start_with_bots` refuses a game whose `timeout_style` is `pass_turn` (carrom has no bot player, so a bot seat made the table unfinishable — the turn ping-pongs forever). The client already hid the button; the RPC accepted the call anyway, and the client is never the boundary. Found by generalising 0042d's rule to the other games. Remediates the four tables it had already produced (3 active) by calling them off with 0038's `cancelled`; finished tables left as history. Verified both ways: carrom refused with no seat created, snakes still allowed | 2026-08-29 |
| 0044 + 0044b | games lane (saathban-website-d3) | **both applied**. 0044: `leave_game_session` active branch: if the game has no bot player (`timeout_style = 'pass_turn'`), CANCEL the table instead of converting the leaver's seat to a bot — a two-seat game that loses a player has no game left in it. The third door into "seat a player that cannot act": 0042d fixed ludo declaring a bot it lacked, 0043 shut `start_with_bots`, and leave was seating one anyway. Seven ACTIVE carrom tables (1 bot + 1 human) were created through it AFTER 0043, and are remediated by the same migration. Lobby branch VERIFIED not assumed — a host leaving already routes to cancel_game_session, a guest leaving only deletes their own seat, so neither needed touching. **0044b changes `game_tick`, which is rails (integration's to allocate). Taken without asking during an active write loop, flagged immediately, and RATIFIED here** — an applied migration is never renumbered (sequence = applied order), and acting on live harm then disclosing at once is the right order. The defect it fixes was found by MEASURING, not reasoning: game_tick was writing 350 pass-moves a minute, flat and indefinitely, against the stranded tables. Its inner loop plays any seat that is a bot OR away and exits only on reaching a seat that is neither, so a table where every seat is one or the other spins to the guard of 50 every cron minute for ever. Verified by integration after the fact: 350/min through 23:32 → 0 in the 23:35 minute; 0 live pass_turn tables hold a bot seat; tests/bot-players.mjs went green because the DATA changed, no edit to the test. No cleanup UPDATE: the seven stranded tables were called off by the new termination condition on its first tick — remediation by mechanism, which is smaller and is its own evidence | 2026-08-29 |
| 0045 | games lane (saathban-website-d3) | `ludo_is_safe` — safe squares move one track step, `(0,13,26,39,8,21,34,47)` → `(1,9,14,22,27,35,40,48)`, from the user's marked-up screenshot (read off the image, then checked structurally: the new set is rotationally symmetric at +13, which a misread would not be). **Gameplay change: start squares stop being safe** — a token leaving the yard now lands capturable. Applied globally rather than gated on `state.ruleset`: integration verified the only live ludo tables are fixtures (one never-started classic lobby, one desi table of Test Icon + 3 bots), so no real game changes under anyone, and a board drawn one way while the engine plays another is the worse failure. Goes in GAMES_CONTRACT.md under Rules of record | 2026-08-29 |
| 0047 | integration | `0047_community_places.sql` — **applied**: an Icon can add a place. outdoor_places was seeded then closed (admins-only INSERT), so a person whose life happens at a maidan two streets away could plan nothing there. Adds `created_by` + `is_hidden`; read excludes hidden rows for everyone but admins; INSERT allowed to Saath-Icons only and only as themselves (`created_by = auth.uid()`), matching SPEC where initiation out in the world is the Icon's. No approval queue — that would make "usable immediately" a lie — and no dedupe rule: a duplicate park is a smaller harm than a person unable to name their own neighbourhood. Hiding is reversible and keeps the row so anything already planned there still resolves; there is deliberately NO delete policy. Verified live: icon adds (201), icon cannot add as another person (403), fam cannot add (403), fam sees it immediately, admin hides it and it vanishes for members while staying visible to admins | 2026-08-30 |
| 0048 | integration | `0048_reminder_dones.sql` — **applied**: one row per reminder per day, so a reminder can be ticked off and unticked. The Icon writes and undoes their own; a Fam member with `can_manage_reminders` may READ only — seeing that Ammi took her tablet is help, marking it for her is not, and the difference has to live in the policy rather than in the UI. Registered late: this row was missing while the file existed, which is exactly how two lanes take the same number. My miss as registrar, caught by the Lane C lane | 2026-08-30 |
| 0049 | integration | `0049_table_names.sql` — **applied**: a table can be named at setup (D1). Nullable `game_sessions.title` (naming stays optional forever — a table opened in ten seconds to play right now must not stop to be titled), `normalise_table_title()` collapsing whitespace and capping at 60, and `create_game_session` gains a fourth defaulted `p_title`. **Contains a trap worth reading before touching any RPC signature:** `create or replace` with a different parameter count creates an OVERLOAD rather than replacing, both then match a 3-argument call, and PostgREST refuses it as not unique — every existing caller breaks on a change that looked purely additive. The old signature is dropped explicitly, after the new one exists. Verified through PostgREST as a real user: 3-arg call still creates (unnamed), 4-arg call stores a normalised title, a 200-character title is capped to 60 rather than rejected. Title inherits game_sessions' RLS, so an OPEN table's name is visible to whoever joins by code — said beside the field, not buried in a policy | 2026-08-30 |
| 0050 | saathban-website-f2 (Lane A) | `0050_public_game_result.sql` — **applied**: the schema's FIRST deliberate `anon` grant, and the only one. One `security definer` function, `public_game_result(uuid)`; no table grants, no view, no RLS change. Returns a FINISHED game's player names and final board and nothing else — no profile ids, so nothing joins back to a person, and **no avatar urls**, because a photo is a storage path and that is a different decision from a first name. Not enumerable: one id in, one game out, keyed by an unguessable session id, exactly as the join link works. Reused this number rather than leaving a hole after Lane C released it; A3's rewards table takes the next. `tests/public-result.mjs` asserts both halves as a real anonymous client with no Authorization header — that the door opens, and that profiles, safe_profiles, daily_logs, dm_messages, circle_members, community_posts, game_sessions, game_seats and game_messages all still refuse (HTTP 401), including the very session it will hand out a result for | 2026-08-30 |
| 0051 | integration | `0051_close_the_anon_door.sql` — **applied**: revokes anonymous grants and the default that created them. Found by the Lane A lane while proving 0050 was the schema's only anon door — it wasn't. `audit_log` held SELECT and `reminder_dones` (mine, 0048) held **SELECT, INSERT, UPDATE, DELETE, TRUNCATE** to `anon`: full DML on rows recording whether a person took their medication. Neither was exploitable, and the reason matters — both refused a stranger because their RLS policies reference things anon cannot reach (`is_super_admin`, a SELECT on `circle_members`), not because the table was closed. Defence by accident, one policy edit from failing, and that edit would have looked like it was about circle permissions. **Root cause: Supabase ships `ALTER DEFAULT PRIVILEGES` granting anon ALL on every new table in `public`** (`pg_default_acl` → `anon=arwdDxtm`), so every table any lane creates arrives wide open unless its author remembers to revoke; the other ~40 tables are closed only because somebody remembered. This revokes the default itself for tables, sequences and functions, so new objects arrive closed and anything genuinely public must say `anon` out loud in its own migration where a reviewer can ask why. `authenticated`/`service_role` untouched, RLS unchanged. Verified after applying: zero rows in the anon grant inventory, `has_table_privilege('anon', …)` false for all three, signed-in Icon still reads (200), anon refused on both tables, and 0050's deliberate function still answers 200 | 2026-08-30 |
| 0052 | integration | `profiles.area` — PRODUCT_DECISIONS §2 collects city + area at signup, and §12 computes Out & about's distance bands (Walkable / Nearby / Across the city) from AREA rather than kilometres, because seniors think in "can I walk" not in km. `profiles` currently has `city` and no `area`, so the band cannot be computed at all today | claimed 2026-08-30 |
| 0053 | integration | admin three levels (§18): `moderator` joins `admin` and `super` in `profiles.admin_level`, with `is_moderator()` and a helper for "at least admin". A moderator gets community safety ONLY — reports, hide, mute, suspend-with-reason — and must NOT reach Buddy applications, documents, health data or broadcasts. Today `is_admin()` is a single boolean over `role = 'admin'`, so every admin surface is all-or-nothing | claimed 2026-08-30 |
| 0054 | integration | survey storage (§16), **super-admin-only**: answers stored separately from daily logs, never visible to Fam, Buddies, moderators or ordinary admins. The rule is enforced with RLS and proved by a negative test per §0.9, not by hiding the screen | claimed 2026-08-30 |
| 0055 | saathban-website-38 (§6) | `0055_first_contact.sql` — who may write to you first, decided at the database. **Number collision, resolved in their favour:** I told this lane to take 0055 upward, then took 0055 and 0056 myself for §17 and §19 and registered them after the fact. Theirs landed first (`a7b40c9`), they followed my instruction, so they keep the numbers and mine moved to 0057/0058. Nothing was re-applied — the live objects do not care what a file is called; only the filenames and this table changed | 2026-08-30 |
| 0056 | saathban-website-38 (§10) | `0056_fam_proposes.sql` — Fam proposes, Icon disposes, enforced at the database. Same collision, same resolution | 2026-08-30 |
| 0057 | saathban-website-38 (§10) | `0057_fam_keeps_a_log.sql` — a Fam member keeps their own log and chooses who sees it. Collided with my renumbered seat-links file by one second; theirs was first, so mine moved again to 0060 | 2026-08-30 |
| 0058 | integration | `0058_notification_defaults.sql` — **applied**: §19 defaults, enforced in the WRITER. `social_notify` now refuses to write a kind the recipient has turned off, because hiding it in the bell would still have delivered it and would still buzz a phone once push exists. No preferences table: the default is code (`notify_default_off`), the override is data (`profiles.settings->notify`), so a kind added later arrives with its default and needs no backfill. Unknown kinds default to ON deliberately — an unlisted kind is a notification about a person, the safe side to fail on. The kind-aware writer is a SEPARATE function, not a defaulted parameter, to avoid the 0049 overload trap. Verified by reading rows: default state delivers a person-kind and withholds an app-kind; with both defaults reversed the results swap, proving the gate can fail both ways | 2026-08-30 |
| 0059 | saathban-website-f2 (§2) | `profiles.date_of_birth date` — nullable at the database, mandatory in the signup UI (§2). Every existing profile predates the field and nobody invents a birthday for them. **Age is DERIVED, never stored**: no age column, no eligibility flag — the 50+ rule is computed, so nothing freezes a number that changes every year (same reasoning as POINTS.md points). **Not exposed**: `safe_profiles` is an explicit column list, so a new column on `profiles` cannot leak into it by accident — but the registrar ruling is that a birthday must never be added to it. What a circle may learn is the one derived fact "is it their birthday today", never the date and never the year. Claimed by the registrar on request, ahead of the lane applying it | claimed 2026-08-30 |
| 0060 | integration | `0060_seat_links.sql` — **applied**: §17 send-a-link seat. Single-use, 48h, distinct from the reusable spoken join code because a WhatsApp link gets forwarded and a forwarded code would let three strangers into a family game. Single-use is enforced under a row lock in the statement that seats the claimer, so two simultaneous opens are serialised by the database. Claiming also leaves the two connected. **Two traps worth reading:** `gen_random_bytes` lives in pgcrypto and is NOT on a `search_path` of public+pg_temp — it raises "function does not exist", which PostgREST surfaces as a bare 404 that reads like a missing RPC; and PostgREST does not reliably match a JSON number to a `smallint` parameter, producing the same misleading 404. Use uuids for tokens and `integer` for numeric RPC args. Verified at the DB: host can hold, outsider cannot, re-share replaces rather than duplicating, first claimer seated, second refused, expired refused, anon refused, connection created where there was none | 2026-08-30 |
| 0038 | games/entry-flow lane (saathban-website-38) | cancelled game sessions — widen `game_sessions_status_check` to allow `cancelled`, host-only + lobby-only cancel RPC, notify invited seats. **Deliberately NOT a delete**: `dm_messages.game_session_id` is ON DELETE CASCADE (0029d), so deleting a session started from a DM would destroy a message in someone's conversation. Must audit every status filter that assumes lobby/active/finished (my-tables lists, YourTurnChips, the waiting room, game_people, join_by_code, smoke selectors) so a cancelled table leaves the lists instead of lingering as a broken invite deep-link. Analysis originally recorded by integration in STATUS.md; ownership transferred 2026-08-29 |
| 0039 | games/entry-flow lane (saathban-website-38) | points hardening — once-per-day-per-source, flat daily tracker amount, daily cap, no client-writable points path, badges derived from presence days. Server-side only; the client must not be able to mint points | 2026-08-29 |
| 0037 | circle lane (saathban-website-f2) | circle defaults — sharing permissions default ON for NEW memberships only, set inside approve_circle_request + accept_circle_invite (NOT as column defaults, so no other insert path can silently grant), plus circle_members.quiet_days_notice (default false) and the post-acceptance notification deep-linking to that member’s review screen. **Explicitly no UPDATE over existing rows.** Reverses SPEC’s “default OFF except SOS” — user-directed; SPEC.md + QUESTIONS.md record the decision and the assisted-signup edge | 2026-08-29 |
| 0036 | games lane (saathban-website-d3) | `0036_snakes_board.sql` — create-or-replace of `snakes_board_jump()` only (no tables, no data migration): corrects the 0035 map so no jump touches square 1 or 100, all 38 squares are distinct (no shared squares, no chains), and snake drops are mostly 6-14 with exactly two long ones. **The map lives in two places — this function and `src/app/routes/games/snakes/board.js` — and `tests/snakes-board.mjs` must check the LIVE function, not the migration file, so a failed apply cannot leave the drawing and the play out of step** | 2026-08-29 |
| 0034 | people/milestones lane (saathban-website-38) | `0034_dm_depth.sql` — DM chat depth: dm_messages + reply_to_id/deleted_at/image_path, dm_message_hides (delete-for-me), delete_dm_message() (sender, 15 min, stub; report snapshots untouched), private bucket `dm-images` (participant-only), milestone_progress() (per-badge progress from the 0017 award rules). Applied name `dm_depth` | 2026-08-29 |

## Canonical DM surface (integration decision, 2026-08-29)

**One thread per pair, one route: `/app/people/<profileId>/chat`** (the
0014 tables via `open_dm_with`, upgraded ThreadPage with carrom embed,
stickers, money warning, report). `/app/community/messages/:requestId`
is a redirect to it; the community Messages inbox lists threads but
links to the canonical route. Every "Message" action anywhere in the
app targets `/app/people/<id>/chat`. DM unread = the `kind='dm'`
notification (0030); opening the thread clears both the messages'
`read_at` and the notification.

### 0020 collision resolution (integration session, 2026-08-29)

Both the ludo and games-rails lanes claimed 0020. Per this file's rule —
**sequence = applied order on the live project; renumber the file, not
the database** — 0020 belongs to ludo, whose migration was applied at
07:40 with working server-side game logic (14 functions). The rails
lane's draft was renamed to `0022_games.sql` by the integration
session; its DDL must be REWRITTEN as a rebase over the live shape
before applying: game_sessions/game_seats/game_messages exist and are
EMPTY, so the rails' preferred names are cheap column RENAMES
(target_seats→seats_total, 'playing'→'active', turn_deadline→
turn_started_at + house_rules.turn_seconds) plus new tables and the
exec_game_move() registry folding the ludo_* RPCs in. Do NOT create
those three tables again, and do NOT apply anything named 0020.
GAMES_CONTRACT.md (games lane) carries the field mapping.

## 0055 — first contact, server-enforced (saathban-website-38, 2026-08-30) — **APPLIED**

`0055_first_contact.sql` — PRODUCT_DECISIONS §6.5 and §6.6, both of which
§0.9 requires at the database rather than in the UI.

- `profiles.who_can_message` — `met` (default) / `anyone` / `connected`.
- `public.have_met(a, b)` — share a group, an event RSVP, or a park board.
  Read-only over `group_members`, `event_rsvps`, `park_board_messages`.
- `public.profile_is_complete(p)` — name, city and one more real detail.
- `send_dm_request` gains three refusals it did not have: the recipient's
  who-can-message setting, a complete profile for a FIRST contact with a
  stranger, and **a declined request is permanent** (it currently returns
  the declined row as though the request had gone through).

Deliberately NOT in it: replying is never gated, and messaging someone you
are already connected to is never gated — §6 is explicit that a blanket
block traps the isolated senior and merely inconveniences a scammer.

## 0056 — Fam proposes, Icon disposes (saathban-website-38, 2026-08-30) — **APPLIED**

`0056_fam_proposes.sql` — PRODUCT_DECISIONS §10, enforced at the database
because §0.9 and §20.6 both require a negative test proving an unapproved
change never took effect.

**What was already right, verified before writing anything:** `profiles`
UPDATE is self-only, so a circle member already cannot touch an Icon's
settings — including `who_can_message`. `circle_members` UPDATE is
icon-only, so a member cannot widen their own permissions. And the two
recurring permissions (`reminders`, `daily_log_prefs`) already work the
way §10's first row describes, announcing every instance by trigger.

**What was missing:** the *proposing* half. A Fam member had no way to ask
at all, so §10 was half-implemented as a wall rather than a door.

- `icon_change_proposals` — pending / approved / rejected / withdrawn.
- `propose_icon_change()` — circle members only, whitelisted fields.
- `decide_icon_proposal()` — the Icon only, and **the only path in the
  database that can apply the change**. Nothing writes before approval.
- Notifications both ways: the Icon on proposal, the proposer on decision.

## 0057 — a Fam member keeps their own log (saathban-website-38, 2026-08-30) — **APPLIED**

`0057_fam_keeps_a_log.sql` — PRODUCT_DECISIONS §10 reciprocity. daily_logs
INSERT required `app_role() = 'saath_icon'`, so a family member could not
keep a log at all; §10 says they keep one as a normal part of the app.
Adds `circle_members.member_shares_log` (default FALSE — the member's own
choice, the reverse direction from 0037) and an Icon read policy gated on
it. Verified: fam writes own log, icon sees NOTHING until shared, stranger
never.

## Contract dependencies

- **Outdoor → 0027/0028 activity shape** (saathban-website-34): outdoor reads community_posts post_type in (walk, activity) relying on payload keys activity/place_id/place_name/starts_at/limit + ref_id dedupe against outdoor_outings, and reads post_joins / join_activity(); it writes only through communityData.shareActivity/joinActivity re-exports. Any change to shareActivity's signature or payload keys needs a ping to the outdoor lane.
