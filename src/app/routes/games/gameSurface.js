/* ════════════════════════════════════════════════
   The table a game is played on — GAMES_IMMERSION_SPEC §2.

   A game takes the whole screen and stops looking like Saathban. That
   is the entire point of this file: the app's cream, its header, its
   bottom bar and its text colours do not belong inside a game, and
   the owner's words for the old behaviour were "you are inside
   Saathban and the game is just there."

   So games get their own small palette, kept apart from
   shared/tokens.js on purpose. Nothing outside routes/games may
   import it, and nothing in here may leak outward — a dark surface in
   the rest of the app would be a bug, not a theme.

   MIDNIGHT, not aubergine. The board's zones are the deep rich set
   now — a #B01709 red and a #0E8A2C green — and a warm plum under
   them tinted both toward brown. A blue-black ground is neutral to
   all four and lets the white track be the brightest thing on the
   screen, which is the whole hierarchy.

   The board sits on it and casts a shadow onto it, which is what
   makes a board look like an object on a table rather than a
   picture on a page.
   ════════════════════════════════════════════════ */

export const GAME = {
  /* THE TABLE, as the owner designed it in the live designer: a
     near-black, and EVEN — a straight fall from top to bottom over
     the whole screen rather than a radial bloom.

     The colours were right and the SHAPE was not: a radial centred
     at 50% 4% does most of its falling in the top third, so the band
     above the board sat several steps lighter than the band below it
     and the board looked like it was resting on a seam. Reported
     twice as "bluish above, black below", which is exactly what a
     bloom over the top of a dark screen looks like. A linear fall
     has no centre to be lighter than.

     It began at #17203A and the owner's verdict
     was that the top read BLUE and the bottom black — a bloom rather
     than a room. The top stop is #0C1322 now and the bottom is
     unchanged at #060A14, so the whole table is one dark and the
     light on it is a suggestion rather than a colour. It was plum; the
     board's four colours are now the DEEP RICH set, and a warm
     purple under a red and a green zone was tinting both.

     The dots are a DAMASK, not a grid: the same 24px lattice laid
     down twice with the second offset half a step, which is what
     makes a repeat read as cloth rather than as graph paper. At
     4.5% white they are barely nameable, and they exist so the
     space a square board cannot fill on a tall phone reads as more
     table rather than as a gap. */
  surface: "#060A14",
  surfaceLift:
    "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.045) 0 1.3px, transparent 1.7px) 0 0/24px 24px, " +
    "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.045) 0 1.3px, transparent 1.7px) 12px 12px/24px 24px, " +
    "linear-gradient(180deg, #0C1322 0%, #0A1020 34%, #080D18 68%, #060A14 100%)",
  /* Text on that surface. Warm rather than pure white — pure white on
     a dark ground glares, and these are old eyes. */
  ink: "#F6EBE2",
  inkMuted: "#A8B4CC",

  /* Chrome that has to sit on the table without becoming furniture. */
  control: "rgba(255,255,255,0.10)",
  controlEdge: "rgba(255,255,255,0.18)",

  /* The shadow the board casts onto the table. */
  boardShadow: "0 18px 46px rgba(0,0,0,0.72), 0 6px 14px rgba(0,0,0,0.55)",

  /* THE ONE MARGIN. GAMES_IMMERSION_SPEC §2 asks for edge to edge
     with EVEN margins on both sides, and the bug it is fixing was
     uneven: a margin on the left and the right-hand zones running off
     the screen. Both sides get this and nothing else does. */
  edge: 4,

  /* ══ THE GAME'S OWN CONTROLS ═══════════════════════════════════

     Everything above dressed the TABLE. Everything below dresses
     what sits on it, and until now nothing did: Roll the dice was
     Saathban green, Emoji and Chat were the app's white pills, and
     every sheet was a cream card. A dark board surrounded by the
     app's furniture is not a game, it is the app with the lights
     off.

     TEAL for the one thing you are meant to press, midnight for
     everything that opens over the table, glass for everything
     that sits on one, a muted red for the one thing that
     destroys something.

     GOLD IS OFF THE CHROME ENTIRELY. Rationing it was not
     enough: a brass gradient on a 52px button is a Windows 95
     toolbar, and the owner's word for the settings sheet was
     "cheap". Gradients on controls date a screen faster than
     any other single choice, because for twenty years they were
     how a button said it was a button; a flat fill and a radius
     say it now.

     Two things on the BOARD keep gold, and they are not chrome:
     the crown at the centre and the halo on a goti you may move.
     Gold is the only colour on that board belonging to no seat,
     which is exactly why the halo can mean "this one" without
     also meaning "this player".

     Saathban's green appears exactly once inside a game, on your
     own chat bubbles and the Send beside them, because that is
     the one place the owner asked for it. Nowhere else. ════════ */

  /* PRIMARY ACTION — the one thing you are meant to press.

     FLAT TEAL, and flat is the point. This was a three-stop brass
     gradient with a darker edge, which is the exact treatment the
     owner called cheap; the teal is the colour this app already
     uses for "yes, this one" (it is `you` below, and Save on a
     profile card has worn it all along), so confirming now looks
     the same everywhere in the game.

     DARK INK ON IT, still. Near-white on this teal is about
     2.4:1 and fails at any size; #04231F is above 8:1. The rule
     that forced dark text on brass was never about brass. */
  accent: "#2AB8A0",
  accentFlat: "#2AB8A0",
  accentInk: "#04231F",
  accentEdge: "rgba(0,0,0,0.22)",
  /* Pressed: it darkens and sinks a pixel. A control with no
     pressed state reads as a picture of a button. */
  accentPressed: "#1E9585",

  /* PANELS — the chat, both profile cards, every sheet. The same
     midnight gradient as the table, one shade lighter at the top,
     so a sheet reads as the table folding up rather than as a
     second design arriving over it. The gold edge is gone with
     the rationing above; a hairline of white is enough to say
     where the panel starts, and the chat is specified with no top
     line at all. */
  panel: "linear-gradient(180deg, #17203A 0%, #060A14 100%)",
  panelFlat: "#111A2E",
  panelEdge: "rgba(255,255,255,0.14)",
  panelShadow: "0 -14px 48px rgba(0,0,0,0.62), 0 0 0 1px rgba(255,255,255,0.06) inset",

  /* SECONDARY — the door, the sound button, every row inside a
     sheet. Glass pills that belong to the table, never the app's
     white. */
  pill: "rgba(255,255,255,0.13)",
  pillEdge: "rgba(255,255,255,0.22)",
  pillPressed: "rgba(0,0,0,0.22)",

  /* How long a panel takes to arrive. Long enough to be seen as
     movement, short enough that a person waiting to play does not
     wait for it. Reduced-motion drops it to nothing. */
  motionMs: 190,

  /* THE PERSON COLOUR. Your own circle, Save on your own card,
     and any toggle that is ON. Deliberately none of the four seat
     colours and deliberately not Saathban's green: it means YOU,
     and a colour that also means a seat would say something about
     which seat. */
  you: "#2AB8A0",
  youInk: "#03302A",
  /* Muted, for a toggle that is off. Grey, never a red. */
  off: "rgba(255,255,255,0.22)",
  /* The one destructive row on a profile card. */
  report: "#8F1B2A",
  /* Frosted glass — the chat particle, and every row on a
     profile card. */
  glass: "rgba(255,255,255,0.07)",
  glassStrong: "rgba(255,255,255,0.16)",
  glassEdge: "rgba(255,255,255,0.18)",
  /* GOLD. Only three things wear it: the crown at the centre of
     the board, the halo on a goti you may move, and nothing
     else. The board's frame is timber and has no gold ring. */
  gold: "#F3CE5E",
  goldDeep: "#B98A1E",
  goldEdge: "#9A7420",
};

/* Chrome inside a game is not text to be selected. Long-pressing a
   board on a phone otherwise raises the browser's selection ribbon
   with its Search and Translate buttons over the game — the single
   most app-like thing that can happen inside one.

   Spread onto game chrome. NOT onto the table's join code, which
   is the one string somebody may legitimately want to copy. */
export const NO_SELECT = {
  userSelect: "none",
  WebkitUserSelect: "none",
  WebkitTouchCallout: "none",
};

/* ── THE DOOR BETWEEN THE TWO ROOMS ─────────────────────────────

   The setup room is pine and the table is midnight: two places,
   not two states of one. A scene change that happens instantly is
   not a scene change, it is a repaint — 250ms is long enough for
   the eye to register that somewhere ended and somewhere else
   began, and short enough that nobody waiting to play is made to
   wait for it.

   Defined ONCE, here, because it is worn by two screens that
   import nothing else from each other. Two copies of a duration
   are two durations that eventually disagree, and a room fading
   out over 250ms onto a board fading in over 300 is a stutter
   nobody could name.

   Reduced motion drops it entirely: the correct static version of
   a transition is arriving, which is what happens.

   THE MUSIC DOES NOT BREAK ACROSS IT. Both screens ask for the
   same bed by game key and startAmbience returns early when the
   bed already playing has that key, so the room's tone carries
   into the match rather than stopping and starting again. ────── */
export const SCENE_MOTION_CSS = `
  @keyframes sb-scene-in {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .sb-scene-in { animation: sb-scene-in 250ms cubic-bezier(.2,.8,.3,1) both; }
  @media (prefers-reduced-motion: reduce) {
    .sb-scene-in { animation: none !important; }
  }
`;
