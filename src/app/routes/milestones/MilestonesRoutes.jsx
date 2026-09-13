/* ════════════════════════════════════════════════
   Milestones route table — single entry point for this folder.

   Icons see their own milestones and celebrations (AppRoot sends an
   Icon on to My Journey before this renders). The ADMIN milestone-
   message desk lives in the admin panel now, at /app/admin/milestones,
   so an admin arriving on this old address — a bookmark, a notification
   — is sent there. Other roles bounce to the app home: badges are the
   Icon's loop, and anyone else browsing them would be exactly the
   comparison SPEC forbids. RLS enforces the same shape regardless.
   ════════════════════════════════════════════════ */

import { Navigate, Route, Routes } from "react-router-dom";
import { useSession } from "../../lib/session.jsx";
import { Screen } from "./ui.jsx";
import Milestones from "./Milestones.jsx";

export default function MilestonesRoutes() {
  const { profile } = useSession();
  const role = profile?.role;

  if (role === "admin") return <Navigate to="/app/admin/milestones" replace />;
  if (role && role !== "saath_icon") {
    return <Navigate to="/app" replace />;
  }

  return (
    <>
      <Screen>
        <Routes>
          <Route index element={<Milestones />} />
          <Route path="*" element={<Navigate to="." replace />} />
        </Routes>
      </Screen>
    </>
  );
}
