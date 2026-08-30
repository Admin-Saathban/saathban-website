# Ludo Table UI — Reference Spec

Distilled from the user's reference screenshots (Ludo King-style mobile play).
Attach those screenshots alongside this file. Where this spec and the
screenshots disagree, the screenshots win.

**A GAME DOES NOT SHARE THE APP'S PALETTE AT ALL.**

> **AMENDED 30 Aug 2026 by `GAMES_IMMERSION_SPEC.md` §1.1 and §2.** This line
> used to read: *"Our palette stays warmer than the reference (Saathban
> cream/green chrome), but the board itself is classic vivid ludo."*
>
> The second half was right and stays. The first half is struck, and it did
> real damage: "Saathban cream/green chrome" was read as an instruction to
> keep the app's chrome around the board, which is exactly the thing the owner
> objects to — *"you are inside Saathban and the game is just there."*
>
> A game screen has **its own dark table surface** — deep, warm, in the region
> of a very dark maroon or aubergine, reading as felt or lacquer rather than
> as a page. No cream, no app header, no bottom bar. See
> `GAMES_IMMERSION_SPEC.md` §2, which is authoritative over this file for
> anything about the frame around the board.

The board itself remains **classic vivid ludo** — that is the game's identity,
and it was never the problem.

---

## 1. Layout — vertical phone, board centred

Top to bottom:

1. **Opponent strip** — the other players' avatar circles, top-right,
   with their dice beside them.
2. **The board** — square, edge to edge, dominating the screen. Wooden or
   warm frame around it.
3. **You** — your avatar bottom-left with your name, your dice beside it,
   then the action row.
4. **Action row** — emoji button, chat button, (later: voice note).

No page chrome fighting the board. The board is the screen.

---

## 2. Turn indicator — the ring, not a timer bar

**Replace the separate countdown bar entirely.**

Each player's avatar circle is wrapped in a **circular progress ring** that
sweeps clockwise as their turn time runs down. When it completes, the turn
passes. This is how the reference does it and it is better than a bar:

- the countdown lives *on the person*, so you always know whose turn it is
- it costs no vertical space
- it reads at a glance for someone who can't parse a number

The active player's avatar is also brightened/enlarged; inactive players dim.

---

## 3. Dice — beside each player, not in the centre

Each player's die sits **next to their own avatar**. Not in the board's middle.

- Your die is bright and tappable on your turn; a **bouncing arrow** points at
  it so there is never a question of what to do next.
- Opponents' dice are visible but dim.
- The die tumbles when rolled and settles on its face.
- In two-dice mode both dice sit together beside the avatar.

---

## 4. "What do I do now?" cues — never leave a senior guessing

The reference is relentless about this and we should be too:

- **Bouncing arrow at the die** when it's your turn and you haven't rolled.
- **After rolling**, movable tokens pulse/glow; tap one to move.
- **Only one legal move?** Consider auto-highlighting it strongly.
- **Arrows printed on the track** showing direction of travel out of each
  home and into each home column (see reference boards — small grey arrows
  in the track cells).
- A **lock/shield glyph** on safe squares in addition to the star.

---

## 5. Board art

- Four saturated classic zones: green, yellow, red, blue.
- White track cells with thin grey gridlines; direction arrows in the cells.
- Big coloured centre triangle (the finish) with the four arrows converging.
- Home-column cells in the zone colour.
- Safe cells: star + subtle shield.
- Each yard is a large white rounded square holding 4 tokens in a 2×2.

## 6. Tokens

- Glossy round tokens with a highlight and a drop shadow — they should look
  like pieces you could pick up.
- A **jota (stacked pair)** must be unmistakable: two tokens visibly stacked,
  a ring or badge, slightly taller. This is the one place our board must be
  BETTER than the reference, whose pin-shaped tokens make stacks unreadable.

---

## 7. Emoji & quick chat — two taps, always reachable

- **Emoji button** opens a grid of large animated-feel emoji faces; tapping
  one sends it instantly.
- **Chat button** opens a panel of **preset phrases** — in our case warm desi
  register, both languages:
  "Wah!", "Shabash", "Achha khela", "Naa-insafi!", "Kya chaal thi!",
  "Meri baari", "Oho!", "Phir milenge", "Jeetay raho", "Chalo phir".
- A sent emoji or phrase appears as a **speech bubble beside the sender's
  avatar** for a few seconds, then fades. (Reference: the crying-face bubble
  and the "bhai kitnay ki game ha" bubble.)
- The panel is a sheet over the board, dismissable by tapping outside.
- No typing required for any of it.

---

## 8. Celebration screen

When the game ends (reference: "Well Played"):

- A warm full-screen moment, not a modal on the board.
- **Winner's avatar with a crown**, enlarged and centred.
- Other players below, in order, smaller.
- Points/badge earned shown warmly (no coins/gambling framing — ours is
  badges and presence, never currency).
- Two buttons: **Share** (to community/people) and **Back to games**.
- Plus a **rematch** action with the same seats.
- Sound + confetti for the winner only (already built — reuse it).

---

## 9. What we deliberately do NOT copy

- No coins, gems, purchases, or any gambling-adjacent framing.
- No ads, no "watch video for reward".
- No global leaderboards or rank badges.
- No aggressive push/red-badge growth mechanics.

The reference's *interaction design* is the model. Its economy is not.

---

## 10. Accessibility (ours, non-negotiable)

- Every cue carried by shape or position as well as colour.
- Tap targets ≥48px; text ≥18px.
- Reduced-motion: rings still show progress, arrows stop bouncing,
  confetti suppressed.
- Both languages, RTL-correct.
- Sound optional and off-switchable (already built).
