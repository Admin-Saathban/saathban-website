/* ════════════════════════════════════════════════
   My Circle route table — the single entry point for this folder.

   NOT registered in AppRoot.jsx (this lane doesn't edit shared files).
   CIRCLE_WIRING.md holds the one-line registration for the seam pass.
   AppHeader here covers the page, matching the other Icon-facing lanes.
   ════════════════════════════════════════════════ */

import { Routes, Route, Navigate } from "react-router-dom";
import AppHeader from "../../components/AppHeader.jsx";
import CirclePage from "./CirclePage.jsx";

export default function CircleRoutes() {
  return (
    <>
      <AppHeader />
      <Routes>
        <Route index element={<CirclePage />} />
        <Route path="*" element={<Navigate to="/app/circle" replace />} />
      </Routes>
    </>
  );
}
