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
| 0029 | games/community lane (saathban-website-8f) | `0029_together.sql` — together layer: game_people() picker, join_by_code() (server-side rate limit), invite/respond v2 (replaces invite_to_game/respond_game_invite, preserving 0025's eligibility + connection gates — 0025's shape is unchanged since it applied), riddle_touches (once-per-day cap) + riddle_people(), person_warmth(), boast_to_people() | 2026-08-29 |
| 0030 | integration | `0030_dm_unify.sql` — **applied**: unique DM pair index, direction-blind send_dm_request() (a reverse-pending request is accepted by the caller's ask), dm_messages → bell trigger (one unread `kind='dm'` notification per thread, link `/app/people/<sender>/chat`, no content leak) | 2026-08-29 |
| 0031 | people lane (saathban-website-13) | `people` — my_people() RPC (deduped connections + away flag). Riddle nudges belong to 0029's riddle_touches — call 8f's, don't ship a second table | 2026-08-29 |
| 0032 | parity lane (saathban-website-34) | notification parity — deep-link backfills on existing notification writers (milestone/document/reminder/event-proposal, from live pg_get_functiondef, link value only) + circle notifications (approve notifies member, accept-invite notifies icon). No table changes. NOTE: dm notifications are 0030's trigger — don't touch kind='dm' | 2026-08-29 |

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
