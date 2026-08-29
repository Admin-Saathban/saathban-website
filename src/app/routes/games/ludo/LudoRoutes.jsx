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
import LudoHome from "./LudoHome.jsx";
import LudoSession from "./LudoSession.jsx";

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
      <AppHeader />
      <Screen>
        <Routes>
          <Route index element={<LudoHome />} />
          <Route path=":sessionId" element={<LudoSession />} />
          <Route path="*" element={<Navigate to="/app/games/ludo" replace />} />
        </Routes>
      </Screen>
    </>
  );
}
