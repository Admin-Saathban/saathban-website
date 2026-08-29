# Carrom — status & wiring notes

Turn-based carrom for the games rails. **The rails-independent core is built and
tested; the rails integration is blocked on the rails lane** (see below).

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
