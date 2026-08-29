/* ════════════════════════════════════════════════
   Milestones route table — single entry point for this folder.
   Registration snippet in MILESTONES_WIRING.md (AppRoot held other
   sessions' uncommitted changes when this lane landed).

   One route, two faces: Icons see their own milestones and
   celebrations; admins see the milestone-message desk. Other roles
   bounce to the app home — badges are the Icon's loop, and anyone
   else browsing them would be exactly the comparison SPEC forbids.
   RLS enforces the same shape regardless of this navigation.
   ════════════════════════════════════════════════ */

import { Navigate, Route, Routes } from "react-router-dom";
import { useSession } from "../../lib/session.jsx";
import AppHeader from "../../components/AppHeader.jsx";
import { Screen } from "./ui.jsx";
import Milestones from "./Milestones.jsx";
import AdminMilestones from "./AdminMilestones.jsx";

export default function MilestonesRoutes() {
  const { profile } = useSession();
  const role = profile?.role;

  if (role && role !== "saath_icon" && role !== "admin") {
    return <Navigate to="/app" replace />;
  }

  return (
    <>
      <AppHeader />
      <Screen>
        <Routes>
          <Route index element={role === "admin" ? <AdminMilestones /> : <Milestones />} />
          <Route path="*" element={<Navigate to="." replace />} />
        </Routes>
      </Screen>
    </>
  );
}
