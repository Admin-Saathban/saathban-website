/* ════════════════════════════════════════════════
   Saathban app — everything under /app

   Mounted by src/main.jsx at path "/app/*". The marketing
   site (src/App.jsx) owns every other path and is not
   touched by anything in this folder.

   Folder layout:
     app/
       AppRoot.jsx    this file — the /app route table
       routes/        one file per route (SPEC.md, Technical)
       components/    shared app UI primitives
       constants/     role display names, enums — see SPEC.md, Roles
       lib/           supabase client, helpers        (build step 2)
       locales/       en + ur translation files       (Urdu from day one)

   See SPEC.md for the full specification and build order.
   ════════════════════════════════════════════════ */

import { Routes, Route, Navigate } from "react-router-dom";
import { GOOGLE_FONTS_URL } from "../shared/tokens.js";
import AppHome from "./routes/AppHome.jsx";
import AdminLayout from "./routes/admin/AdminLayout.jsx";
import BuddyQueue from "./routes/admin/BuddyQueue.jsx";
import BuddyApplication from "./routes/admin/BuddyApplication.jsx";
import ModerationQueue from "./routes/admin/ModerationQueue.jsx";
import IconHome from "./routes/home/IconHome.jsx";
import { LanguageProvider } from "./lib/i18n.jsx";
import AuthRoutes from "./routes/auth/AuthRoutes.jsx";
import AppSettings from "./routes/AppSettings.jsx";

export default function AppRoot() {
  return (
    <LanguageProvider>
      {/* The marketing site loads its own fonts inside its own components,
          so /app has to ask for them itself. */}
      <style>{`@import url('${GOOGLE_FONTS_URL}');`}</style>

      <Routes>
        <Route index element={<AppHome />} />
        {/* Saath-Icon home (build step 9) — UI on mock data until the
            auth + data layer lands. */}
        <Route path="home/*" element={<IconHome />} />
        {/* Admin (build step 8) — Buddy review queue first, then the
            rest. UI on mock data until auth + Supabase wiring lands. */}
        <Route path="admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="buddies" replace />} />
          <Route path="buddies" element={<BuddyQueue />} />
          <Route path="buddies/:id" element={<BuddyApplication />} />
          <Route path="moderation" element={<ModerationQueue />} />
        </Route>
        {/* Auth lane (build steps 3-5): role selection, signup, login. */}
        <Route path="auth/*" element={<AuthRoutes />} />
        {/* Language, RTL, and text size (SPEC.md, Language & accessibility).
            LanguageProvider now wraps the whole route table above. */}
        <Route path="settings" element={<AppSettings />} />
        {/* Per-role dashboards land here in build step 6. */}
        <Route path="*" element={<AppHome />} />
      </Routes>
    </LanguageProvider>
  );
}
