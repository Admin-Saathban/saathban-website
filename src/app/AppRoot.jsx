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

import { Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useRef } from "react";
import { COLORS as C, FONTS, GOOGLE_FONTS_URL, A11Y } from "../shared/tokens.js";
import { supabaseConfigError } from "./lib/supabase.js";
import AppHome from "./routes/AppHome.jsx";
import AdminLayout from "./routes/admin/AdminLayout.jsx";
import BuddyQueue from "./routes/admin/BuddyQueue.jsx";
import BuddyApplication from "./routes/admin/BuddyApplication.jsx";
import ModerationQueue from "./routes/admin/ModerationQueue.jsx";
import Worklist from "./routes/admin/Worklist.jsx";
import BroadcastsPage from "./routes/admin/BroadcastsPage.jsx";
import QuestionsQueue from "./routes/admin/QuestionsQueue.jsx";
import PlaceAccess from "./routes/admin/PlaceAccess.jsx";
import HomeRoutes from "./routes/home/HomeRoutes.jsx";
import { LanguageProvider } from "./lib/i18n.jsx";
import AuthRoutes from "./routes/auth/AuthRoutes.jsx";
import AppSettings from "./routes/AppSettings.jsx";
import { AuthProvider, RequireAuth, useSession } from "./lib/session.jsx";
import FeedbackProvider from "./lib/feedback.jsx";
import VettingForm from "./routes/vetting/VettingForm.jsx";
import FamRoutes from "./routes/fam/FamRoutes.jsx";
import CircleRoutes from "./routes/circle/CircleRoutes.jsx";
import PeopleRoutes from "./routes/people/PeopleRoutes.jsx";
import LudoRoutes from "./routes/games/ludo/LudoRoutes.jsx";
import GamesRoutes from "./routes/games/GamesRoutes.jsx";
import JoinByLink from "./routes/games/JoinByLink.jsx";
import PublicResult from "./routes/games/PublicResult.jsx";
import ClaimSeat from "./routes/games/ClaimSeat.jsx";
import CalendarPage from "./routes/calendar/CalendarPage.jsx";
import { readPendingJoin, clearPendingJoin } from "./routes/games/joinLink.js";
import HelloInvite from "./routes/people/HelloInvite.jsx";
import { readPendingInvite, clearPendingInvite } from "./lib/invites.js";
import HistoryRoutes from "./routes/history/HistoryRoutes.jsx";
import CommunityRoutes from "./routes/community/CommunityRoutes.jsx";
import OutdoorRoutes from "./routes/outdoor/OutdoorRoutes.jsx";
import EventsRoutes from "./routes/events/EventsRoutes.jsx";
import SkillsRoutes from "./routes/skills/SkillsRoutes.jsx";
import NotificationsRoutes from "./routes/notifications/NotificationsRoutes.jsx";
import ProfileRoutes from "./routes/profile/ProfileRoutes.jsx";
import BuddyHome from "./routes/buddy/BuddyHome.jsx";
import MilestonesRoutes from "./routes/milestones/MilestonesRoutes.jsx";
import GroupsRoutes from "./routes/groups/GroupsRoutes.jsx";
import { registerAppServiceWorker } from "./lib/pwa.js";
import MorePage from "./routes/MorePage.jsx";
import AppShellBar from "./components/AppShellBar.jsx";
/* NAVIGATION_SPEC §5 and §6 — four destinations the new bar and
   More rows point at. Every one of them was a live link to nothing
   until this commit. */
import SearchPage from "./routes/search/SearchPage.jsx";
import BadgesPage from "./routes/badges/BadgesPage.jsx";
import SavedPage from "./routes/saved/SavedPage.jsx";
import HelpPage from "./routes/help/HelpPage.jsx";

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

/* A new screen starts at its beginning. Without this a route change
   keeps the previous page's scroll offset, so a screen reached from
   halfway down a list opens with its heading hidden behind the
   header — reported on the game setup screens, but it was every
   route. Only pathname changes reset; ?query and #hash navigation on
   the same screen leave the reader where they are, and a screen that
   places itself (the DM thread jumping to the latest message) still
   wins, because it scrolls after mount and keeps correcting. */
/* A link tapped in WhatsApp by someone with no account has to survive
   sign-up — and the sign-in email often opens a NEW TAB, where router
   state and sessionStorage are both gone. So the code is stashed in
   localStorage, and this picks it up the moment a profile exists,
   wherever the person happened to land. It fires once, only when a
   table is genuinely waiting, and never while already on the join
   screen (which would loop). */
function PendingJoinRedirect() {
  const { pathname } = useLocation();
  const { profile } = useSession();
  const navigate = useNavigate();
  const done = useRef(false);
  useEffect(() => {
    if (done.current || !profile) return;
    if (pathname.startsWith("/app/join") || pathname.startsWith("/app/seat")) return;
    if (pathname.startsWith("/app/hello")) return;
    /* §7 — an invitation tapped before there was an account. It keeps
       its OWN stash: stashPendingJoin() runs its argument through
       digitsOnly(), which is right for a six-digit table code and
       would erase a letters-and-digits invite code entirely. */
    const invite = readPendingInvite();
    if (invite) {
      done.current = true;
      clearPendingInvite();
      navigate(`/app/hello/${invite}`, { replace: true });
      return;
    }
    const code = readPendingJoin();
    if (!code) return;
    done.current = true;
    clearPendingJoin();
    /* Two kinds of pending arrival share one stash: a spoken join code
       and a §17 seat token, told apart by the prefix. They resume to
       different screens because they are different things — the code
       seats whoever types it, the token holds one chair for one
       person. */
    if (String(code).startsWith("seat:")) {
      navigate(`/app/seat/${String(code).slice(5)}`, { replace: true });
    } else {
      navigate(`/app/join/${code}`, { replace: true });
    }
  }, [profile, pathname, navigate]);
  return null;
}

/* Milestones merged into My Journey (see the route below). An Icon
   is sent to /app/history, which holds the badges, the streaks and
   the calendar together. An admin stays on the message desk, which
   shares this path and is a different feature entirely.

   `replace` so the back button returns where the person came from
   rather than bouncing them through the redirect again. */
function MilestonesOrJourney() {
  const { profile } = useSession();
  if (profile?.role === "saath_icon") return <Navigate to="/app/history" replace />;
  return <MilestonesRoutes />;
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function AppRoot() {
  if (supabaseConfigError) return <AppConfigError />;
  return (
    <LanguageProvider>
      <AuthProvider>
        {/* Global feedback: one toast host for the whole app, mounted
            inside Auth + Language + the router (FEEDBACK_WIRING.md).
            Inert until a surface pushes — an empty store renders null. */}
        <FeedbackProvider>
          <ScrollToTop />
          <PendingJoinRedirect />
        {/* The marketing site loads its own fonts inside its own components,
            so /app has to ask for them itself. */}
        <style>{`@import url('${GOOGLE_FONTS_URL}');`}</style>

        <Routes>
          <Route index element={<AppHome />} />
          {/* Join by link — deliberately OUTSIDE RequireAuth: a person
              tapping a shared link may have no account yet. The screen
              stashes the code, sends them to sign in, and seats them on
              the way back. It is the same join_by_code RPC as the typed
              code, so the gates and rate limits are unchanged. */}
          <Route path="join/:code" element={<JoinByLink />} />
          {/* §7 — a personal invitation. Outside RequireAuth for the
              same reason join/:code is: the person it was sent to may
              have no account yet. It connects nobody; it resolves who
              invited them and hands over to that profile. */}
          <Route path="hello/:code" element={<HelloInvite />} />
          {/* §17 — a seat held by a link. Outside RequireAuth for the
              same reason join/:code is: the person it was sent to may
              not have an account yet, and a sign-in wall on the link
              defeats the option entirely. */}
          <Route path="seat/:token" element={<ClaimSeat />} />
          {/* §13 — every role gets a calendar holding what is relevant
              to them. The filtering is by kind (entryActions), and the
              database is the real boundary underneath: calendar_entries
              are owner-only, so no role can read another's notes. */}
          <Route
            path="calendar"
            element={
              <RequireAuth>
                <CalendarPage />
              </RequireAuth>
            }
          />
          {/* The public result of a finished game — OUTSIDE RequireAuth,
              like join/:code above, because the whole point is a link
              someone can open with no account. The component never
              calls useSession: a page that throws for a stranger is
              worse than no page.

              The security is not this route. It is the one
              SECURITY DEFINER function behind it: finished games only,
              names and the board, no profile ids, no photos, and not
              enumerable — one id in, one game out, with the unguessable
              session id as the key, exactly as the join link works. */}
          <Route path="g/:id" element={<PublicResult />} />
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
            {/* §18 — the front door is a worklist, not a section.
                It also has to be: the index used to send everyone to
                the vetting queue, which a MODERATOR cannot read at
                all (0053), so their admin experience began with an
                empty page. The worklist is filtered by what you can
                act on, so it is correct for every level. */}
            <Route index element={<Worklist />} />
            <Route path="buddies" element={<BuddyQueue />} />
            <Route path="buddies/:id" element={<BuddyApplication />} />
            <Route path="questions" element={<QuestionsQueue />} />
            <Route path="broadcasts" element={<BroadcastsPage />} />
            <Route path="moderation" element={<ModerationQueue />} />
            {/* OUT_AND_ABOUT_SPEC §4.1 — admin-seeded access notes.
                The screen's real job is confirming guesses, since an
                unverified note never reaches a place row (0065). */}
            <Route path="places" element={<PlaceAccess />} />
          </Route>
          {/* Milestones (0017): Icons get points, badges and
              celebrations; admins get the message desk on the same
              path. */}
          {/* Milestones is My Journey's now: badges, streaks and
              celebrations all live on one page rather than two that
              each show half of the same year. An Icon arriving here —
              from an old link, a notification, a bookmark — is sent to
              the page that has their whole record.

              ADMINS ARE NOT REDIRECTED. The admin message desk lives
              on this same path, and it is not the Icon feature; the
              merge must not take it away. That is why this is a
              role-aware component rather than a plain <Navigate>. */}
          <Route
            path="milestones/*"
            element={
              <RequireAuth roles={["saath_icon", "admin"]}>
                <MilestonesOrJourney />
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
          {/* Ludo (routes/games/ludo, migration 0020). Any signed-in
              role; sessions are participants-only via RLS. Plugs into
              the games-rails shell when that lane lands (0022). */}
          <Route
            path="games/ludo/*"
            element={
              <RequireAuth>
                <LudoRoutes />
              </RequireAuth>
            }
          />
          {/* Games shell: registry, lobbies + live boards, Daily
              Riddle (routes/games, migrations 0022/0022b). Any
              signed-in role; RLS keeps sessions participants-only.
              games/ludo/* above stays more specific and wins. */}
          <Route
            path="games/*"
            element={
              <RequireAuth>
                <GamesRoutes />
              </RequireAuth>
            }
          />
          {/* My journey (routes/history): the Icon's own record —
              logs calendar, presence, badges, private trends. Icon
              role only; every query is own-rows-only by construction. */}
          <Route
            path="history/*"
            element={
              <RequireAuth roles={["saath_icon"]}>
                <HistoryRoutes />
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
          {/* Friend groups (0026): any signed-in role can be a member;
              create_group is Icons-only server-side. Notification deep
              links already target /app/groups/<id>. */}
          <Route
            path="groups/*"
            element={
              <RequireAuth>
                <GroupsRoutes />
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
          {/* MORE — the weekly and rare tiers of §3's navigation.
              Every signed-in role that has a bar has this screen; the
              groups inside it are filtered per role. */}
          <Route
            path="more"
            element={
              <RequireAuth>
                <MorePage />
              </RequireAuth>
            }
          />
          {/* ── §5 and §6: the four rows that opened nothing ──

              The bar and the More drawer were rebuilt to point here
              before anything was mounted on any of them, so every one
              of these paths fell through to the catch-all below and
              silently landed on Home. A menu row that opens nothing is
              the defect this redesign exists to fix, and four of them
              had just been added.

              No roles prop on any of them: a badge belongs to whoever
              earned it, and help belongs to anyone who needs it.
              Milestones is guarded to Icons, which is exactly why
              Badges is its own screen rather than a redirect there. */}
          <Route
            path="search"
            element={
              <RequireAuth>
                <SearchPage />
              </RequireAuth>
            }
          />
          <Route
            path="badges"
            element={
              <RequireAuth>
                <BadgesPage />
              </RequireAuth>
            }
          />
          <Route
            path="saved"
            element={
              <RequireAuth>
                <SavedPage />
              </RequireAuth>
            }
          />
          <Route
            path="help"
            element={
              <RequireAuth>
                <HelpPage />
              </RequireAuth>
            }
          />
          {/* Per-role dashboards land here in build step 6. */}
          <Route path="*" element={<AppHome />} />
        </Routes>

        {/* THE BOTTOM BAR, mounted once for the whole app (§3). It
            decides for itself where it must not appear — see
            AppShellBar. Outside <Routes> so it survives navigation
            rather than remounting on every screen change. */}
        <AppShellBar />
        </FeedbackProvider>
      </AuthProvider>
    </LanguageProvider>
  );
}
