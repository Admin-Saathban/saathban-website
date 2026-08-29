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
import { COLORS as C, FONTS, GOOGLE_FONTS_URL, A11Y } from "../shared/tokens.js";
import { supabaseConfigError } from "./lib/supabase.js";
import AppHome from "./routes/AppHome.jsx";
import AdminLayout from "./routes/admin/AdminLayout.jsx";
import BuddyQueue from "./routes/admin/BuddyQueue.jsx";
import BuddyApplication from "./routes/admin/BuddyApplication.jsx";
import ModerationQueue from "./routes/admin/ModerationQueue.jsx";
import BroadcastsPage from "./routes/admin/BroadcastsPage.jsx";
import QuestionsQueue from "./routes/admin/QuestionsQueue.jsx";
import IconHome from "./routes/home/IconHome.jsx";
import { LanguageProvider } from "./lib/i18n.jsx";
import AuthRoutes from "./routes/auth/AuthRoutes.jsx";
import AppSettings from "./routes/AppSettings.jsx";
import { AuthProvider, RequireAuth } from "./lib/session.jsx";
import VettingForm from "./routes/vetting/VettingForm.jsx";
import FamRoutes from "./routes/fam/FamRoutes.jsx";
import { registerAppServiceWorker } from "./lib/pwa.js";

// App-shell offline caching + installability (production only; no-op
// in dev). Module level so it runs once, and only for /app visitors.
registerAppServiceWorker();

/* The /app boundary for a missing backend configuration. Rendered
   instead of the app when the Supabase env vars weren't baked into
   the build — a deploy-time mistake, so the audience is whoever set
   up the deployment, never a signed-in person. The marketing site at
   / is unaffected either way (the client is lazy; see lib/supabase.js). */
function AppConfigError() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: C.bg,
        color: C.textMain,
        fontFamily: FONTS.sans,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div style={{ maxWidth: 620 }}>
        <h1
          style={{
            fontFamily: FONTS.serif,
            fontSize: 30,
            fontWeight: 700,
            color: C.green,
            marginBottom: 12,
          }}
        >
          The app isn't available right now
        </h1>
        <p style={{ fontSize: A11Y.minBodyPx, lineHeight: 1.7, marginBottom: 18 }}>
          This build is missing its connection settings, so signing in won't
          work until it's redeployed. The main site is unaffected.
        </p>
        <p
          style={{
            fontSize: 15,
            lineHeight: 1.6,
            color: C.textMuted,
            background: C.white,
            border: `1px solid ${C.warmGray}`,
            borderRadius: 12,
            padding: "12px 16px",
            marginBottom: 24,
            fontFamily: "monospace",
          }}
        >
          {supabaseConfigError}
        </p>
        <a
          href="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            minHeight: A11Y.minTapTargetPx,
            padding: "0 28px",
            borderRadius: 50,
            background: C.green,
            color: C.cream,
            fontSize: A11Y.minBodyPx,
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Back to saathban.com
        </a>
      </div>
    </main>
  );
}

export default function AppRoot() {
  if (supabaseConfigError) return <AppConfigError />;
  return (
    <LanguageProvider>
      <AuthProvider>
        {/* The marketing site loads its own fonts inside its own components,
            so /app has to ask for them itself. */}
        <style>{`@import url('${GOOGLE_FONTS_URL}');`}</style>

        <Routes>
          <Route index element={<AppHome />} />
          {/* Saath-Icon home (build step 9) — UI on mock data until the
              auth + data layer lands. Icons only; RLS stays the real
              security boundary, this guard is navigation. */}
          <Route
            path="home/*"
            element={
              <RequireAuth roles={["saath_icon"]}>
                <IconHome />
              </RequireAuth>
            }
          />
          {/* Admin (build step 8) — Buddy review queue first, then the
              rest. UI on mock data until Supabase wiring lands. */}
          <Route
            path="admin"
            element={
              <RequireAuth roles={["admin"]}>
                <AdminLayout />
              </RequireAuth>
            }
          >
            <Route index element={<Navigate to="buddies" replace />} />
            <Route path="buddies" element={<BuddyQueue />} />
            <Route path="buddies/:id" element={<BuddyApplication />} />
            <Route path="questions" element={<QuestionsQueue />} />
            <Route path="broadcasts" element={<BroadcastsPage />} />
            <Route path="moderation" element={<ModerationQueue />} />
          </Route>
          {/* Saath-Buddy vetting application (build step 8, applicant
              side). The RPC re-checks the role server-side; this guard
              is navigation. */}
          <Route
            path="vetting"
            element={
              <RequireAuth roles={["saath_buddy"]}>
                <VettingForm />
              </RequireAuth>
            }
          />
          {/* Saath-Fam dashboard, invites, reminders (routes/fam). */}
          <Route
            path="fam/*"
            element={
              <RequireAuth roles={["family_member"]}>
                <FamRoutes />
              </RequireAuth>
            }
          />
          {/* Auth lane (build steps 3-5): role selection, signup, login. */}
          <Route path="auth/*" element={<AuthRoutes />} />
          {/* Language, RTL, and text size (SPEC.md, Language & accessibility).
              LanguageProvider wraps the whole route table above.
              Any signed-in role; no roles prop. */}
          <Route
            path="settings"
            element={
              <RequireAuth>
                <AppSettings />
              </RequireAuth>
            }
          />
          {/* Per-role dashboards land here in build step 6. */}
          <Route path="*" element={<AppHome />} />
        </Routes>
      </AuthProvider>
    </LanguageProvider>
  );
}
