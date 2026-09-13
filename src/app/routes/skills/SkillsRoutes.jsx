/* ════════════════════════════════════════════════
   Grow with Saathban — the route table for this folder.

   Registered once in AppRoot.jsx as skills/* behind RequireAuth.

     /app/skills               the Grow page
     /app/skills/courses       Courses and training: New and Past courses
     /app/skills/course        the Saathban course
     /app/skills/course/:id    any course or programme
     /app/skills/survey        "Help Saathban's research"
     /app/skills/survey/:id    any published survey
     /app/skills/admin/*       courses, Pending, surveys, results, interest

   WHO MAY SEE WHAT IS DECIDED BY THE DATABASE, not by these routes. A
   course or survey not meant for this account (the research survey is
   Icons only, §16) comes back from the server as nothing, and the screen
   returns to Grow. The admin screen self-guards for navigation, and every
   admin function refuses a non-admin at the database (0165, 0166).
   ════════════════════════════════════════════════ */

import { Routes, Route, Navigate } from "react-router-dom";
import SkillsPage from "./SkillsPage.jsx";
import CoursePage from "./CoursePage.jsx";
import CoursesPage from "./CoursesPage.jsx";
import SurveyPage from "./SurveyPage.jsx";
import SkillsAdmin from "./SkillsAdmin.jsx";

export default function SkillsRoutes() {
  return (
    <Routes>
      <Route index element={<SkillsPage />} />
      <Route path="courses" element={<CoursesPage />} />
      <Route path="course" element={<CoursePage />} />
      <Route path="course/:id" element={<CoursePage />} />
      <Route path="survey" element={<SurveyPage />} />
      <Route path="survey/:id" element={<SurveyPage />} />
      <Route path="admin/*" element={<SkillsAdmin />} />
      <Route path="*" element={<Navigate to="/app/skills" replace />} />
    </Routes>
  );
}
