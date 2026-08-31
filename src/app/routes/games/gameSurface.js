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

   Deep and warm rather than neon: a very dark aubergine that reads as
   lacquer under a light. The board sits on it and casts a shadow onto
   it, which is what makes a board look like an object on a table
   rather than a picture on a page.
   ════════════════════════════════════════════════ */

export const GAME = {
  /* The table itself, and a slightly lifted centre so the surface has
     a light on it rather than being a flat rectangle of dark. */
  /* A WARM LIT TABLE. This was #241019 — so dark it read as
     near-black, and the board floated in it like a slide on a
     light box. The reference sits on a plum table with a light
     over it: still dark enough that the board is the brightest
     thing on the screen, warm enough to be a room. */
  surface: "#432845",
  /* The lit table. The two repeating layers on top are a weave,
     not a pattern: at 3% white on a dark ground they are barely
     nameable, and they exist so the space a square board cannot
     fill on a tall phone reads as more table rather than as a
     gap. Judged by eye against the reference, which fills the
     same slack the same way. */
  surfaceLift:
    "radial-gradient(circle at 12% 18%, rgba(255,255,255,0.05) 0 1.2px, transparent 1.6px) 0 0/26px 26px, " +
    "radial-gradient(circle at 62% 68%, rgba(255,255,255,0.04) 0 1.2px, transparent 1.6px) 0 0/34px 34px, " +
    "radial-gradient(120% 80% at 50% 20%, #5E3A5C 0%, #472B49 58%, #34203A 100%)",

  /* Text on that surface. Warm rather than pure white — pure white on
     a dark ground glares, and these are old eyes. */
  ink: "#F6EBE2",
  inkMuted: "#C8AEB8",

  /* Chrome that has to sit on the table without becoming furniture. */
  control: "rgba(255,255,255,0.10)",
  controlEdge: "rgba(255,255,255,0.18)",

  /* The shadow the board casts onto the table. */
  boardShadow: "0 14px 34px rgba(0,0,0,0.55), 0 2px 6px rgba(0,0,0,0.4)",

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

     Read off the reference's own sheets rather than invented. Its
     emoji panel is a magenta-plum body with a GOLD edge; its
     selected tab is gold; its secondary buttons are muted plum
     pills with light text; and gold is the only bright colour on
     the screen, which is why the eye goes to it. Our tokens
     already wear brass rings and the board already has a timber
     frame, so gold is not a new idea here — it is the one the
     board was already using and the chrome had not caught up to.

     No green anywhere. Green is Saathban. ══════════════════════ */

  /* PRIMARY ACTION — the one thing you are meant to press. Brass,
     lit from the top, with dark ink because gold takes dark text
     and every white-on-gold combination fails contrast. */
  accent: "linear-gradient(180deg, #F7D07A 0%, #E3B052 42%, #C2892C 100%)",
  accentFlat: "#E3B052",
  accentInk: "#3B2408",
  accentEdge: "#8A5F16",
  /* Pressed: the gradient flips and the button sinks a pixel. A
     chunky control with no pressed state reads as a picture of a
     button. */
  accentPressed: "linear-gradient(180deg, #C2892C 0%, #E3B052 100%)",

  /* PANELS — sheets, dialogs, the code box. Magenta-plum, lifted
     off the table rather than punched out of it, with the gold
     edge the reference puts round everything it wants read as a
     panel. */
  panel: "linear-gradient(180deg, #6B3566 0%, #552A53 100%)",
  panelFlat: "#5E2E5A",
  panelEdge: "#C8963F",
  panelShadow: "0 -10px 40px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.06) inset",

  /* SECONDARY — Emoji, Chat, Back, and every row inside a sheet.
     Plum pills that belong to the table, never the app's white. */
  pill: "rgba(255,255,255,0.13)",
  pillEdge: "rgba(255,255,255,0.22)",
  pillPressed: "rgba(0,0,0,0.22)",

  /* How long a panel takes to arrive. Long enough to be seen as
     movement, short enough that a person waiting to play does not
     wait for it. Reduced-motion drops it to nothing. */
  motionMs: 190,
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
