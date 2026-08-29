/* ════════════════════════════════════════════════
   Saath-Fam route table — the single entry point for this folder.
   Registered in AppRoot.jsx behind RequireAuth roles=["family_member"].
   One AppHeader here covers every nested page (HEADER_WIRING.md).
   ════════════════════════════════════════════════ */

import { Routes, Route, Navigate } from "react-router-dom";
import AppHeader from "../../components/AppHeader.jsx";
import FamDashboard from "./FamDashboard.jsx";
import InviteFlow from "./InviteFlow.jsx";
import Reminders from "./Reminders.jsx";
import LogSetup from "./LogSetup.jsx";

export default function FamRoutes() {
  return (
    <>
      <AppHeader />
      <Routes>
        <Route index element={<FamDashboard />} />
        <Route path="invite" element={<InviteFlow />} />
        <Route path="icon/:iconId/reminders" element={<Reminders />} />
        <Route path="icon/:iconId/log-setup" element={<LogSetup />} />
        <Route path="*" element={<Navigate to="/app/fam" replace />} />
      </Routes>
    </>
  );
}
