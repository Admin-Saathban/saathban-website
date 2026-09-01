/* ════════════════════════════════════════════════
   Profile route table — the single entry point for this folder.
   NOT registered in AppRoot.jsx; PROFILE_WIRING.md holds the one-line
   registration. AppHeader here matches the other signed-in lanes.
   ════════════════════════════════════════════════ */

import { Routes, Route, Navigate } from "react-router-dom";
import ProfilePage from "./ProfilePage.jsx";

export default function ProfileRoutes() {
  return (
    <>
      <Routes>
        <Route index element={<ProfilePage />} />
        <Route path="*" element={<Navigate to="/app/profile" replace />} />
      </Routes>
    </>
  );
}
