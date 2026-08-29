/* ════════════════════════════════════════════════
   Saath-Icon home area — /app/home/*.

   index  → IconHub  (the after-sign-in landing: greeting, today at a
                      glance, cards to every area)
   log    → IconHome (the daily log page — calendar strip, log card,
                      score & sharing)

   Both pages render their own AppHeader.
   ════════════════════════════════════════════════ */

import { Routes, Route, Navigate } from "react-router-dom";
import IconHub from "./IconHub.jsx";
import IconHome from "./IconHome.jsx";

export default function HomeRoutes() {
  return (
    <Routes>
      <Route index element={<IconHub />} />
      <Route path="log" element={<IconHome />} />
      <Route path="*" element={<Navigate to="/app/home" replace />} />
    </Routes>
  );
}
