/* ════════════════════════════════════════════════
   Skills route table — the single entry point for this folder.

   NOT registered in AppRoot.jsx; SKILLS_WIRING.md holds the one-line
   registration. The /admin subroute additionally needs an admin guard
   at the registration site (see the wiring note) — SkillsAdmin also
   self-guards, and the counts RPC is admin-only at the database.
   ════════════════════════════════════════════════ */

import { Routes, Route, Navigate } from "react-router-dom";
import { useSession } from "../../lib/session.jsx";
import SkillsPage from "./SkillsPage.jsx";
import CoursePage from "./CoursePage.jsx";
import SurveyPage from "./SurveyPage.jsx";
import SkillsAdmin from "./SkillsAdmin.jsx";

export default function SkillsRoutes() {
  /* §16 — the survey is Icons only (no Fam version). The route says
     so, and the database says so too: survey_responses is written by
     its owner and read by nobody but them and a super admin. */
  const { profile } = useSession();
  return (
    <>
      <Routes>
        <Route index element={<SkillsPage />} />
        {/* §16 — the course is open to Icons, Fam and Buddies. */}
        <Route path="course" element={<CoursePage />} />
        {/* The survey is Icons only (§16: no Fam version). */}
        <Route
          path="survey"
          element={profile?.role === "saath_icon" ? <SurveyPage /> : <Navigate to="/app/skills" replace />}
        />
        <Route path="admin" element={<SkillsAdmin />} />
        <Route path="*" element={<Navigate to="/app/skills" replace />} />
      </Routes>
    </>
  );
}
