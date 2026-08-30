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

## Rules of record

The rules each game actually plays by, in words, so they cannot be
silently re-decided. Where the implementation differs from what a
comment or a name implies, this says so rather than tidying it away —
a contract that describes intentions is how ludo came to declare a bot
player it did not have.

### Carrom — the rules as implemented

Asserted by `tests/carrom-rules.mjs`. Change a rule here and there in
the same commit.

**Sides.** Seat 1 plays white, seat 2 plays black; `q` is the queen.

**The turn.** Pocket at least one of your own coins with no foul and
you shoot again; anything else passes the turn. The server decides
this independently of the client: `again = scored > 0 AND NOT foul AND
NOT winner` — a winning shot ends the game rather than granting
another.

**Fouls — there are exactly two, both simplified:**
- the striker goes down a pocket;
- you pocket an opponent's coin.

Pocketing nothing is not a foul. Failing to cover the queen is not a
foul either.

**An opponent's coin stays down.** No return, no restitution; the
board simply keeps it.

**The striker-foul penalty, exactly.** One of the mover's own pocketed
coins comes back to the centre band at (0.5, 0.42). Which coin:

1. a coin pocketed on an **earlier** shot, if the mover has one;
2. otherwise the coin sunk on **this** shot — and then it is **not
   scored**, so the foul pays its own penalty;
3. if the mover has no pocketed coins at all, no penalty is owed and
   the board is unchanged for their colour.

The preference in (1) is load-bearing, not taste. `game_exec_carrom`
refuses any coin claimed as scored that is not pocketed in the end
state it is handed, so returning the very coin being claimed makes a
**legal shot fail outright** — the player taps, and nothing happens.

**The queen, covered (simplified).** Pocket the queen and one of your
own coins in the **same shot** and she is covered: she stays down and
`queenCovered` becomes true. Otherwise she returns to the centre
(0.5, 0.5) and is fair game again for either player.

One exception, and it exists to prevent a deadlock: **a mover with no
coins left on the board covers her by pocketing her at all.** Covering
normally costs a coin, and a player who has none could otherwise never
satisfy the condition — they could only ever win if their opponent
happened to cover her for them. Nothing errors in that state, which is
what makes it the worst kind of stuck.

`queenCovered` is a property of the **board**, not of a player:
whoever covers her, the condition is satisfied for both.

**Winning.** All of the mover's coins pocketed **and** the queen
covered. Evaluated server-side on every shot, from the end state:
`winner = (my coins left = 0) AND queenCovered`.

**Last coin while the queen is uncovered.** Not a win, and not an
error: the game continues, and that player may still cover her on a
later shot under the no-coins clause above.

**A foul does not stop a win.** `winner` is `myLeft = 0 AND
queenCovered` and consults the foul flag nowhere — in resolveShot or
in `game_exec_carrom`, which derive it identically. So pocketing your
last coin *and* an opponent's coin on the same shot fouls **and** wins.
That is deliberate as it stands: the opponent-coin foul's only
consequence is that the turn passes, and a finished game has no turn
left to pass.

It does create an asymmetry worth knowing before you rely on it. The
**other** foul can cost you the same win: a striker in the pocket
returns one of your coins to the board, which puts `myLeft` back to 1
and the win evaporates. So on the winning shot, sinking the striker
loses it and sinking an opponent's coin does not. Asserted by case 12.

**The queen can stay covered by a coin that came straight back.** The
cover is decided before the striker penalty is paid. Sink the queen,
your only pocketed coin, and the striker on one shot and all three
happen: she is covered, the coin returns to the centre band, and the
coin is **not** scored. The cover survives the coin that bought it, and
it survives permanently, because `queenCovered` is a property of the
board.

Reachable only when the mover has no *earlier* pocketed coin — with one
to spare the penalty prefers the older coin and the covering coin stays
down, which is why it went unnoticed. Asserted by case 13. **This one
is recorded as an open question rather than an intention**: nobody
decided that a foul should buy a permanent cover for free, and if it is
ever changed, the fix belongs in the ordering inside `resolveShot` —
pay the penalty first, then decide the cover.

**Timeouts.** Carrom is `timeout_style = 'pass_turn'`. A lapsed turn
is a **missed** turn: the miss is counted against that seat, the turn
advances, the board is untouched, and no shot is played on the absent
player's behalf. Carrom has **no bot player at all** — since 0043
`start_with_bots` refuses to seat one here, because a bot seat made
the table unfinishable.

A precise note about what IS recorded, because the obvious reading is
wrong: a lapsed turn does write a `game_moves` row, and that row has
`by_bot = true`. No bot played it. `game_tick` passes `p_by_bot =
true` for the pass, and `exec_game_move` short-circuits on a
`{"pass": true}` payload — the carrom executor is never called and
the state is never touched. So on the rails, **`by_bot` means "not
played by the seated human", not "a bot played"**, and the two are
only distinguishable by the move body: `{"pass": true}` versus a
real `shot`.

That matters beyond carrom. `tests/bot-players.mjs` proves a game has
a working bot by asserting `by_bot > 0` after a tick — which is sound
only because it makes that assertion for `bot_plays` games alone. The
same count on a `pass_turn` game is true with no bot in existence.
Any future check of "did a bot play?" should look at the move body,
not the flag.

**The trust boundary, stated plainly.** The server validates; it does
not re-simulate. It checks that every coin claimed as scored is
pocketed in the end state and belongs to the mover, and it derives the
score, `again` and `winner` itself. But `foul` and `queenCovered`
arrive from the client and are taken at their word, and the end state
is stored as given. A modified client could therefore under-report a
foul or declare the queen covered. That is a known limitation of the
0024 design, recorded here rather than implied: it is acceptable for a
friendly two-player game between people who chose each other, and it
is not acceptable if carrom ever becomes competitive or public.

### Every game — a table nobody is playing is closed (0044b)

This one is the rails', not any single game's, and it has teeth against
test fixtures as well as abandoned tables, so it belongs where every
lane will see it.

**The rule.** In a game with **no bot player** (`timeout_style =
'pass_turn'`, which today means carrom), `game_tick` calls a table off
once its move log ends in `max(8, seats × 4)` consecutive passes. It
also stops after one full circuit of passes within a single call rather
than spinning to its guard.

**Why it exists.** Without it, a table where every seat is a bot or an
absent human is an unbounded write loop: the tick plays every such seat
and only exits on reaching a seat that is neither, so it wrote 50 passes
per table per call, every cron minute, for ever. Measured at 350 rows a
minute, flat, across seven tables. It needs no defect to reach — two
people start a carrom game, both wander off, both are marked `away`
after three missed turns, and it begins.

**It only applies to `pass_turn` games, and that restriction is
load-bearing.** In ludo a pass is a normal part of play — every piece in
the yard and no six is a pass — and eight in a row runs about 23% in the
opening. A general "consecutive passes means abandoned" rule would have
quietly cancelled real ludo games with people sitting at them. In a
pass_turn game a pass means nobody acted; in a bot_plays game it can
mean the dice did not cooperate. Same word, different fact.

**It reads the move body, never `by_bot`.** For a `{"pass": true}`
payload `exec_game_move` short-circuits before the executor, so
`by_bot` on those rows means "not played by the seated human", not "a
bot played". The flag cannot tell a game being played from one being
abandoned.

**What this means if you write tests.** A `pass_turn` fixture left idle
across cron minutes can be cancelled by the tick with nothing in your
code doing it — a session going `cancelled` on its own reads like a
product bug and is not one. Assert on `status` at the step that matters
rather than assuming a table you created is still live later.

### Snakes & Ladders — the rules as implemented

Asserted by `tests/snakes-rules.mjs`, one test per rule, against the
live engine playing real games to completion. Change a rule here and
change it there in the same commit. (The board MAP — which squares
carry which jump — is a separate contract, checked by
`tests/snakes-board.mjs`. A correct map played by a wrong engine is
still a wrong game, which is why these are two files.)

**The finish is EXACT, and an overshoot STAYS PUT.** This is the one
rule, chosen over the alternative: a roll that would carry you past 100
is **not played at all**. You do not move, and you do **not** bounce
back off 100. The move is recorded with `stuck: true` and `need`, the
exact number still wanted, which the board says in words — "needs
exactly 3 to finish".

Bouncing is the more common house rule and it was rejected here. This
game is for people who may be playing it with a grandchild on a phone,
and going *backwards* at the very end, after finally getting close, is
a small cruelty that the rule buys nothing for. Standing still is
legible: you can see what you need and you try again next turn. Nobody
can be permanently stuck, either — from any square up to 99 there is
always exactly one roll that finishes.

**A jump resolves in ONE hop.** Land on a ladder foot or a snake head
and you move once. `snakes_board_jump` is applied a single time, and
the board is built so that no jump's destination is itself a jump
square — so one hop is the whole answer and nothing is being silently
truncated. Both halves are asserted: the engine applies one hop, and
the map contains no chain for it to truncate.

**Squares 1 and 100 carry no jump.** You cannot be thrown off the first
square, and the last square is reached only by landing on it — no
ladder may carry a piece to 100 (that would bypass the exact finish)
and no snake may throw one off it (that would make the game
unwinnable). Both were real violations once, fixed in 0036.

**A six earns NO extra roll.** Deliberate, and different from ludo,
which does grant one. `game_exec_snakes` returns no `again` key at
all, so the rails rotate the turn after every roll whatever it showed.
Asserted structurally as well as by shape: no seat ever moves twice in
a row.

The reason it differs from ludo: in ludo a six is the only way out of
the yard, so it carries a cost that the extra roll compensates. Here a
six is simply the best roll, and repeating it would hand a runaway lead
to whoever gets lucky — in a game that already has no skill in it at
all. Turns stay even and the game stays short.

**First to 100 ENDS the game. There are no placements.** The table
finishes the moment someone lands exactly on 100; nobody plays on for
second place. The winning move is the last move in the log, and every
other seat is left wherever it stood.

This is the deliberate choice, not an omission. Playing on for
placements asks the person who has already lost to keep rolling for a
ranking, and this app does not rank people — no leaderboards, ever
(SPEC.md). The person who finishes second in a two-player game of
chance has not been told anything worth knowing.

**A person and a bot play the identical game.** `game_exec_snakes`
takes `p_by_bot` and never reads it: the roll, the board and the exact
finish are the same code either way. Asserted rather than assumed,
because "the parameter is ignored" is exactly the kind of fact that
quietly stops being true.

**There is nothing to choose, so "legality" means one thing.** Snakes
gives a player no decision — the engine rolls and resolves. The only
move that can be illegal is the overshoot, and the engine declines it:
the piece stays, the move is logged, and the turn passes. It does not
move anyway, and it does not stall the table.

**Timeouts.** Snakes is `timeout_style = 'bot_plays'`, and unlike the
state ludo was in until 0042d, it genuinely has a bot player: the
executor rolls internally and reads no `auth.uid()`, so a bot seat
plays exactly as a person does. `tests/bot-players.mjs` holds that to
account.

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
