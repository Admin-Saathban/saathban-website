/* ════════════════════════════════════════════════
   Grow admin — /app/skills/admin ("Courses, surveys & Pending").

   Tabs: Courses · Pending · Surveys · Results (super admins) · Interest.
   The tab and whatever is open inside it live in the query string, so a
   link to one survey's people or results can be shared between staff.

   THE DATABASE IS THE BOUNDARY. Every read and write here is a database
   function that refuses a non-admin (support or super; moderators are
   refused, §18) and audits the change (0165); results are super-admin
   only and every read is audited (0166). This component's own guard is
   navigation: a non-admin is sent back to Grow instead of being shown a
   screen that would only be refused.
   ════════════════════════════════════════════════ */

import { useCallback, useEffect, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
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
  const [params, setParams] = useSearchParams();
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState("");

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
    if (isAdmin) reload();
  }, [isAdmin, reload]);

  if (profile && !isAdmin) return <Navigate to="/app/skills" replace />;

  const tabs = ["courses", "pending", "surveys", ...(isSuper ? ["results"] : []), "interest"];
  const wanted = params.get("tab") || "courses";
  const tab = tabs.includes(wanted) ? wanted : "courses";
  const props = { overview, reload, params, setParams, isSuper };

  return (
    <main style={{ minHeight: "100vh", background: C.bg, color: C.textMain, fontFamily: meta.fonts.body, padding: "16px 16px 80px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }} data-grow-admin>
        <Link
          to="/app/admin"
          style={{ display: "inline-flex", alignItems: "center", minHeight: A11Y.minTapTargetPx, color: C.green, fontWeight: 700, fontSize: ts(17), textDecoration: "none" }}
        >
          {meta.dir === "rtl" ? "→" : "←"} {t("grow.admin.backToDesk")}
        </Link>
        <h1 style={{ fontFamily: meta.fonts.heading, fontSize: ts(28), fontWeight: 700, color: C.green, margin: "4px 0 4px" }}>
          {t("grow.admin.title")}
        </h1>
        <p style={{ fontSize: ts(17), color: C.textMuted, lineHeight: 1.5, margin: "0 0 14px" }}>{t("grow.admin.subtitle")}</p>

        <nav
          aria-label={t("grow.admin.title")}
          style={{ display: "flex", gap: 8, overflowX: "auto", padding: "4px 0 12px", marginBottom: 8, borderBottom: `1px solid ${C.warmGray}` }}
        >
          {tabs.map((k) => (
            <button
              key={k}
              type="button"
              data-tab={k}
              aria-current={tab === k ? "page" : undefined}
              onClick={() => setParams({ tab: k })}
              style={{
                flex: "0 0 auto",
                minHeight: A11Y.minTapTargetPx,
                padding: "0 16px",
                borderRadius: 50,
                border: `2px solid ${tab === k ? C.green : C.warmGray}`,
                background: tab === k ? C.green : C.white,
                color: tab === k ? C.white : C.textMain,
                fontFamily: "inherit",
                fontSize: ts(17),
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {t(`grow.admin.tabs.${k}`)}
            </button>
          ))}
        </nav>

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
    </main>
  );
}
