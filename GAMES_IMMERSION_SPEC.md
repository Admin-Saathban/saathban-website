# GAMES_IMMERSION_SPEC.md

Written 30 August 2026, after reading the four lane reports of 29 August, the
deployed screenshots, `LUDO_UI_SPEC.md`, `LUDO_MOTION_SPEC.md`,
`GAMES_BACKLOG.md` and `TONIGHT.md`.

**This is not a seventh slice of Ludo work.** Six game prompts have already
run: stops and colours, tactile setup, living table, join-by-link, visual
richness, sound. A seventh feature pass will not fix this. Read §1 before
building anything.

---

## 1. Why it still feels dull — three causes, none of them "missing features"

### 1.1 Two spec files contradict each other, and the lanes followed the wrong one

`LUDO_MOTION_SPEC.md` §1 says of the track cells:

> white with thin black gridlines — high contrast, easy for old eyes.
> **Not tinted, not textured.**

`GAMES_BACKLOG.md` B2 says of the same board:

> Board may leave the Saathban palette: rich saturated zones with **gradients,
> bevelled track cells, dimensional frame and centre. Alive and glossy.**

`TONIGHT.md` pointed LANE 1 at the motion spec. **LANE 1 built a flat white
board correctly, to spec.** The richness instruction was in a file nobody was
reading that night.

**Resolution: `GAMES_BACKLOG.md` B2 wins. `LUDO_MOTION_SPEC.md` §1's
"not tinted, not textured" is struck.** Contrast for old eyes is achieved by
strong value difference between cell and goti, not by flat white.

Also struck from `LUDO_UI_SPEC.md`: *"Our palette stays warmer than the
reference."* Games no longer share the app's palette at all — see §2.

### 1.2 The game is inside the app, not instead of it

The 10:21 screenshot shows the board with the Saathban header, the bell, a
cream page background, and Emoji / Chat / Table talk stacked underneath like
rows on a settings page.

Every previous game prompt assumed the board lives *in a page*. None ever said
"remove the frame." That is the single biggest cause of the owner's exact
words: *"you are inside Saathban and the game is just there."*

### 1.3 The features are real. They are just unfinished-looking.

LANE 1 verified on the deployed preview: plates at each seat, corner dice,
turn rings, bouncing arrow, in-cell arrows, safe cells, centre mark, movement
measured at 134ms per cell, capture arcs, undo, jota chooser, two dice, sixes
chain, "Well Played". **All present.** Do not rebuild any of it.

---

## 2. The frame — build this first, before any art

**A game takes the entire screen and stops looking like Saathban.**

- **No app header.** No logo, no bell, no back chevron.
- **No bottom bar.** The five tabs do not exist inside a game.
- **No cream.** The game screen has its own dark background — a deep table
  surface, warm rather than neon, in the region of a very dark maroon or
  aubergine. It must read as felt or lacquer, not as a page.
- **Edge to edge.** The board spans the full width, with even margins on both
  sides. **The current board is clipped off the right edge** — left has a
  margin, red and green home zones run off the screen. Fix this first; it
  alone reads as broken.
- **Fixed, non-scrolling viewport.** Already specified in `TONIGHT.md`; hold it.
- **One way out**: a small exit control in a top corner, which asks warmly
  before leaving. Nothing else navigates.
- Entering a game is a **full-screen push** that covers everything, including
  the bars. Leaving reverses it.

Everything in `MOTION_SPEC.md` about drawers, sheets and the shutter **does not
apply inside a game**.

## 3. The app's rules are suspended inside a game

Owner's explicit ruling. Inside a game screen only:

- **The 16px text floor does not apply.** Plates, labels and counters may be
  as small as the layout needs.
- **The 44px tap floor does not apply to board cells.** A 15×15 grid on a
  phone cannot have 44px cells. It **does** still apply to the dice, the
  action buttons and the exit control — the things a person deliberately aims
  at.
- **The flat visual system does not apply.** Gradients, bevels, inner shadows,
  gloss, drop shadows and texture are all wanted here and nowhere else.

**Still non-negotiable inside games:** both languages with real Urdu, RTL
correct; reduced-motion degrading to static rather than broken; no rankings,
no leaderboards, no purchasable currency, no coins, no gems, no entry fees.

## 4. The board's finish

Nothing here changes geometry, rules, safe-cell positions or motion timing.
Those are correct. This is surface only.

- **Zones**: saturated, with a soft dimensional edge and a slightly darker
  inset panel behind the token wells.
- **Track cells**: subtle inner shadow and a gentle bevel so the track reads
  as recessed. Warm off-white rather than pure white. Gridlines soften from
  black to a warm dark grey.
- **Frame**: a warm wooden or lacquered border with rounded corners, and the
  whole board casting a drop shadow onto the dark background behind it.
- **Home columns and centre**: gradient rather than flat fill.
- **Safe cells**: keep the star; give it a slight emboss.
- Achieved with SVG gradients and filters. **No heavy image assets** — this
  runs on old phones on Pakistani mobile data.

## 5. The gotis — the owner's oldest complaint

- **Bigger.** They should span most of their cell and slightly overflow it,
  the way a physical piece sits proud of a square. `LUDO_MOTION_SPEC.md`'s
  0.8-of-a-cell figure is too small; raise it.
- **Remove the printed numbers.** Numbers make the board a diagram. Use the
  crown glyph the motion spec already describes. If pieces must be
  distinguishable, do it by position in the yard, not by printing 1/2/3/4 on
  the face.
- **Gloss**: a radial highlight top-left, a coloured ring, a white inner face,
  and a soft shadow below-right so they read as objects with weight.
- **A jota must be unmistakable at arm's length** — visibly two discs, taller,
  ringed. This is the one place the board must beat the reference, whose
  pin-shaped pieces make stacks unreadable. Already specified; verify it by
  screenshot at phone width, not by reading the component.

## 6. Two dice must render two dice

Owner reports a two-dice table showing one die. LANE 1's report says the
opposite — *"two-dice table shows two dice"*, verified.

**Do not rebuild this. Reproduce it first.** Open a two-dice table on the
deployed preview as two different seats and photograph both. Possibilities
worth checking before touching code: whether both dice render at the active
player's plate but only one at the opponent's; whether the second die renders
only after the first roll; whether the table the owner opened was actually a
one-die table.

Report which it was. If it renders correctly, say so — a wrong bug report
costs less than a wrong fix.

## 7. Sound — deletions, not defaults

- **Delete background music entirely.** `GAMES_BACKLOG.md` A5 specified a
  loopable ambient bed, off by default. The owner's ruling is that it should
  not exist. Remove the feature, its toggle and its assets. A5 is cancelled.
- **Audio must stop when the game screen unmounts.** Sound currently continues
  after leaving a game. This is a lifecycle bug: the audio graph is not tied
  to the component's teardown. Every sound source must be stopped and
  disposed on unmount, on route change, and on tab-hide.
- Effects stay: dice, movement ticks, capture, home, win. All still mutable,
  all still respecting the existing mute control.

## 8. Getting into a game

The `TONIGHT.md`-era chess.com instruction — *"the board is the destination,
setup is minimal, waiting happens on the board, kill the lobby route"* — was
written and dispatched. **The deployed build still shows a setup form** with a
table-name text field, radio pills for one die or two, and colour circles on
a cream page under the app bar.

A lane must first establish **whether that instruction ever landed, or landed
and regressed**, and say which, before rebuilding it a second time.

The target, unchanged:

- Tapping a game goes **straight to a table**, seats filled with bots, dice
  ready. No form.
- Seats, invites, colour, one-die-or-two and the table name are all changed
  **at the table**, by tapping the thing itself.
- Waiting happens on the board, with "waiting for {name}" in the seat.

### 8.1 The setup component is shared and it leaks

The owner reports Carrom asking Ludo's questions. One generic setup screen
serves all three games, so Carrom offers "two dice — the Desi table". Split it,
or give each game its own entry.

### 8.2 The one-game-at-a-time rule produces a wall of text

The Snakes & Ladders screenshot is three stacked outlined boxes explaining a
rule, where a game should be. Either drop the rule, or handle the collision
at the table rather than as a prose interstitial.

## 9. Games home

Currently: a heading, a paragraph, a bordered riddle card, a "Have a code?"
box, a Start a game button, and a "See past games (9)" pill — on cream, with
prose.

It should be **tables and faces**. Live tables first with who is in them,
then the games as large tappable objects, then past games. One line of text
maximum on the whole screen.

## 10. What must not be taken from the reference

Unchanged and non-negotiable: no coins, no gems, no entry fees, no gold
rewards, no treasure chests, no purchase prompts, no ranked trophies, no ads,
no "watch a video for a reward". The reference's *interaction and finish* are
the model. Its economy is not.

## 11. Verification bar

As `TONIGHT.md` set it, and for the same reason: push, open the **deployed
preview**, look at it in a browser, photograph it, put the URL in the report.

Additionally, for this work specifically: **the report must include a
side-by-side screenshot** — the Ludo Star reference and the Saathban board at
the same phone width. This work is judged by eye, so it must be reported by
eye. Every previous game pass was reported in prose and passed.
