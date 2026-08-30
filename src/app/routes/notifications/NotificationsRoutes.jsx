/* ════════════════════════════════════════════════
   Notifications route table — the single entry point for this folder.

   NOT registered in AppRoot.jsx (this lane doesn't edit shared files);
   NOTIFICATIONS_WIRING.md holds the one-line registration. AppHeader
   here matches the other signed-in lanes.
   ════════════════════════════════════════════════ */

import { Routes, Route, Navigate } from "react-router-dom";
import AppHeader from "../../components/AppHeader.jsx";
import NotificationsPage from "./NotificationsPage.jsx";
import NotifySettings from "./NotifySettings.jsx";

export default function NotificationsRoutes() {
  return (
    <>
      <AppHeader />
      <Routes>
        <Route index element={<NotificationsPage />} />
        {/* §19 — what may interrupt you. */}
        <Route path="settings" element={<NotifySettings />} />
        <Route path="*" element={<Navigate to="/app/notifications" replace />} />
      </Routes>
    </>
  );
}
