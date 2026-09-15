/* ════════════════════════════════════════════════
   /app/admin/* — every admin screen, inside one shell.

   Mounted once from AppRoot behind RequireAuth roles={["admin"]}: a
   signed-in account that is not an admin never reaches this file, it is
   sent to its own home by the guard.

   Every screen an admin can open lives under /app/admin so the panel's
   navigation is always on screen. The screens that used to live
   elsewhere — Grow (/app/skills/admin), gatherings (/app/events/manage)
   and the milestone-message desk (/app/milestones) — are mounted here
   too, and their old addresses redirect in.

   LEVELS. A moderator moderates and nothing else: the database refuses
   them everything below except the reports queue (0053, 0125). The
   guards here are navigation, so a moderator who types a staff address
   is taken to the front screen instead of a page that would be refused.
   Survey results are super-admin only at the database (0166) and here.
   ════════════════════════════════════════════════ */

import { Navigate, Route, Routes } from "react-router-dom";
import { useSession } from "../../lib/session.jsx";
import { lazyScreen } from "../../lib/lazyScreen.jsx";
import AdminLayout from "./AdminLayout.jsx";
import { STAFF, SUPER, levelOf } from "./levels.js";

const Dashboard = lazyScreen(() => import("./Dashboard.jsx"));
const PeopleDesk = lazyScreen(() => import("./PeopleDesk.jsx"));
const PersonPage = lazyScreen(() => import("./PersonPage.jsx"));
const BuddyDesk = lazyScreen(() => import("./BuddyDesk.jsx"));
const BuddyApplication = lazyScreen(() => import("./BuddyApplication.jsx"));
const ModerationQueue = lazyScreen(() => import("./ModerationQueue.jsx"));
const QuestionsQueue = lazyScreen(() => import("./QuestionsQueue.jsx"));
const BroadcastsPage = lazyScreen(() => import("./BroadcastsPage.jsx"));
const PlaceAccess = lazyScreen(() => import("./PlaceAccess.jsx"));
const ActivityPage = lazyScreen(() => import("./ActivityPage.jsx"));
const ContentPage = lazyScreen(() => import("./ContentPage.jsx"));
const TestDataPage = lazyScreen(() => import("./TestDataPage.jsx"));
const AuditLog = lazyScreen(() => import("./AuditLog.jsx"));
const WelfarePage = lazyScreen(() => import("./WelfarePage.jsx"));
const BreakGlassPage = lazyScreen(() => import("./BreakGlassPage.jsx"));
const SkillsAdmin = lazyScreen(() => import("../skills/SkillsAdmin.jsx"));
const AdminEvents = lazyScreen(() => import("../events/AdminEvents.jsx"));
const AdminMilestones = lazyScreen(() => import("../milestones/AdminMilestones.jsx"));

function ForLevels({ levels, children }) {
  const { profile } = useSession();
  if (!levels.includes(levelOf(profile))) return <Navigate to="/app/admin" replace />;
  return children;
}

const staff = (el) => <ForLevels levels={STAFF}>{el}</ForLevels>;

export default function AdminRoutes() {
  return (
    <Routes>
      <Route element={<AdminLayout />}>
        {/* §18 — the front door says what needs a person, for every level. */}
        <Route index element={<Dashboard />} />

        <Route path="moderation" element={<ModerationQueue />} />
        {/* Every level: the database decides what each one reads (0179, 0180). */}
        <Route path="audit" element={<AuditLog />} />

        <Route path="people" element={staff(<PeopleDesk />)}>
          <Route path=":id" element={<PersonPage />} />
        </Route>
        <Route path="buddies" element={staff(<BuddyDesk />)}>
          <Route path=":id" element={<BuddyApplication />} />
        </Route>
        <Route path="welfare" element={staff(<WelfarePage />)} />
        {/* Break-glass (0187): super-admin only, not in the navigation —
            reached from a person's page and from a welfare check-in. */}
        <Route
          path="break-glass/:personId"
          element={
            <ForLevels levels={SUPER}>
              <BreakGlassPage />
            </ForLevels>
          }
        />
        <Route path="activity" element={staff(<ActivityPage />)} />
        <Route path="test-data" element={staff(<TestDataPage />)} />
        <Route path="content" element={staff(<ContentPage />)} />
        <Route path="questions" element={staff(<QuestionsQueue />)} />
        <Route path="broadcasts" element={staff(<BroadcastsPage />)} />
        <Route path="milestones" element={staff(<AdminMilestones />)} />
        <Route path="gatherings" element={staff(<AdminEvents />)} />
        <Route path="places" element={staff(<PlaceAccess />)} />
        <Route path="grow" element={<Navigate to="/app/admin/grow/courses" replace />} />
        <Route path="grow/:tab" element={staff(<SkillsAdmin />)} />

        <Route path="*" element={<Navigate to="/app/admin" replace />} />
      </Route>
    </Routes>
  );
}
