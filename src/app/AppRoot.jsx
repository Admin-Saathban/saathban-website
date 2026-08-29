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
import HomeRoutes from "./routes/home/HomeRoutes.jsx";
import { LanguageProvider } from "./lib/i18n.jsx";
import AuthRoutes from "./routes/auth/AuthRoutes.jsx";
import AppSettings from "./routes/AppSettings.jsx";
import { AuthProvider, RequireAuth } from "./lib/session.jsx";
import VettingForm from "./routes/vetting/VettingForm.jsx";
import FamRoutes from "./routes/fam/FamRoutes.jsx";
import CircleRoutes from "./routes/circle/CircleRoutes.jsx";
import PeopleRoutes from "./routes/people/PeopleRoutes.jsx";
import CommunityRoutes from "./routes/community/CommunityRoutes.jsx";
import OutdoorRoutes from "./routes/outdoor/OutdoorRoutes.jsx";
import EventsRoutes from "./routes/events/EventsRoutes.jsx";
import SkillsRoutes from "./routes/skills/SkillsRoutes.jsx";
import NotificationsRoutes from "./routes/notifications/NotificationsRoutes.jsx";
import ProfileRoutes from "./routes/profile/ProfileRoutes.jsx";
import BuddyHome from "./routes/buddy/BuddyHome.jsx";
import MilestonesRoutes from "./routes/milestones/MilestonesRoutes.jsx";
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
          {/* Saath-Icon home area: hub at /app/home, daily log at
              /app/home/log. Icons only; RLS stays the real security
              boundary, this guard is navigation. */}
          <Route
            path="home/*"
            element={
              <RequireAuth roles={["saath_icon"]}>
                <HomeRoutes />
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
          {/* Milestones (0017): Icons get points, badges and
              celebrations; admins get the message desk on the same
              path. */}
          <Route
            path="milestones/*"
            element={
              <RequireAuth roles={["saath_icon", "admin"]}>
                <MilestonesRoutes />
              </RequireAuth>
            }
          />
          {/* Saath-Buddy home: live pipeline status, matched-Icons
              placeholder, documents channel (0015). */}
          <Route
            path="buddy"
            element={
              <RequireAuth roles={["saath_buddy"]}>
                <BuddyHome />
              </RequireAuth>
            }
          />
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
          {/* Icon-side My Circle: members, permissions, invites
              (routes/circle — CircleRoutes carries its own AppHeader).
              Linked from Settings, not main nav — SPEC.md: circle
              stays out of navigation until it has a member; Settings
              is its permanent home either way. */}
          <Route
            path="circle/*"
            element={
              <RequireAuth roles={["saath_icon"]}>
                <CircleRoutes />
              </RequireAuth>
            }
          />
          {/* Person profiles + their DM thread (routes/people): any
              signed-in role; RLS decides what each viewer sees. Circle
              members' threads auto-accept (migration 0019). */}
          <Route
            path="people/*"
            element={
              <RequireAuth>
                <PeopleRoutes />
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
          {/* Community v1 (migration 0014): feed, request-gated DMs.
              Any signed-in role reaches the route; the 0014 policies
              decide who sees or writes anything (icons + org post,
              buddies only once active). */}
          <Route
            path="community/*"
            element={
              <RequireAuth>
                <CommunityRoutes />
              </RequireAuth>
            }
          />
          {/* Events + calendar (0013): every signed-in role sees
              published gatherings; the lane gates its own tabs. */}
          <Route
            path="events/*"
            element={
              <RequireAuth>
                <EventsRoutes />
              </RequireAuth>
            }
          />
          {/* Skills notify-me cards (0012); counts view self-gates. */}
          <Route
            path="skills/*"
            element={
              <RequireAuth>
                <SkillsRoutes />
              </RequireAuth>
            }
          />
          {/* In-app notifications (0007). */}
          <Route
            path="notifications/*"
            element={
              <RequireAuth>
                <NotificationsRoutes />
              </RequireAuth>
            }
          />
          {/* Own profile view/edit (0002; protected columns stay
              locked at the database). */}
          <Route
            path="profile/*"
            element={
              <RequireAuth>
                <ProfileRoutes />
              </RequireAuth>
            }
          />
          {/* Outdoor v1 (migration 0016): places, manual check-ins,
              outings, park boards. Any signed-in role reaches the
              route; the 0016 policies decide visibility (icons check
              in, presence per its chosen audience, buddies once
              active). */}
          <Route
            path="outdoor/*"
            element={
              <RequireAuth>
                <OutdoorRoutes />
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
