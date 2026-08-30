/* ════════════════════════════════════════════════
   Ludo route table — /app/games/ludo (front door) and /:sessionId
   (lobby → board → rematch, one screen per session id). Registered in
   AppRoot for any signed-in role; RLS keeps non-participants out of
   sessions regardless.

   When the games-rails shell lands under routes/games/, this folder
   plugs into it as one game; until then LudoRoutes carries its own
   header + screen (GAMES_CONTRACT_ASKS.md).
   ════════════════════════════════════════════════ */

import { Navigate, Route, Routes } from "react-router-dom";
import AppHeader from "../../../components/AppHeader.jsx";
import { COLORS as C } from "../../../../shared/tokens.js";
import { GAME } from "../gameSurface.js";
import LudoHome from "./LudoHome.jsx";
import LudoSession from "./LudoSession.jsx";

/* THE PLAY SCREEN IS NOT A PAGE.

   A session used to render inside the same scrolling <main> as every
   other screen, under a sticky app header. So the board scrolled, and
   the turn-status line — the one line telling you what to do — slid
   up and was cut in half by the header sitting over it. The user
   photographed exactly that.

   Being inside a game should feel like being inside a game. This is
   one viewport, exactly: 100dvh (dvh, not vh, so a phone's collapsing
   URL bar cannot leave a strip of board under the fold), no page
   scroll, and NO APP HEADER — the header is what the content was
   sliding under, and hiding it also buys back its height for the
   board on a 667px phone. The way back out lives inside the screen
   instead, where it cannot overlap anything.

   Everything inside sizes itself to whatever height it is given: the
   board shrinks, the rows do not. A board that is smaller on a small
   phone is still a board; a board with its bottom off-screen is not. */
function PlayScreen({ children }) {
  return (
    <main
      style={{
        /* GAMES_IMMERSION_SPEC §2: a game takes the whole screen and
           stops looking like Saathban. No cream, no app chrome — its
           own dark table surface, warm rather than neon, reading as
           lacquer under a light rather than as a page. */
        boxSizing: "border-box",
        height: "100dvh",
        minHeight: "100vh",     /* the fallback, for anything without dvh */
        maxHeight: "100dvh",
        width: "100%",
        overflow: "hidden",
        background: GAME.surfaceLift,
        backgroundColor: GAME.surface,
        color: GAME.ink,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {children}
    </main>
  );
}

function Screen({ children }) {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: C.bg,
        color: C.textMain,
        padding: "16px 12px 64px",
      }}
    >
      <div style={{ maxWidth: 640, margin: "0 auto" }}>{children}</div>
    </main>
  );
}

export default function LudoRoutes() {
  return (
    <>
      <Routes>
        {/* A session is a game; everything else here is a page. The
            header is rendered per-branch rather than above the switch,
            because the play screen must not have one at all. */}
        <Route
          path=":sessionId"
          element={
            <PlayScreen>
              <LudoSession />
            </PlayScreen>
          }
        />
        <Route
          index
          element={
            <>
              <AppHeader />
              <Screen>
                <LudoHome />
              </Screen>
            </>
          }
        />
        <Route path="*" element={<Navigate to="/app/games/ludo" replace />} />
      </Routes>
    </>
  );
}
