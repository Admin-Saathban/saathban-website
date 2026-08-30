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
| 0053 | integration | `0053_admin_three_levels.sql` — **applied**: §18 moderator tier. `admin_level` is an ENUM (was `support, super`), so the level is added to the TYPE, not a check constraint; `moderator` sorts before `support`, which stays the ordinary admin. **`is_admin()` deliberately does NOT change meaning** — it is rewritten to EXCLUDE moderators, so every existing policy that reads it keeps its authors intent and a moderator gains nothing merely because this ran. Widening an existing predicate is how a permission change becomes invisible. New predicates `is_moderator()` and `can_moderate()` are additive; the ONLY surface that widens is the reports queue. `moderator_suspend()` requires a typed reason and notifies every admin with it. Verified live by promoting the real admin account: as a moderator `is_admin()` is false, `is_moderator()` true, and Buddy applications, daily logs, survey answers and the audit log all return ZERO — with a control proving a vetting row exists, so zero meant refused. An admin cannot self-promote (a trigger refuses it), which is itself §18 — only a super admin creates or demotes admins | 2026-08-30 |
| 0054 | integration | `0054_survey_super_admin_only.sql` — **applied**: §16 research survey. Answers are a separate table from daily logs on purpose: sharing a table would mean every future widening of log access (a Fam shared view, a break-glass welfare read) silently widened the survey too. `is_super_admin()` appears exactly once, in the read policy, and nowhere else — an ordinary admin is refused by the same rule that refuses a stranger, not a weaker one, because the consent screen promises "only the Saathban team" and §18 gives ordinary admins events and vetting. "You can stop at any point" is a delete policy, so stopping removes the answers rather than setting a flag. Verified: owner writes and reads; Fam, Buddy and ORDINARY ADMIN each read zero; a stranger 401; nobody can answer on another's behalf; the aggregate returns zero rows to a non-super caller; and a negative control proves a row exists while the admin sees none | 2026-08-30 |
| 0055 | saathban-website-38 (§6) | `0055_first_contact.sql` — who may write to you first, decided at the database. **Number collision, resolved in their favour:** I told this lane to take 0055 upward, then took 0055 and 0056 myself for §17 and §19 and registered them after the fact. Theirs landed first (`a7b40c9`), they followed my instruction, so they keep the numbers and mine moved to 0057/0058. Nothing was re-applied — the live objects do not care what a file is called; only the filenames and this table changed | 2026-08-30 |
| 0056 | saathban-website-38 (§10) | `0056_fam_proposes.sql` — Fam proposes, Icon disposes, enforced at the database. Same collision, same resolution | 2026-08-30 |
| 0057 | saathban-website-38 (§10) | `0057_fam_keeps_a_log.sql` — a Fam member keeps their own log and chooses who sees it. Collided with my renumbered seat-links file by one second; theirs was first, so mine moved again to 0060 | 2026-08-30 |
| 0058 | integration | `0058_notification_defaults.sql` — **applied**: §19 defaults, enforced in the WRITER. `social_notify` now refuses to write a kind the recipient has turned off, because hiding it in the bell would still have delivered it and would still buzz a phone once push exists. No preferences table: the default is code (`notify_default_off`), the override is data (`profiles.settings->notify`), so a kind added later arrives with its default and needs no backfill. Unknown kinds default to ON deliberately — an unlisted kind is a notification about a person, the safe side to fail on. The kind-aware writer is a SEPARATE function, not a defaulted parameter, to avoid the 0049 overload trap. Verified by reading rows: default state delivers a person-kind and withholds an app-kind; with both defaults reversed the results swap, proving the gate can fail both ways | 2026-08-30 |
| 0059 | saathban-website-f2 (§2) | `profiles.date_of_birth date` — nullable at the database, mandatory in the signup UI (§2). Every existing profile predates the field and nobody invents a birthday for them. **Age is DERIVED, never stored**: no age column, no eligibility flag — the 50+ rule is computed, so nothing freezes a number that changes every year (same reasoning as POINTS.md points). **Not exposed**: `safe_profiles` is an explicit column list, so a new column on `profiles` cannot leak into it by accident — but the registrar ruling is that a birthday must never be added to it. What a circle may learn is the one derived fact "is it their birthday today", never the date and never the year. Claimed by the registrar on request, ahead of the lane applying it | claimed 2026-08-30 |
| 0060 | integration | `0060_seat_links.sql` — **applied**: §17 send-a-link seat. Single-use, 48h, distinct from the reusable spoken join code because a WhatsApp link gets forwarded and a forwarded code would let three strangers into a family game. Single-use is enforced under a row lock in the statement that seats the claimer, so two simultaneous opens are serialised by the database. Claiming also leaves the two connected. **Two traps worth reading:** `gen_random_bytes` lives in pgcrypto and is NOT on a `search_path` of public+pg_temp — it raises "function does not exist", which PostgREST surfaces as a bare 404 that reads like a missing RPC; and PostgREST does not reliably match a JSON number to a `smallint` parameter, producing the same misleading 404. Use uuids for tokens and `integer` for numeric RPC args. Verified at the DB: host can hold, outsider cannot, re-share replaces rather than duplicating, first claimer seated, second refused, expired refused, anon refused, connection created where there was none | 2026-08-30 |
| 0061 | integration | `0061_calendar_actions.sql` — **applied**: §13. `calendar_entries.kind` gains `appointment` and `visiting`, and the table gains `person_id`. Without them, "Tuesday 10am — doctor" and "Friday — Sara visiting" are both `personal` and indistinguishable, so neither can offer the action §13 specifies; and "message her" cannot know who her is. `person_id` is nullable and nulls on delete rather than cascading, so an entry outlives the person leaving. **Medication stays excluded** (§13: it recurs daily and would bury what makes a day different), proved by a negative test that the database refuses the kind. Note: `0061_a_move_you_can_take_back.sql` briefly shared this number. 0061 is inside the integration range 0060-0069, so that file moves to the board lane range 0090-0099 | 2026-08-30 |
| 0062 | integration | `0062_saathban_course.sql` — **applied**: §16 course. The rule "you may skip straight to the exam but skipping earns NOTHING" lives in `course_award()`, not in the client, because a credential decided in the browser is not a credential. The required module list is server-side so a person cannot claim modules that do not exist, and adding a module later does not grandfather everyone who passed before it. Own-row RLS only — nobody reads another person's progress, since there are no leaderboards anywhere (§0.4). Verified: skipper refused, partial refused, modules-without-exam refused, invented module names refused, honest route awarded, double-award keeps the original moment, a Buddy can earn it too (§16 opens it to all roles), and a stranger is refused | 2026-08-30 |
| 0063 | integration | `0063_group_events_inherit_privacy.sql` — **applied**: GROUPS_SPEC §4, the sentence the spec itself flags as the one a lane will get wrong. A group event IS an Out & about happening, and built the simple way that leaks a private group's meeting place and time to the whole city — **by default, not as an edge case**: the outings read policy grants any community member a row whose `visibility='board'`, and the community writer hardcodes exactly that. Filtering in the group screen cannot fix it, because the city-wide list is a different query in a different file and a pasted URL is neither; the ROW has to refuse. One named predicate, `group_event_readable(group_id)`, ANDed onto the existing policy with every prior condition preserved — a rule spelled out twice is a rule that will disagree with itself. `groups.privacy` defaults to **`invite_only`**, which widens NOTHING: `can_see_group` was already admin-or-member-or-pending-invitee, so every pre-existing group was members-only already. Also carries the `create_group` privacy argument, dropping the 2-arg signature explicitly to avoid the 0049 overload trap. Test written BEFORE the feature and mutation-proven: `tests/group-event-privacy.mjs`, 10 checks including the store's own write path, each refusal paired with a control that must succeed | 2026-08-30 |
| 0064 | integration | `0064_place_access_notes.sql` — **applied**: OUT_AND_ABOUT_SPEC §4 access notes. Features are stored as KEYS (`shade`, `steps_at_gate`), never as English labels — Urdu ships day one and a table holding the string "Shade" would need a second migration to translate. Green/grey tone is derived from the key in ONE place in the UI, not stored per row, so no row can disagree with itself about whether it is reassurance or information. **§4.1 — who writes these — is NOT SETTLED and this migration does not settle it**: reads are open to anyone who can see the place, writes are admin-only, which is the narrowest thing that permits hand-seeding and forecloses neither answer. If the ruling is "admin-seeded" this already is it; if it is "anyone can suggest", one policy is added and nothing here is undone. Choosing crowd-writes now would be the irreversible move, because §4 says wrong notes are worse than none — "flat walk" where there are steps sends someone on a trip they cannot finish. `community_reports.target_kind` gains `place_access` so "something wrong here?" lands in the queue admins already work, with `target_author_id` null because a place has no author to answer for it | 2026-08-30 |
| 0038 | games/entry-flow lane (saathban-website-38) | cancelled game sessions — widen `game_sessions_status_check` to allow `cancelled`, host-only + lobby-only cancel RPC, notify invited seats. **Deliberately NOT a delete**: `dm_messages.game_session_id` is ON DELETE CASCADE (0029d), so deleting a session started from a DM would destroy a message in someone's conversation. Must audit every status filter that assumes lobby/active/finished (my-tables lists, YourTurnChips, the waiting room, game_people, join_by_code, smoke selectors) so a cancelled table leaves the lists instead of lingering as a broken invite deep-link. Analysis originally recorded by integration in STATUS.md; ownership transferred 2026-08-29 |
| 0039 | games/entry-flow lane (saathban-website-38) | points hardening — once-per-day-per-source, flat daily tracker amount, daily cap, no client-writable points path, badges derived from presence days. Server-side only; the client must not be able to mint points | 2026-08-29 |
| 0037 | circle lane (saathban-website-f2) | circle defaults — sharing permissions default ON for NEW memberships only, set inside approve_circle_request + accept_circle_invite (NOT as column defaults, so no other insert path can silently grant), plus circle_members.quiet_days_notice (default false) and the post-acceptance notification deep-linking to that member’s review screen. **Explicitly no UPDATE over existing rows.** Reverses SPEC’s “default OFF except SOS” — user-directed; SPEC.md + QUESTIONS.md record the decision and the assisted-signup edge | 2026-08-29 |
| 0036 | games lane (saathban-website-d3) | `0036_snakes_board.sql` — create-or-replace of `snakes_board_jump()` only (no tables, no data migration): corrects the 0035 map so no jump touches square 1 or 100, all 38 squares are distinct (no shared squares, no chains), and snake drops are mostly 6-14 with exactly two long ones. **The map lives in two places — this function and `src/app/routes/games/snakes/board.js` — and `tests/snakes-board.mjs` must check the LIVE function, not the migration file, so a failed apply cannot leave the drawing and the play out of step** | 2026-08-29 |
| 0034 | people/milestones lane (saathban-website-38) | `0034_dm_depth.sql` — DM chat depth: dm_messages + reply_to_id/deleted_at/image_path, dm_message_hides (delete-for-me), delete_dm_message() (sender, 15 min, stub; report snapshots untouched), private bucket `dm-images` (participant-only), milestone_progress() (per-badge progress from the 0017 award rules). Applied name `dm_depth` | 2026-08-29 |
| 0090 | board / navigation / onboarding | `0090_a_move_you_can_take_back.sql` — **applied**: LUDO_MOTION_SPEC §8 undo. Adds `game_moves.state_before` and the functions `game_undo_available` and `game_undo`. **The pre-move board is captured in `exec_game_move`, not per game** — that function already reads the session row before dispatching to `game_exec_<key>`, so the state before the move is in a local variable when the move row is written; capturing it there means undo needs nothing from ludo's engine, nothing from carrom's, and nothing from any executor written later, and there is no second copy of the board to drift. One column added to the existing insert; no behaviour change for any game, and games that never read it simply write it. **Reversed by appending, never rewriting**: the undone move's row is untouched and a new row records that it was undone and which row it undid, so `game_moves` stays append-only (0022). Guards, all at the database: only the mover, never a bot's move, only the most recent move, only once, never after the next player has rolled, never on a finished game, never for someone not seated; `house_rules.undo` absent means ON. Every refusal returns a REASON, not a bare false, so the screen can say why instead of leaving a dead button. Verified by `tests/undo.mjs` with each guard proved by making it fire, plus the row rather than the return value: after an undo the board reads its earlier value, the turn is back with the mover, and the log has gained a row rather than lost one. **Numbered 0061 for about an hour** before the ranges in this file were read; 0061 belongs to integration, so it moved here. Live objects were never re-applied — only the filename and the `state_before` column comment changed | 2026-08-30 |
| 0091 | board / navigation / onboarding | `0091_a_turn_is_thirty_seconds.sql` — **applied**: TONIGHT.md sets the ludo turn at 30s. Changes game_tick's FALLBACK from 60 to 30. The client fallback in ludoRails moves in the same commit and that pairing is the point: ludo's DEFAULT_RULES has said 30 for a while and every new table writes turn_seconds explicitly, but a table created before that carries no key, and for those the number came from two fallbacks that had to agree. The client one was deliberately left at 60 until now — a client counting 30 over a server waiting 60 shows a clock emptying while nothing happens and blames the player for a turn they were told they had lost. Tables that named their own turn_seconds are untouched by either side. game_tick is re-stated whole because CREATE OR REPLACE is the only way to change one line of a function; the body was taken from the LIVE definition immediately before the change rather than from an older migration file | 2026-08-30 |

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

## 0079 — being tagged is told (saathban-website-38, 2026-08-30) — **APPLIED**

POSTS_SPEC §5. A trigger on post_tags: the tagged person is notified
and the link lands on the post, where the tag can be removed. Never
fires when somebody tags themselves.

## 0078 — a voice in the feed (saathban-website-38, 2026-08-30) — **APPLIED**

POSTS_SPEC §7. community_posts.audio_path/audio_seconds, plus the two
buckets: post-audio (as visible as the post it belongs to, plus admins)
and report-evidence (a copy the reporter hands over, readable by admins
ONLY — granting admins read on dm-audio would have broken the promise
that they have no read path into DM threads, QUESTIONS.md C5).
community_reports gains target_media_bucket/path/kind so the queue has
something to play.

## 0077 — what a post can be (saathban-website-38, 2026-08-30) — **APPLIED**

POSTS_SPEC §2-§6, §10. visibility / style_tag / colour / replies_off /
pinned_at / help_* on community_posts, plus post_help_offers, post_tags,
post_saves, post_follows and profiles.allow_tagging. The missing verb
was UPDATE: the table had only is_admin(), so an author could delete a
post but never change one. Visibility is enforced in the READ policy.

## 0076 — the Messages world (saathban-website-38, 2026-08-30) — **APPLIED**

MESSAGES_SPEC §3/§5/§6. dm_message_likes (message,person) so one heart
per person IS the primary key and there is no counter; dm_archived per
person; show_presence / read_receipts / last_seen_at on profiles, and
appended to safe_profiles AFTER the columns another lane added since
0070. Read receipts change no write path.

## 0075 — a calendar that repeats (saathban-website-38, 2026-08-30) — **APPLIED**

TONIGHT §3.5. repeat_rule / repeat_days / repeat_until, and entry_times
as an array. repeats_yearly is NOT replaced — it carries every birthday
and nextOccurrence() reads it — so repeat_rule is backfilled from it,
and entry_time stays the first of entry_times so older readers work.

## 0074 — a voice in the thread (saathban-website-38, 2026-08-30) — **APPLIED**

§6. dm-audio bucket, folder-per-thread, mirroring dm-images. NOT the
existing voice-notes bucket, whose read policy is owner-or-mood-circle
and would have exposed a private note to the sender whole circle.
dm_messages gains audio_path + audio_seconds.

## 0073 — the first message (saathban-website-38, 2026-08-30) — **APPLIED**

§6. dm_requests.first_message: ONE nullable slot, so "one shot only"
is the shape of the table rather than a counter. set_dm_first_message
fills it once; decide_dm_request moves it into the thread on accept.
how_we_met answers "how they found you".

## 0072 — the family group (saathban-website-38, 2026-08-30) — **APPLIED**

§10. groups.family_of + ensure_family_group. The Icon cannot be removed
from her own family group (BEFORE DELETE trigger, cascade allowed
through so the group stays deletable), and the roll is synced to the
circle in both directions rather than kept as a second list.

## 0071 — a link that points at a person (saathban-website-38, 2026-08-30) — **APPLIED**

§7 personal invite links. personal_invites + create/open/accept, all
definer; no insert or update policy, so the binding rule and the
"never auto-connected" rule cannot be sidestepped by writing the table.
Blocks, gates and the daily ceiling are NOT reimplemented — the group
path calls send_friend_request, the personal path re-uses its helpers.

## 0070 — safe_profiles exposes area (saathban-website-38, 2026-08-30) — **APPLIED**

First migration in this lane's allocated range (0070-0079). §7's feed
widening needs the author's area and the RLS-safe view did not carry it.
Additive column, appended last because CREATE OR REPLACE VIEW cannot
reorder columns and dropping the view would take its grants with it.

## Contract dependencies

- **Outdoor → 0027/0028 activity shape** (saathban-website-34): outdoor reads community_posts post_type in (walk, activity) relying on payload keys activity/place_id/place_name/starts_at/limit + ref_id dedupe against outdoor_outings, and reads post_joins / join_activity(); it writes only through communityData.shareActivity/joinActivity re-exports. Any change to shareActivity's signature or payload keys needs a ping to the outdoor lane.
