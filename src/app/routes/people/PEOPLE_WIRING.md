# My People — the unified connections surface

`/app/people` is the ONE place, for every role, holding all human connections.
Already registered in AppRoot (the people routes existed); this upgrade added
the index list, the requests inbox, and the full person profile.

## Surfaces & routes

| Route | Screen |
|---|---|
| `/app/people` | `PeopleList` — circle + friends + shared-group members, deduped, chips, recency-sorted, searchable |
| `/app/people/requests` | `RequestsPage` — the ONE connection-requests inbox (friend_requests 0027); `/app/community/connect` now redirects here |
| `/app/people/:id` | `PersonPage` — safe fields, chips, since-when, shared moments + warmth badges, presence hints, capability-gated actions |
| `/app/people/:id/chat` | `ThreadPage` — the canonical DM thread (integration session's, per the recorded DM-unification decision) |

## Data & privacy (the load-bearing parts)

- **List:** `my_people()` (migration **0031**, registrar-reserved). SECURITY
  DEFINER; returns ONLY safe fields + chips (`in_circle` / `is_friend` /
  `group_names`) + `connected_since` + `last_interaction` (recency sort) + one
  deliberate extra bit, `away` (= `profiles.is_paused`) for the dimmed
  "away from Saathban" rendering. It grants NO visibility: a group-only pair
  still has no circle row, so circle/daily-log RLS return nothing (verified at
  the database). Blocked/muted people are excluded with the same
  `caller_hides()` every feed uses; platform-blocked accounts never appear.
- **Moments:** the person's community posts (0014/0018 read policies are the
  law) + last-7-days badge celebrations from the together lane's
  `person_warmth()` (connection-gated server-side; unordered celebration facts,
  never counts/comparisons).
- **Presence:** each hint rides an existing rule unchanged — a check-in only if
  0016's policy already shows it to me; "in a game" only via `can_view_game`
  (shared session); "solved today's riddle" only through `person_warmth`'s veil
  (NULL until I've solved today's myself → chip hidden). Nothing widens.
- **Requests:** `friend_requests` + `respond_friend_request` (0027). Declines
  are silent to the requester (outgoing shows pending and declined identically
  as "waiting"). Accept-after-block fails safely server-side; the UI reloads
  truth on error.

## Actions (absent, never disabled)

Message → `/app/people/<id>/chat` (canonical) · Invite to a game →
people-first: `createSession(game, 2)` + `inviteToGame(session, person)` →
lobby · Cheer/Nudge → `riddle_touch` (together 0029b; `{sent:false}` = the
daily cap → "once is plenty", no red) · Invite to a group → picker of my
groups → `invite_to_group` (0026) · Circle settings → `/app/circle` (circle
members only). Away accounts get no action row.

## Cross-lane edits made (task-authorized, one-liners)

- `home/IconHub.jsx` + `fam/FamDashboard.jsx`: a `hub.people` AreaCard → here.
- `fam/FamDashboard.jsx`: person names link to `/app/people/<id>`.
- `community/CommunityRoutes.jsx`: `connect` → redirect to
  `/app/people/requests` (no orphaned route; ConnectPage.jsx left in place,
  unrouted — its removal is the community lane's call).
- `peopleStore.js` was NOT touched (the integration session held it this
  round); all new helpers live in `myPeopleStore.js` — merge later.

## Coordination record

- Migration number 0031 via the registrar; 0029/0029b are the together lane's.
- Riddle predicate + nudge cap: the together lane's `person_warmth` /
  `riddle_touch` via `lib/games.js` wrappers — exact contract confirmed by
  session 8f; no second predicate exists.
- Canonical DM surface `/app/people/<id>/chat` — recorded in MIGRATIONS.md.
