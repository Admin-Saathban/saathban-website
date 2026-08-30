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
  surface: "#241019",
  /* The lit table. The two repeating layers on top are a weave,
     not a pattern: at 3% white on a dark ground they are barely
     nameable, and they exist so the space a square board cannot
     fill on a tall phone reads as more table rather than as a
     gap. Judged by eye against the reference, which fills the
     same slack the same way. */
  surfaceLift:
    "radial-gradient(circle at 12% 18%, rgba(255,255,255,0.035) 0 1.2px, transparent 1.6px) 0 0/26px 26px, " +
    "radial-gradient(circle at 62% 68%, rgba(255,255,255,0.028) 0 1.2px, transparent 1.6px) 0 0/34px 34px, " +
    "radial-gradient(120% 80% at 50% 22%, #3A1B2B 0%, #241019 62%, #190A11 100%)",

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
  edge: 6,
};
