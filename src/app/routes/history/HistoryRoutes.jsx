/* ═════════════════════════════════════════════════
   My journey route table — the single entry point for this folder.
   Registered in AppRoot behind RequireAuth roles=["saath_icon"]: this
   is the Icon's OWN record. Every query inside fetches the caller's
   own rows only, so circle sharing permissions never reach this page
   (SPEC: trends are more intimate than single days).
   ═════════════════════════════════════════════════ */

import { Routes, Route, Navigate } from "react-router-dom";
import JourneyPage from "./JourneyPage.jsx";

export default function HistoryRoutes() {
  return (
    <>
      <Routes>
        <Route index element={<JourneyPage />} />
        <Route path="*" element={<Navigate to="/app/history" replace />} />
      </Routes>
    </>
  );
}
