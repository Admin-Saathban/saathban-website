# Games contract — asks from the Ludo lane

My brief said "read the contract in src/app/lib/games.js" — that file did
not exist when this lane ran (no games code anywhere in tree or history),
so the whole contract is the first gap. Ludo shipped self-contained on
migration `0020_ludo` with every backend touch isolated in
`routes/games/ludo/ludoRails.js` — that one file is the entire absorption
surface when the rails land. The 0020 collision with the rails lane was
resolved by the integration session in MIGRATIONS.md: **0020 (ludo) is the
live base; the rails rebase over it as 0022** with cheap renames since the
tables were empty. GAMES_CONTRACT.md (rails lane) carries the mapping.

What Ludo needs from the eventual contract, in priority order:

1. **Session lifecycle.** Create(lobby) → join-by-code → start(bot-fill) →
   finished, with `house_rules` jsonb frozen into `state` at start, a
   `rematch_id` linkage (same seats + rules, every client follows), and a
   `game` discriminator. 0020's `game_sessions` already has all of these —
   absorb rather than reinvent; renames are fine (`target_seats` →
   `seats_total`, `'playing'` → `'active'`).
2. **Server-authoritative turns.** Dice/randomness server-side only; a
   per-turn deadline column the client can count down from (0020:
   `turn_deadline`; the rails' `turn_started_at` + `house_rules.turn_seconds`
   is equivalent — pick one, publish it); a `tick()` any participant may
   call to make the server play a stalled seat. If the rails add a cron so
   ticks don't depend on an open client, Ludo wants in.
3. **A move dispatcher.** If `exec_game_move()` is the registry, Ludo's
   engine is already factored for it: `ludo_legal(state, seat, dice)`,
   `ludo_apply(state, seat, piece, dice)`, `ludo_bot_pick(state, seat,
   dice, legal)` are pure functions — the CASE arm is ~30 lines. Keep the
   pure-function shape in the contract so bots and timeout auto-play can
   share one heuristic per game.
4. **Seats.** `(session, seat)` unique, `profile_id null = bot`, one seat
   per person per session. Bots need no rows anywhere else.
5. **Chat.** One `game_messages` (participants-only read, own-insert)
   shared across games; sticker rendering is a client concern (emoji-only
   bodies rendered large — see `people/peopleStore.js` STICKERS).
6. **Client shell.** A `routes/games/` shell owning the games index page
   and shared chrome, with each game as a subfolder route. Ludo's shell
   (`LudoRoutes.jsx`) carries its own header until then and will shed it.
7. **Realtime.** Ludo polls at 2.5s. If the rails standardise on Supabase
   Realtime channels for `game_sessions` updates, expose one subscribe
   helper in lib/games.js and Ludo drops its poller.

Non-asks (deliberately Ludo-local): board geometry, heuristic weights,
house-rule definitions — those are per-game content, not rails.
