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
| 0022 | games-rails lane | `0022_games.sql` — the games platform rails, REBASED over the live 0020_ludo shape (see below) | 2026-08-29 |

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
