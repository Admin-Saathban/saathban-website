/* ════════════════════════════════════════════════
   Outdoor route table — the single entry point for this folder.
   Registered in AppRoot behind RequireAuth (any signed-in role; the
   0016 policies decide who sees or writes anything). One AppHeader
   covers every nested page (HEADER_WIRING.md).
   ════════════════════════════════════════════════ */

import { Routes, Route, Navigate } from "react-router-dom";
import AppHeader from "../../components/AppHeader.jsx";
import WhatsOn from "./WhatsOn.jsx";
import OutdoorHome from "./OutdoorHome.jsx";
import PlaceView from "./PlaceView.jsx";
import Moments from "./Moments.jsx";

export default function OutdoorRoutes() {
  return (
    <>
      <AppHeader />
      <Routes>
        {/* §12 — Out & about and Events are ONE screen. What's on is
            that screen; the old place directory keeps its own route
            because §12 still wants one quiet "Places near you" link at
            the bottom, just not a directory as the front door. */}
        <Route index element={<WhatsOn />} />
        <Route path="places" element={<OutdoorHome />} />
        {/* section 8 — "I am at X" without creating a permanent place.
            Registered BEFORE :placeId, or "moments" would be read as
            a place id and render a missing place. */}
        <Route path="moments" element={<Moments />} />
        <Route path=":placeId" element={<PlaceView />} />
        <Route path="*" element={<Navigate to="/app/outdoor" replace />} />
      </Routes>
    </>
  );
}
