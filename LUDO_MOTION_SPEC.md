# Ludo Table — Motion & Feel Spec

Derived from the user's Ludo Star reference screenshots. **This ADDS to
everything already built and specced — it overwrites nothing.** Existing
features (jota rules, two dice, ring timer, corner dice, in-cell arrows,
shield stops, quick chat, celebration, sound layer, stickers) all stay.

Our palette, our warmth, their liveliness. No coins, no gems, no ads, no
ranks, no purchases — see LUDO_UI_SPEC.md §9.

---

## 1. Board geometry from the reference

**The board is a bright white grid with saturated corner zones.** Key
differences from ours:

- Track cells are **white with thin black gridlines** — high contrast, easy for
  old eyes. Not tinted, not textured.
- Each colour's **home column** runs in that colour, six cells deep.
- **Zones fill their whole quadrant** in flat saturated colour with a slightly
  darker inset panel holding the four token wells.
- The **frame** is a warm wooden border with rounded corners and a drop shadow.
- **Stops** are a plain grey cell with a dark star — quiet, not gold, not
  goti-shaped. The **start cell** of each colour is that colour with a globe/
  star glyph.
- **Centre**: four coloured triangles meeting. **Put a small Saathban mark at
  the exact centre**, sized so it never competes with a goti resting there.

## 2. Tokens ("gotis")

- **Round discs**, not pawns: a coloured ring with a white inner face and a
  small crown glyph in the middle.
- Diameter ≈ **0.8 of a cell**, with a soft drop shadow below-right.
- A **stack of two (jota)** renders as two discs offset ~4px vertically with a
  visible edge between them, so the stack reads instantly. Three+ discs fan
  the same way with a small count badge.
- **Movable gotis pulse**: a white glow ring, 1.2s ease-in-out loop, only on
  pieces the current player may move.

## 3. Movement — the thing that makes it feel alive

| Event | Motion |
|---|---|
| Single-cell step | **140ms** ease-out, 10px lift with shadow shrinking to 0.7 |
| Multi-cell move | Chain the steps, **140ms each**, no easing between — the eye counts them |
| Entering home column | Same cadence, slight inward tilt |
| Reaching home | Goti scales 1.0 → 1.25 → 1.0 over **400ms**, gold sparkle burst |
| Capture | Victim shakes 200ms, then travels back to its yard along a **600ms curved arc**, spinning once, landing with a bounce |
| Bot move | Identical animation — a watcher must see what happened |

**Nothing may jump instantly from A to B.** A move the player didn't watch is
a move they don't understand.

## 4. Dice

- Sits beside its owner's avatar, as now.
- **Roll**: tumble through 6–8 random faces over **700ms**, decelerating, then
  settle with a small bounce.
- Rolling a six: dice flashes gold, brief sparkle.
- **Bouncing arrow** points at your dice when it's your turn and you haven't
  rolled — 0.8s loop, ~8px travel.
- **Undo** control sits beside the dice (reference shows this) — see §8.

## 5. Player plates

- Avatar circle with a **coloured ring in that seat's colour**.
- **Circular progress ring** sweeps as the turn timer runs (already built).
- Name below or beside, on a small dark pill.
- Current player's plate brightens; others dim to ~0.6.
- A sent phrase or emoji appears as a **white speech bubble beside that
  player's plate**, ~3s, then fades.

## 6. Sound (adds to the existing sound layer)

| Event | Sound |
|---|---|
| Capture — you did it | Short celebratory flourish |
| Capture — you were hit | A soft "ouch" / rueful note |
| Message or emoji arrives | **Very short airy blip, ~50ms** |
| Six rolled | Bright chime under the dice sound |
| Home reached | Warm rising figure |
| Win | The existing dhol celebration |

All respect the existing mute and reduced-motion controls.

## 7. Screen furniture

- Small top bar: menu, spectators, and (ours) the **sound toggle** — icons
  only, no labels, no coin counters.
- Board dominates the middle.
- Bottom: your plate + dice + undo, then **EMOJI** and **CHAT** buttons as two
  plain wide pills.
- **No "Ludo" title on the play screen.** The board says what it is.

## 8. Undo (new, from the reference)

A single-step undo available to the player who just moved, until the next
player rolls. House-rules toggle, default ON. Server-validated: the move is
reversed in the log, never silently rewritten.

## 9. Ceremony (adds to existing)

- **Countdown to start**: "Your first game starts in 3… 2… 1…" over a dimmed
  board, with a ribbon banner.
- **Leaving**: warm confirm (already built) — never mentions a fee; we have none.
- **Player left mid-game**: their plate shows a "LEFT" badge and the bot takes
  over, with one line to the table.

## 10. Chat & emoji panels

- Two tabs: **preset phrases** (grid of ~18 warm desi lines, both languages)
  and **stickers/emoji**.
- Reference includes a per-player mute — adopt it: **mute one player's chat and
  stickers for this table**, plus report, both already in our moderation rails.
- A visible line at the top: harassment gets you removed. Keep it warm but
  present.

## 11. Spectators (adds to LANE C's spectate work)

- A count in the top bar; tapping opens the spectator list.
- Host can toggle "allow spectators" and **mute all** spectators.
- Share invite from that panel.

---

## What we explicitly do NOT take from the reference

Coins, gems, entry fees, gold rewards, welcome-reward boxes, treasure chests,
purchase prompts, ranked "WIN" trophies, and anything that turns play into
spending. Our rewards are earned stickers, themes and badges — nothing else.
