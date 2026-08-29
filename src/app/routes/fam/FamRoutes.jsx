/* ════════════════════════════════════════════════
   Saath-Fam route table — the single entry point for this folder.

   NOT yet registered in AppRoot.jsx (this lane doesn't edit shared
   files). FAM_WIRING.md in this folder holds the one-line
   registration for whoever does the seam pass:

     <Route path="fam/*" element={<FamRoutes />} />
   ════════════════════════════════════════════════ */

import { Routes, Route, Navigate } from "react-router-dom";
import FamDashboard from "./FamDashboard.jsx";
import InviteFlow from "./InviteFlow.jsx";
import Reminders from "./Reminders.jsx";

export default function FamRoutes() {
  return (
    <Routes>
      <Route index element={<FamDashboard />} />
      <Route path="invite" element={<InviteFlow />} />
      <Route path="icon/:iconId/reminders" element={<Reminders />} />
      <Route path="*" element={<Navigate to="/app/fam" replace />} />
    </Routes>
  );
}
