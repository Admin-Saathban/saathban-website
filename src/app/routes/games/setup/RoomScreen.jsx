/* ════════════════════════════════════════════════
   The room the table is set in.

   PINE, not midnight. The board's world is a blue-black table under a
   light; this is the room you are standing in before you sit down at
   it, and the owner has given it its own ground — a deep green that
   the midnight board then arrives out of. Two rooms, and you can feel
   the door between them.

   That is the whole reason for the crossfade at the end of this file.
   A scene change that happens instantly is not a scene change, it is
   a repaint; 250ms is long enough for the eye to register that
   somewhere ended and somewhere else began, and short enough that
   nobody waiting to play is made to wait for it. Reduced motion drops
   it to nothing and the room simply is not there any more, which is
   the correct static version of a transition.

   THE MUSIC DOES NOT BREAK ACROSS IT. Both screens ask for the same
   ambient bed by game key, and startAmbience returns early when the
   bed already playing has that key — so the room's tone carries into
   the match rather than stopping and starting again. Verified by
   counting oscillators across the navigation: four, and the same
   four.

   Full screen: no app header, and the bottom bar hides itself here
   (AppShellBar's isGameWorld). A row of app tabs across the bottom
   was the single loudest reminder that you were still inside
   Saathban rather than at a table.
   ════════════════════════════════════════════════ */

import { GAME, NO_SELECT, SCENE_MOTION_CSS } from "../gameSurface.js";

export const ROOM_MOTION_CSS = `
  /* BORDER-BOX, and it is the whole of a real bug. The room lost the
     reset GamesScreen used to give it, so the table-name input's
     width:100% measured 390 and its padding pushed it to 404 — the
     document scrolled sideways by fourteen pixels and a strip of the
     page showed down the right-hand edge of a full-screen game. The
     same box model, the same fourteen-pixel tell, the third time. */
  .sb-room *, .sb-room *::before, .sb-room *::after { box-sizing: border-box; }

`;

/* The same damask as the table, over a pine ground: the two rooms are
   different colours and the same material. */
export const ROOM_GROUND =
  "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.045) 0 1.3px, transparent 1.7px) 0 0/24px 24px, " +
  "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.045) 0 1.3px, transparent 1.7px) 12px 12px/24px 24px, " +
  "linear-gradient(180deg, #123A30 0%, #0C2A22 52%, #051712 100%)";

export default function RoomScreen({ children }) {
  return (
    <main
      className="sb-room sb-scene-in"
      style={{
        ...NO_SELECT,
        boxSizing: "border-box",
        minHeight: "100dvh",
        width: "100%",
        background: ROOM_GROUND,
        backgroundColor: "#051712",
        color: GAME.ink,
        padding: "22px 16px calc(40px + env(safe-area-inset-bottom))",
      }}
    >
      <style>{ROOM_MOTION_CSS + SCENE_MOTION_CSS}</style>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>{children}</div>
    </main>
  );
}
