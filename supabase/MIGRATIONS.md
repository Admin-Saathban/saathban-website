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
| 0015 | (file already in folder, untracked) | `0015_document_responses_reminder_times.sql` | 2026-08-29 |
| 0016 | outdoor lane | `0016_outdoor.sql` — places, check-ins, outings, park boards | 2026-08-29 |
| 0017 | milestones lane | `0017_milestones.sql` — badges, earned_badges, awarding trigger/RPCs, rest_day log module | 2026-08-29 |
| 0018 | community shares lane | `0018_community_shares.sql` — post_type/ref_id/payload on community_posts for badge, score, walk, and event shares | 2026-08-29 |
| 0019 | people/circle-DM lane | `0019_circle_dms.sql` — open_dm_with() RPC; circle members' DM requests auto-accept | 2026-08-29 |
