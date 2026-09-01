/* ════════════════════════════════════════════════
   Snakes & Ladders route table — /app/games/snakes/:sessionId.

   THE GAME OWNS THE SCREEN. This board used to render inside the
   generic session page: an app header above it, a bottom bar below
   it, the board a picture in the middle of a document. The owner's
   note was that it had no atmosphere, and a large part of "no
   atmosphere" was simply that it was still inside Saathban.

   So this is the same PlayScreen ludo uses — one viewport exactly,
   100dvh (dvh and not vh, so a phone's collapsing URL bar cannot
   leave a strip of board under the fold), no page scroll, no app
   chrome at all. The way back out lives inside the screen, where it
   cannot overlap anything.

   Everything inside sizes itself to the height it is given: the board
   shrinks on a small phone, the rows do not. A smaller board is still
   a board; a board with its bottom off-screen is not.
   ════════════════════════════════════════════════ */

import { Navigate, Route, Routes } from "react-router-dom";
import { SCENE_MOTION_CSS } from "../gameSurface.js";
import { tableStyle } from "./SnakesBoard.jsx";
import SnakesSession from "./SnakesSession.jsx";

function PlayScreen({ children }) {
  return (
    <main
      className="sb-scene-in"
      style={{
        boxSizing: "border-box",
        height: "100dvh",
        minHeight: "100vh",
        maxHeight: "100dvh",
        width: "100%",
        overflow: "hidden",
        color: "#F2ECDF",
        display: "flex",
        flexDirection: "column",
        ...tableStyle,
      }}
    >
      <style>{SCENE_MOTION_CSS}</style>
      {children}
    </main>
  );
}

export default function SnakesRoutes() {
  return (
    <Routes>
      <Route
        path=":sessionId"
        element={
          <PlayScreen>
            <SnakesSession />
          </PlayScreen>
        }
      />
      <Route path="*" element={<Navigate to="/app/games" replace />} />
    </Routes>
  );
}
