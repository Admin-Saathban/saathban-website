# FLOW.md — the thumb test

One rule, applied to every flow at phone width as a first-time senior
would meet it: **after every action, the next obvious step is ONE
visible tap away** — no hunting, no URL knowledge, no mental model.

Method: seeded real states (a lobby with a pending invite, a live
board on the person's turn, a finished game) and walked each surface
as **test-icon** and **test-fam** at 390px, screenshots read one by
one. Fixes to files this lane owns are applied here; findings on other
lanes' files are filed at the bottom for the registrar.

## Fixed (games / community / riddle / history / outdoor lane)

| # | Flow | Before | After |
|---|---|---|---|
| 1 | Host creates a table, invites Fam | Lobby seat rows read "Waiting…" with no trace of who was asked; the only hint was an "Asked" chip inside the picker further down. | Seat row reads "✉️ Test Fam — asked, waiting for their answer"; the card opens with ONE sentence: "Waiting for 2 more to sit down. The game starts by itself when everyone's in." |
| 2 | Invitee opens the lobby from the bell | Saw the host's "Read this code aloud so others can join YOU" card — the wrong person's instructions — above their own Accept/Decline. | Code card is shown only to people already seated. The invitee's card reads "Test Icon asked you to this table. Tap 'Take my seat' — the game starts when everyone's in." |
| 3 | Someone arrives at an open table from the feed | Same host-oriented code card; no sentence saying what to do. | "There's a seat free. Tap 'Take a seat' — the game starts when everyone's in." |
| 4 | Invitee taps "Not this time" | Stayed on the lobby as a stranger, now facing a stray "Take a seat" button — the very seat they just declined. | Toast "Declined quietly — the host has the seat back", then the app returns them to Games by itself. |
| 5 | Game finishes | "You won!" + Tell your people, then… nothing: the only way on was the back link or the browser. An empty "Table talk" card sat below. | "🔁 Play again with the same people" (a fresh table, same size, this table's people re-invited) sits under the result; the empty chat card no longer renders on a finished table. |
| 6 | Fam taps a bell link to a table they're not at (or any stranger URL) | Bare "That didn't load. Please try again in a moment." — a lie (nothing failed) and a dead end. | "This table is private to its players. If a friend wants you in, ask them to invite you or read you the code." + a Back to games button. Real load failures keep the error text but also gain the button. |
| 7 | Games home, returning player | "My tables" listed every finished game ever (20+ cards reading "Finished") ABOVE "Open a table"; each card said only its status. | Live tables first, each with its next step in one sentence ("It's your move — tap to roll." / "Waiting on another player — tap to watch the board." / "Gathering players — tap to invite someone or start with bots."), then "Open a table", then a 3-card "Recent games" list ("Finished — tap to see the board, or play again."). |

Already passing the thumb test (kept as the standard): riddle solve →
the "your people today" strip is right there with Shabash/invite taps;
activity post → "Shared — neighbours can join you now"; activity join →
"you're on the list" in place; sent connection request → "Request
sent" + pending badge on the row; check-in at a park → "You're checked
in here until about 5:30" + Leave; Fam on /app/history → redirected to
the Fam home (no dead end); a filled table → "Start your own with the
same people"; join-by-code wrong/full → a sentence and the field stays.

## Choice clutter judged and left alone (with reasons)

- Lobby host: picker + "Post an open invitation" + "Start now — bots"
  are three different audiences (my people / the community / nobody),
  not near-duplicates. Kept.
- Riddle solved: "Share with the community" (a feed post) vs "Tell
  your people" (a notification to connections) — different audiences,
  both opt-in per the together-layer rule. Kept, side by side.

## Findings for other lanes (routed by the registrar)

1. **Fam home (fam lane, FamDashboard.jsx):** the bottom card "Ask to
   join the circle of someone already on Saathban… Connect with
   someone" duplicates the "My People" tile above it (My People now
   owns requests). Suggest it becomes My People's zero-connections
   empty state only. — routed; **fixed by the fam lane in ab3452b**
   (no duplicate connect card, Games cue on chips) within the hour.
2. ~~Notifications "Mark all read" missing~~ — **withdrawn**: the
   parity lane confirmed NotificationsPage renders "Mark all as read"
   beside the title whenever unread > 0 (conditional on the fetched
   list, which is why a loading/all-read page shows none). My walk
   caught it mid-load. No action.
3. ~~Fam home "Your move — Carrom" chip lacks a game cue~~ — that chip
   is this lane's own YourTurnChips component (the fam home reuses
   it). It already carries the 🎲 prefix; judged sufficient next to
   the game's name. No change.

## Also closed this round (own lane, found in the walk)

- **Outdoor home:** place cards said only the name; a first-timer had
  no idea a tap led to check-in. Now one bold line under the intro:
  "👉 Tap a place to see who's there and check in yourself."
