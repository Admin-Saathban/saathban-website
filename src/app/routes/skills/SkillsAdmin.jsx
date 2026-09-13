/* ════════════════════════════════════════════════
   Grow admin — inside the admin panel at /app/admin/grow/:tab
   ("Courses, surveys & Pending").

   Tabs: courses · pending · surveys · results (super admins) · interest.
   Each is its own entry in the panel's navigation, so the tab is part of
   the path; whatever is open inside it (a course being edited, a
   survey's results) stays in the query string, so a link to one
   survey's results can still be shared between staff.

   The old address, /app/skills/admin?tab=…, still works: it is sent to
   the same tab here with the rest of its query string intact.

   THE DATABASE IS THE BOUNDARY. Every read and write here is a database
   function that refuses a non-admin (support or super; moderators are
   refused, §18) and audits the change (0165); results are super-admin
   only and every read is audited (0166). This component's own guard is
   navigation.
   ════════════════════════════════════════════════ */

import { useCallback, useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { APP_COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { useSession } from "../../lib/session.jsx";
import { adminOverview } from "./growData.js";
import { Notice, errorMessage } from "./admin/ui.jsx";
import CoursesAdmin from "./admin/CoursesAdmin.jsx";
import PendingAdmin from "./admin/PendingAdmin.jsx";
import SurveysAdmin from "./admin/SurveysAdmin.jsx";
import ResultsAdmin from "./admin/ResultsAdmin.jsx";
import InterestAdmin from "./admin/InterestAdmin.jsx";

export default function SkillsAdmin() {
  const { t, ts, meta } = useI18n();
  const { profile } = useSession();
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const { tab: routeTab } = useParams();
  const [params] = useSearchParams();
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState("");

  const inPanel = pathname.startsWith("/app/admin/");
  const isAdmin = profile?.role === "admin" && profile?.admin_level !== "moderator";
  const isSuper = isAdmin && profile?.admin_level === "super";

  const reload = useCallback(async () => {
    try {
      setOverview(await adminOverview());
      setError("");
    } catch (e) {
      setError(errorMessage(e, t));
      setOverview((o) => o || { courses: [], surveys: [], pending: [], badges: [] });
    }
  }, [t]);

  useEffect(() => {
    if (isAdmin && inPanel) reload();
  }, [isAdmin, inPanel, reload]);

  /* The screens were written against setSearchParams({ tab, …rest }).
     The tab is the path now; the rest stays a query string. */
  const setParams = useCallback(
    (next) => {
      const { tab: nextTab, ...rest } = next || {};
      const qs = new URLSearchParams(rest).toString();
      navigate(`/app/admin/grow/${nextTab || routeTab || "courses"}${qs ? `?${qs}` : ""}`);
    },
    [navigate, routeTab]
  );

  if (profile && !isAdmin) return <Navigate to={inPanel ? "/app/admin" : "/app/skills"} replace />;

  if (!inPanel) {
    const old = new URLSearchParams(search);
    const oldTab = old.get("tab") || "courses";
    old.delete("tab");
    const qs = old.toString();
    return <Navigate to={`/app/admin/grow/${oldTab}${qs ? `?${qs}` : ""}`} replace />;
  }

  const tabs = ["courses", "pending", "surveys", ...(isSuper ? ["results"] : []), "interest"];
  if (!tabs.includes(routeTab)) return <Navigate to="/app/admin/grow/courses" replace />;
  const tab = routeTab;
  const props = { overview, reload, params, setParams, isSuper };

  return (
    <div data-grow-admin style={{ maxWidth: 1200, color: C.textMain, fontFamily: meta.fonts.body, containerType: "inline-size" }}>
      {/* Both languages side by side once there is room for two
          readable columns; one above the other on a phone. */}
      <style>{`
        .sb-bilingual { display: grid; gap: 8px; grid-template-columns: minmax(0, 1fr); }
        @container (min-width: 760px) { .sb-bilingual { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); } }
      `}</style>
      <p style={{ fontSize: ts(16), fontWeight: 700, color: C.textMuted, margin: "0 0 2px" }}>{t("grow.admin.title")}</p>
      <h1 style={{ fontFamily: meta.fonts.heading, fontSize: ts(30), fontWeight: 700, color: C.green, margin: "0 0 4px", lineHeight: meta.dir === "rtl" ? meta.lineHeight : 1.2 }}>
        {t(`grow.admin.tabs.${tab}`)}
      </h1>
      <p style={{ fontSize: ts(A11Y.minBodyPx), color: C.textMuted, lineHeight: 1.5, margin: "0 0 16px", maxWidth: 760 }}>{t("grow.admin.subtitle")}</p>

      {error && <Notice tone="error">{error}</Notice>}

      {tab === "interest" ? (
        <InterestAdmin />
      ) : overview === null ? (
        <p aria-busy="true" style={{ fontSize: ts(A11Y.minBodyPx), color: C.textMuted }}>···</p>
      ) : tab === "courses" ? (
        <CoursesAdmin {...props} />
      ) : tab === "pending" ? (
        <PendingAdmin {...props} />
      ) : tab === "surveys" ? (
        <SurveysAdmin {...props} />
      ) : (
        <ResultsAdmin {...props} />
      )}
    </div>
  );
}
