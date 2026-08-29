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

## Contract dependencies

- **Outdoor → 0027/0028 activity shape** (saathban-website-34): outdoor reads community_posts post_type in (walk, activity) relying on payload keys activity/place_id/place_name/starts_at/limit + ref_id dedupe against outdoor_outings, and reads post_joins / join_activity(); it writes only through communityData.shareActivity/joinActivity re-exports. Any change to shareActivity's signature or payload keys needs a ping to the outdoor lane.
