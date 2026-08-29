# Game flow — setup is one screen, the board is the waiting room

The chess.com pattern: tapping a game opens ONE compact setup screen, and
after Start you land on the board itself, where the waiting happens. There is
no lobby page anywhere in the app.

## The two screens

**`/app/games/new/:gameKey` — `NewGame.jsx`.** Seat chips (only when the game
leaves the choice open: ludo and snakes offer 2/3/4; carrom is always 2), then
three big option rows — **Play your people** (opens the connections list with a
search bar, faces and names; tap to fill seats), **Play bots** (absent for
carrom, which passes turns and has no bot player), **Open to community** — then
one **Start**. Exactly one line of copy on the screen: "Who are you playing?".

**`/app/games/s/:sessionId` — the waiting room inside `SessionPage.jsx`.**
Start lands here immediately. Seat chips show who is in and who is still being
waited on ("Waiting for {name}…"), each chip wearing that seat's colour from
`seatColors.js` so the chip and the board agree about who is who. The join code
hides behind a small **Share code** button (which also carries invite-more and
open-table for the host), **Cancel** sits beside it, and the board renders
underneath. When the last seat fills, the session flips to `active`, the chips
give way, and play begins — the same URL throughout.

## Board-optional by design

The waiting room renders correctly with **no board at all**. Ludo's board lives
on the ludo lane's own screen and `SessionPage` redirects there once a table is
active, so a ludo table in the lobby shows chips, share and Cancel with nothing
where a board would be. Snakes renders its board under the chips. Carrom never
reaches this branch: `CarromRailsController` owns its own lobby (including
inside a DM thread), and `SessionPage` only mounts it once the table is active,
so there is never a second waiting room around it.

Moving ludo's waiting room onto its own screen later is a small change: host
this same chrome there and drop the redirect delay.

## Seams (agreed with the games and board lanes)

- **Inside a board is not ours.** Ludo geometry, safe squares, POV rotation,
  snakes art and the seat palette belong to the board lane. This lane decides
  what a board is *wrapped in* and *when it is shown*, and passes their props
  through untouched: `LudoBoard({state, seatsInPlay, legal, myTurnToMove,
  onPieceTap, mySeat})`, `SnakesBoard({seats, currentSeat, label, mySeat})`,
  `CarromBoard({state, seat, isYourTurn, onShoot, mySeat0})` — `mySeat`/
  `mySeat0` is the viewer, null for a spectator.
- **The palette has one source**: `seatColors.js` (`SEAT_COLORS`, `SEAT_INK`).
  Seat chips consume it; they must never hard-code a colour.
- **Route registration** goes through the games lane.

## Known gap

**Cancel leaves the table rather than calling it off**, because there is no
cancelled state to move to: `game_sessions`' CHECK allows only
lobby/active/finished, and deleting a row cascades into seats, invites, moves
and `dm_messages.game_session_id` — which would silently remove a message from
someone's DM thread when a carrom table started there is cancelled. A real
cancel is tracked by the games lane as its own migration. Until then a lobby
table is only reachable by its code or its invite, so leaving it is harmless.

## Verified (phone width, 390×844, both seats, en + ur)

create → setup screen (chips, three rows, one line of copy) → Play your people
→ search + faces → pick → Start → land on the board with "Waiting for {name}…"
→ share reveals the code → second account accepts → the chips give way and play
begins. Urdu renders RTL throughout with the Nastaliq heading clear of the line
beneath it. No page errors in either context.
