/* ════════════════════════════════════════════════
   Outdoor route table — the single entry point for this folder.
   Registered in AppRoot behind RequireAuth (any signed-in role; the
   0016 policies decide who sees or writes anything). One AppHeader
   covers every nested page (HEADER_WIRING.md).
   ════════════════════════════════════════════════ */

import { Routes, Route, Navigate } from "react-router-dom";
import AppHeader from "../../components/AppHeader.jsx";
import OutdoorHome from "./OutdoorHome.jsx";
import PlaceView from "./PlaceView.jsx";

export default function OutdoorRoutes() {
  return (
    <>
      <AppHeader />
      <Routes>
        <Route index element={<OutdoorHome />} />
        <Route path=":placeId" element={<PlaceView />} />
        <Route path="*" element={<Navigate to="/app/outdoor" replace />} />
      </Routes>
    </>
  );
}
