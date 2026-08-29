# Carrom — status & wiring notes

Turn-based carrom for the games rails. **The core AND the rails DB integration
are built and verified live.** One cross-lane piece remains: the inline board
embed inside a DM thread (needs the community DM lane's hook). Details below.

## ✅ Rails integration landed (0022 rails + 0024_carrom)

- `0024_carrom.sql` (applied): the `games` registry row (`timeout_style='pass_turn'`)
  + `game_exec_carrom` (validates the submitted outcome, writes state + score,
  returns `{move, winner, again}` — never advances the turn) + `carrom_init`.
- `rails.js`: functional — calls the rails RPCs directly (create / invite /
  respond / play_turn / game_tick / reclaim / carrom_init) with a polling
  `subscribeSession` (drops to Realtime once `lib/games.js` exposes it).
- `CarromRailsController.jsx`: drives `CarromBoard` from a live session — the
  component the DM chat-transform embeds.
- **Full game verified live** (test-icon vs test-fam, via the rails):
  create → invite → accept (auto-start) → init → **foul** (icon, striker
  pocketed → turn passes) → **timed-out miss** (fam's turn lapses → `game_tick`
  passes it, `missed_turns=1`, NO bot shot) → **win** (icon clears the last coin
  with the queen covered → `winner=true` → rails finish). Result: `status
  finished`, `winner_seat 1`, seat scores `1/0`, `missed 0/1`, 3 moves, and the
  rails emitted invitation / table-ready / your-turn / game-over notifications
  to both players. Repeat-turn (`again`) is honoured by `0022b`.

## Remaining: the DM chat-transform embed (cross-lane)

`rails.startCarromInThread(opponentId)` creates the session + invites — the
carrom half is done. Rendering `<CarromRailsController sessionId=…/>` **inline in
a DM thread** with the conversation continuing beneath needs the community DM
lane (`routes/community/`) to allow an embedded game view: a message/attachment
type carrying a `game_session_id` that the thread renders. Filed as ask A4;
`carromCopy.playCarromCta` / `.startedInChat` are the strings. Also: the games
shell (`routes/games/`, rails lane's) registers the route that mounts
`<CarromRailsController/>` at `/app/games/s/<id>` — deep links already point
there (notification `link`).

---

## (original notes)

## What's done (rails-independent, tested)

| File | What | Verified |
|---|---|---|
| `physics.js` | Deterministic simplified physics + outcome/rules (pocketing, fouls, simplified queen: covered/uncovered, win) | 17 headless checks |
| `gameLogic.js` | Pure turn reducer — score-continues, foul-passes, **timeout = MISSED (pass, no bot shot)**, win | full-game flow test (foul → timed-out miss → win) |
| `CarromBoard.jsx` | Top-down canvas board, drag-aim-release striker (slingshot), chunky power meter, large forgiving touch targets, phone-first sizing, warm wooden palette, shot animation from physics frames | compiles; renders |
| `CarromGame.jsx` | Standalone **hotseat** controller (1v1, one device) — big turn banner, per-turn countdown, plain-words result line, play-again. Proves the game plays end to end with no rails. | compiles |
| `carromCopy.js` | Bilingual strings (English + Urdu draft) | — |
| `rails.js` | The single seam to `lib/games.js` + carrom RPCs — documented stubs, named per the rails call each needs | — |

Test the game today: mount `<CarromGame />` anywhere under the app (it needs
`useI18n`, i.e. inside the `LanguageProvider` that already wraps `/app`).

## What's blocked on the rails (and the asks that unblock it)

The rails client `src/app/lib/games.js`, the applied rails migration, and a
carrom migration do not exist yet. Filed in `GAMES_CONTRACT_ASKS.md` + messaged
to the rails lane (session 8f):

- **A1 — client-payload move path.** Carrom computes the shot outcome client-side
  and submits it; the server re-runs `resolveShot` to validate. The rails'
  `play_turn()`/`exec_game_move()` generate moves server-side (race100 dice) and
  take no payload. Resolution pending: a carrom `SECURITY DEFINER` RPC
  (`carrom_submit_move`) on the rails tables, vs. an `exec_game_move` `'carrom'`
  branch that accepts a payload.
- **A2 — timeout is a MISSED turn, no bot shot.** `game_tick()` forces a bot move
  and would hit the CASE-`else` (`Unknown game carrom`). Carrom must be excluded
  from `game_tick()` and self-time via `carrom_pass_timed_out_turn`. `gameLogic.applyTimeout`
  already encodes the client behaviour.
- **A4 — chat-transform.** A "Play carrom" action inside a community DM thread
  that creates the session and renders `<CarromBoard/>` **inline in the thread**,
  the conversation continuing beneath. Needs the community DM lane to allow an
  embedded game view carrying a `game_session_id`. `rails.startCarromInThread` +
  `carromCopy.playCarromCta` are the carrom half.

## The remaining wiring, once the rails land

1. Fill in `rails.js` against `lib/games.js` (create/subscribe/submit/timeout).
2. Add a carrom migration (own number — **0021 is taken by event_proposals**;
   the rails lane is confirming the ordering, likely after their rebase): register
   `'carrom'` in `games`; `carrom_submit_move` (validates via a Postgres port of
   `resolveShot`, or trusts the client outcome in v1 with the raw shot stored for
   audit); `carrom_pass_timed_out_turn`.
3. A `CarromRailsController` mirroring `CarromGame`'s reducer calls with the rails
   calls — the board and banner don't change.
4. The DM "Play carrom" action + inline board embed (with the community lane).
5. **Full-game DB test** between test-icon and test-fam (a foul, a missed-timeout
   turn, a win) — the flow is already proven at the logic level in
   `gameLogic`'s test; the DB/turn-timing version awaits the applied rails.

## Route

Not registered in `AppRoot.jsx`. When the games shell exists it mounts
`<CarromGame/>` (standalone) or the rails controller at `/app/games/carrom` (and
inline in DM threads). Deliberately no AppRoot edit while the games shell is in
flux across sessions.
