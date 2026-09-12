/* ═════════════════════════════════════════════════
   Games route table — the single entry point for this folder
   (migrations 0022/0022b; GAMES_CONTRACT.md is the rails contract).
   Registered in AppRoot behind RequireAuth. games/ludo/* is the ludo
   lane's and is registered separately in AppRoot — it wins over this
   shell by specificity.
   ═════════════════════════════════════════════════ */

import { Routes, Route, Navigate, useParams } from "react-router-dom";
import GamesHome from "./GamesHome.jsx";
import SessionPage from "./SessionPage.jsx";
import NewGame from "./NewGame.jsx";
import PuzzlePage from "./PuzzlePage.jsx";
import TableHistory from "./TableHistory.jsx";
import { isParkedGame, RESTING_TO } from "./parked.js";

/* THE SETUP ROOM FOR A RESTING GAME IS THE GAMES SCREEN.

   One component rather than two routes: the path carries the game key,
   so the same element serves every game and only turns away the parked
   ones. A game that comes back needs no change here at all. */
function SetupOrResting() {
  const { gameKey } = useParams();
  if (isParkedGame(gameKey)) return <Navigate to={RESTING_TO} replace />;
  return <NewGame />;
}

export default function GamesRoutes() {
  return (
    <>
      <Routes>
        <Route index element={<GamesHome />} />
        {/* One-screen setup: pick people or bots, then Start. From
            there the board itself is the waiting room. */}
        <Route path="new/:gameKey" element={<SetupOrResting />} />
        <Route path="s/:sessionId" element={<SessionPage />} />
        <Route path="puzzle" element={<PuzzlePage />} />
        {/* D2 — every table you have played, browsable. */}
        <Route path="history" element={<TableHistory />} />
        <Route path="*" element={<Navigate to="/app/games" replace />} />
      </Routes>
    </>
  );
}
