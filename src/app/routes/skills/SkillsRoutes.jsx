/* ════════════════════════════════════════════════
   Skills route table — the single entry point for this folder.

   NOT registered in AppRoot.jsx; SKILLS_WIRING.md holds the one-line
   registration. The /admin subroute additionally needs an admin guard
   at the registration site (see the wiring note) — SkillsAdmin also
   self-guards, and the counts RPC is admin-only at the database.
   ════════════════════════════════════════════════ */

import { Routes, Route, Navigate } from "react-router-dom";
import AppHeader from "../../components/AppHeader.jsx";
import SkillsPage from "./SkillsPage.jsx";
import SkillsAdmin from "./SkillsAdmin.jsx";

export default function SkillsRoutes() {
  return (
    <>
      <AppHeader />
      <Routes>
        <Route index element={<SkillsPage />} />
        <Route path="admin" element={<SkillsAdmin />} />
        <Route path="*" element={<Navigate to="/app/skills" replace />} />
      </Routes>
    </>
  );
}
