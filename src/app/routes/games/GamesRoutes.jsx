/* ═════════════════════════════════════════════════
   Games route table — the single entry point for this folder
   (migrations 0022/0022b; GAMES_CONTRACT.md is the rails contract).
   Registered in AppRoot behind RequireAuth. games/ludo/* is the ludo
   lane's and is registered separately in AppRoot — it wins over this
   shell by specificity.
   ═════════════════════════════════════════════════ */

import { Routes, Route, Navigate } from "react-router-dom";
import AppHeader from "../../components/AppHeader.jsx";
import GamesHome from "./GamesHome.jsx";
import SessionPage from "./SessionPage.jsx";
import NewGame from "./NewGame.jsx";
import PuzzlePage from "./PuzzlePage.jsx";
import TableHistory from "./TableHistory.jsx";

export default function GamesRoutes() {
  return (
    <>
      <AppHeader />
      <Routes>
        <Route index element={<GamesHome />} />
        {/* One-screen setup: pick people or bots, then Start. From
            there the board itself is the waiting room. */}
        <Route path="new/:gameKey" element={<NewGame />} />
        <Route path="s/:sessionId" element={<SessionPage />} />
        <Route path="puzzle" element={<PuzzlePage />} />
        {/* D2 — every table you have played, browsable. */}
        <Route path="history" element={<TableHistory />} />
        <Route path="*" element={<Navigate to="/app/games" replace />} />
      </Routes>
    </>
  );
}
