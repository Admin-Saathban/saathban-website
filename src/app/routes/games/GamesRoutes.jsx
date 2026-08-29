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

export default function GamesRoutes() {
  return (
    <>
      <AppHeader />
      <Routes>
        <Route index element={<GamesHome />} />
        {/* The one-screen setup: pick people or bots, then Start.
            The board itself is the waiting room from there on. */}
        <Route path="new/:gameKey" element={<NewGame />} />
        <Route path="s/:sessionId" element={<SessionPage />} />
        <Route path="puzzle" element={<PuzzlePage />} />
        <Route path="*" element={<Navigate to="/app/games" replace />} />
      </Routes>
    </>
  );
}
