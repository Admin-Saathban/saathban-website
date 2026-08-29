# Games platform contract (rails: `0022_games` + `0022b_games_repeat_turns`, applied live 2026-08-29)

The rails are live. This is the contract every game lane builds
against. Numbering per MIGRATIONS.md: 0020 = ludo (applied first,
stands), 0021 = event proposals, 0022 = these rails. **Follow-up game
migrations (ludo rebase, carrom) reserve their numbers through the
integration session — 0023 is next free and there are TWO candidates
for it, so ask, don't guess.**

## Tables (live shape after 0022)

| Table | Contract fields | Notes |
|---|---|---|
| `games` | `key, name_en/ur, tagline_en/ur, kind ('turns'/'daily'), min_seats, max_seats, timeout_style ('bot_plays'/'pass_turn'), enabled` | The registry. Insert your row in your migration. `ludo` is registered but `enabled=false` — flip it in the ludo follow-up. |
| `game_sessions` | `game_key` (FK games), `status 'lobby'/'active'/'finished'`, `seats_total`, `house_rules jsonb`, `state jsonb`, `join_code`, `current_seat` (**1-based**), `turn_started_at`, `winner_seat`, `started_at`, `finished_at`, `created_by`, `rematch_id` | Renamed from the 0020 shape: `game`→`game_key`, `target_seats`→`seats_total`, `'playing'`→`'active'`, `turn_deadline`→`turn_started_at` (deadline = `turn_started_at + house_rules.turn_seconds`, default 60). `state` is **yours per game** — the rails never touch it. |
| `game_seats` | `seat_no` (**1..4**, was 0..3 — existing rows shifted +1), `profile_id` (null = bot), `is_bot`, `presence 'active'/'away'`, `missed_turns`, `score` | `current_seat` was shifted +1 too. Ludo's internal 0-based math maps as `seat_no - 1`. |
| `game_moves` | append-only `{session_id, seat_no, by_bot, move jsonb}` | Written ONLY by the engine (no insert policies, definer fns only). |
| `game_invites` | invite → notification with deep link; **accepting the last seat auto-starts the session** and notifies every player | |
| `game_messages` | chat; `body` now nullable + `sticker` (fixed emoji set); body-or-sticker check | Ludo lane's table, extended. There is no separate `game_chat`. |
| `daily_puzzles` / `daily_puzzle_answers` / `puzzle_attempts` | Daily Riddle | `daily_puzzle_answers` is unreadable by clients, by design. |

## The engine — how a game plugs in

Ship ONE function in your migration, named `game_exec_<key>`:

```sql
create function public.game_exec_mygame(
  p_session uuid, p_seat smallint, p_by_bot boolean, p_payload jsonb
) returns jsonb  -- MUST return {"move": <jsonb to record>, "winner": <bool>}
                 -- MAY add {"again": true} — the seat keeps the turn
                 -- (extra roll on six, pocket-and-continue); rails
                 -- reset the clock and skip rotation (0022b)
```

**Executors never advance the turn or touch `current_seat` /
`turn_started_at`** — the rails rotate (or hold, on `again`) after the
executor returns. Double-advancing is the one bug the contract exists
to prevent.

**Two-phase turns** (roll → see dice → choose piece) are fine: a
game-owned RPC may write intermediate data into `state` WITHOUT
advancing anything (it must verify the session is active and the
caller holds `current_seat`, and must NOT write `game_moves`); the
choice then arrives as a normal `play_turn(session, payload)`. One
turn = one clock — the phases share the seat's `turn_seconds`. If no
legal move exists, the game RPC submits `play_turn(session,
{"pass": true})` so the pass is recorded and the turn rotates.

`exec_game_move()` dispatches to it dynamically (`'game_exec_' ||
game_key`) — **nobody edits anyone else's CASE/dispatch, ever.** Your
executor owns `game_sessions.state` and `game_seats.score`; the rails
own turn order, turn timing, presence, move recording, win/finish
bookkeeping, and all notifications. When `p_by_bot` is true, play the
best available move for that seat (that's the away/timeout bot).

- **Server-generated moves** (race100 dice, ludo): ignore `p_payload`.
- **Client-payload moves** (carrom shot outcomes): read `p_payload`,
  validate it server-side, reject garbage with `raise exception`.
  Clients reach it via `play_turn(p_session, p_payload)`.
- **Generic pass**: a payload of `{"pass": true}` never reaches your
  executor — the rails record it and advance the turn. This is the
  timeout behaviour for `timeout_style = 'pass_turn'` games: the sweep
  passes the lapsed seat instead of bot-playing it. `bot_plays` games
  get `game_exec_<key>(…, p_by_bot => true, null)` instead.

Turn timing invariants the rails enforce (don't re-implement them):
60s default turn timer (`house_rules.turn_seconds` overrides — tests
use 2), lapsed turns played/passed by `game_tick()` (pg_cron each
minute + callable by any authenticated client for instant countdown
resolution), 3 consecutive misses → `presence='away'` and the bot
continues, `reclaim_seat()`/any played turn restores the person.
**A seat is never forfeited and never removed.**

## RPCs (all `security definer`, granted to `authenticated`)

`create_game_session(game, seats, house_rules)` → uuid (creator takes
seat 1, join_code generated) · `invite_to_game(session, profile)` ·
`respond_game_invite(invite, accept)` · `claim_open_seat(session)`
(for community open tables; idempotent) · `start_with_bots(session)`
(host fills empty seats with bots) · `play_turn(session, payload?)` ·
`game_tick(session?)` · `reclaim_seat(session)` ·
`guess_daily_puzzle(date, guess)`.

Internal (not client-callable): `exec_game_move`, `game_start_if_full`,
`game_notify`, `game_exec_*`.

## Notifications

`notifications.link` (new, nullable) carries a deep link
(`/app/games/s/<id>`). Emitted on: invite, table-ready (all players),
your-turn (next human, active presence only), game-over (all players).
Bell lane: render `link` as the row's tap-through when present
(GAMES_WIRING.md has the one-liner).

## Community

`community_posts.post_type` now also allows `'game_open'` (an open
table others tap to claim — payload `{game_key, seats_total,
seats_taken}`, ref_id = session id) and `'puzzle_result'` (payload
`{puzzle_date, guesses}` — never the answer). Cards render in the
community lane's feed.

## The together layer (0029/0029b/0029c/0029d)

- **Connections, one definition**: `connections_of(p)` (internal) =
  circle ∪ accepted friends ∪ fellow group members, deduped
  (circle > friend > group label), eligibility- and block-filtered.
  `game_connected()` widened to match; `game_people()` exposes the
  caller's own list for pickers — never show-then-fail.
- **Invites v2**: `invite_to_game` is idempotent (same invite back,
  one notification ever). `respond_game_invite` returns jsonb
  `{result: 'joined'|'filled'|'declined', session_id, …}` — 'filled'
  is graceful and carries game_key/seats_total for a start-again;
  declines quietly notify the host (block-checked, transition-only).
  `claim_open_seat` consumes the caller's own pending invite (0029c).
- **`join_by_code(p_code)`** → `{result: 'joined'|'filled'|'no_table'}`,
  rate-limited 12/5min server-side; wrong ≡ expired ≡ finished.
- **Riddle together**: `riddle_people(p_date)` (count-only before the
  caller solves; named solved/not-solved after — never answers or
  guess counts), `riddle_touch(p_to, p_date, 'cheer'|'nudge',
  p_sticker?)` → `{sent}` with a one-per-person-per-day cap ({sent:
  false}, not an error). `person_warmth(p_profile)` → celebration
  facts for a connection ({solved_today: bool|NULL-until-caller-
  solves, badges this week}) — deliberately nothing comparable.
- **`boast_to_people(kind, ref, payload)`**: share your OWN
  badge/riddle/win to connections, deduped by the `boasts` table so
  retries never re-notify. HARD LINES for every consumer: no ordered
  lists by points, no side-by-side counts, no "ahead of you".
- 0029d: `dm_messages.game_session_id` now ON DELETE CASCADE.

## Per-lane status

- **Ludo (0020, live)**: your data survived 0022 (seats/current_seat
  shifted to 1-based, status `'active'`). Your `ludo_*` functions
  still reference the old column names and will error until your
  follow-up migration rewrites them against this contract and wraps
  the engine as `game_exec_ludo` (your ludo_legal/ludo_apply/
  ludo_bot_pick factoring plugs in cleanly). Then flip
  `games.enabled` for `'ludo'`. Routes: `routes/games/` shell is the
  rails lane's; `routes/games/ludo/` is yours — agreed.
- **Carrom**: answer to your (i)/(ii): **(ii), centralised** — ship
  `game_exec_carrom` (payload-validating) + your `games` row with
  `timeout_style='pass_turn'`; the rails already pass lapsed turns
  instead of bot-playing, so your "missed turn = pass, no bot shot"
  rule is a registry flag, not custom timeout code.
