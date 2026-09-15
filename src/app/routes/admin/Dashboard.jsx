/* ════════════════════════════════════════════════
   /app/admin — the front screen.

   "Shows what needs attention first: new reports, pending buddy
   applications, anything awaiting a decision, plus today's signups and
   how many people logged today. If nothing needs attention it says so
   plainly rather than showing empty boxes."

   ONE call, admin_dashboard (0176), which checks the caller first and
   returns only what that level may see — a moderator's payload has the
   reports and nothing else, so this screen cannot show a moderator a
   vetting count even by mistake. Counts only: no audit row, the same
   precedent as admin_activity.

   Every line is one tap into the screen where it is decided. A kind with
   nothing waiting is not drawn at all; with nothing waiting anywhere the
   screen says so in one sentence.

   The oldest-first worklist stays underneath (beside, on a wide screen):
   the summary says how much, the worklist says which one to pick up.
   ════════════════════════════════════════════════ */

import { Link, useOutletContext } from "react-router-dom";
import { APP_COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import Worklist from "./Worklist.jsx";

const n = (v) => Number(v || 0);

function plural(t, base, count, vars = {}) {
  return t(`${base}${count === 1 ? "One" : "Many"}`, { n: count, ...vars });
}

export function attentionItems(d, t) {
  if (!d) return [];
  const out = [];
  const reports = n(d.reports?.open);
  if (reports > 0) {
    const late = n(d.reports?.past_target);
    out.push({
      key: "reports",
      to: "/app/admin/moderation",
      title: plural(t, "admin.front.reports", reports),
      detail: late > 0 ? plural(t, "admin.front.pastTarget", late, { h: d.response_target_hours || 24 }) : t("admin.front.withinTarget", { h: d.response_target_hours || 24 }),
      urgent: late > 0,
    });
  }
  const apps = n(d.applications?.pending) + n(d.applications?.interviewing);
  if (apps > 0) {
    out.push({
      key: "applications",
      to: "/app/admin/buddies",
      title: plural(t, "admin.front.apps", apps),
      detail: t("admin.front.appsSplit", { pending: n(d.applications.pending), interviewing: n(d.applications.interviewing) }),
    });
  }
  if (n(d.documents_to_review) > 0) {
    out.push({
      key: "documents",
      to: "/app/admin/buddies",
      title: plural(t, "admin.front.docs", n(d.documents_to_review)),
      detail: t("admin.front.docsDetail"),
    });
  }
  if (n(d.questions_open) > 0) {
    out.push({ key: "questions", to: "/app/admin/questions", title: plural(t, "admin.front.questions", n(d.questions_open)) });
  }
  if (n(d.proposals_pending) > 0) {
    out.push({ key: "proposals", to: "/app/admin/gatherings", title: plural(t, "admin.front.proposals", n(d.proposals_pending)) });
  }
  /* Unchecked access notes are not listed here (0177). They are real
     work but nobody is waiting on them — a guess is withheld from every
     place until someone looks — and counting them meant this screen
     could never say "nothing waiting". They live in their own list, the
     Access notes screen, which says how many are unchecked. */
  return out;
}

export default function Dashboard() {
  const { t, ts, meta } = useI18n();
  const { dashboard: d, dashboardError, refreshDashboard } = useOutletContext();
  const items = attentionItems(d, t);
  const today = d?.today;
  const heading = {
    fontSize: ts(21),
    fontWeight: 800,
    color: C.green,
    lineHeight: meta.dir === "rtl" ? meta.lineHeight : 1.3,
    margin: "0 0 10px",
  };

  return (
    <section data-admin-front style={{ maxWidth: 1600, containerType: "inline-size" }}>
      <style>{`
        .sb-front-cols { display: grid; gap: 28px; grid-template-columns: minmax(0, 1fr); align-items: start; }
        @container (min-width: 980px) {
          .sb-front-cols[data-two="yes"] { grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); }
        }
      `}</style>
      <h1
        style={{
          fontSize: ts(30),
          fontWeight: 800,
          color: C.green,
          lineHeight: meta.dir === "rtl" ? meta.lineHeight : 1.2,
          margin: "0 0 6px",
        }}
      >
        {t("admin.front.title")}
      </h1>
      <p style={{ fontSize: ts(A11Y.minBodyPx), color: C.textMuted, margin: "0 0 22px", maxWidth: 760, lineHeight: meta.dir === "rtl" ? meta.lineHeight : 1.55 }}>
        {t("admin.front.intro")}
      </p>

      {d === null && !dashboardError && (
        <p role="status" aria-busy="true" style={{ fontSize: ts(A11Y.minBodyPx), color: C.textMuted }}>
          {t("admin.front.loading")}
        </p>
      )}
      {d === null && dashboardError && (
        <p role="alert" style={{ fontSize: ts(A11Y.minBodyPx), color: C.brown, fontWeight: 700 }}>
          ⚠ {t("admin.front.loadFailed")}{" "}
          <button
            type="button"
            onClick={refreshDashboard}
            style={{ minHeight: A11Y.minTapTargetPx, border: "none", background: "none", color: C.green, fontSize: ts(A11Y.minBodyPx), fontWeight: 700, textDecoration: "underline", cursor: "pointer", fontFamily: "inherit" }}
          >
            {t("admin.tryAgain")}
          </button>
        </p>
      )}

      {d && (
        <div className="sb-front-cols" data-two={items.length > 0 ? "yes" : "no"}>
          <div>
            {items.length === 0 ? (
              <p data-front="clear" style={{ fontSize: ts(22), fontWeight: 700, color: C.green, margin: "0 0 26px", lineHeight: meta.dir === "rtl" ? meta.lineHeight : 1.4 }}>
                ✓ {t("admin.front.clear")}
              </p>
            ) : (
              <>
                <h2 style={heading}>{t("admin.front.waiting")}</h2>
                <ul style={{ listStyle: "none", margin: "0 0 26px", padding: 0, display: "grid", gap: 10 }}>
                  {items.map((it) => (
                    <li key={it.key}>
                      <Link
                        to={it.to}
                        data-front-item={it.key}
                        data-urgent={it.urgent ? "yes" : "no"}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 14,
                          minHeight: 64,
                          padding: "10px 18px",
                          background: C.white,
                          border: it.urgent ? `2.5px solid ${C.brown}` : `1px solid ${C.warmGray}`,
                          borderInlineStart: `6px solid ${it.urgent ? C.brown : C.green}`,
                          borderRadius: 14,
                          color: C.textMain,
                          textDecoration: "none",
                        }}
                      >
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ display: "block", fontSize: ts(20), fontWeight: 800, lineHeight: meta.dir === "rtl" ? 1.9 : 1.35 }}>
                            {it.urgent && <span aria-hidden="true">⚑ </span>}
                            {it.title}
                          </span>
                          {it.detail && (
                            <span style={{ display: "block", fontSize: ts(A11Y.minBodyPx), color: it.urgent ? C.brown : C.textMuted, fontWeight: it.urgent ? 700 : 400, lineHeight: meta.dir === "rtl" ? 1.9 : 1.45 }}>
                              {it.detail}
                            </span>
                          )}
                        </span>
                        <span aria-hidden="true" style={{ color: C.green, fontWeight: 800, fontSize: ts(24) }}>
                          {meta.dir === "rtl" ? "‹" : "›"}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {today && (
              <div data-front-today>
                <h2 style={heading}>{t("admin.front.today")}</h2>
                <p style={{ fontSize: ts(20), margin: "0 0 4px", lineHeight: meta.dir === "rtl" ? meta.lineHeight : 1.5 }} data-today="signups">
                  {n(today.signups) === 0 ? t("admin.front.signupsNone") : plural(t, "admin.front.signups", n(today.signups))}
                </p>
                <p style={{ fontSize: ts(20), margin: "0 0 8px", lineHeight: meta.dir === "rtl" ? meta.lineHeight : 1.5 }} data-today="logged">
                  {n(today.logged) === 0 ? t("admin.front.loggedNone") : plural(t, "admin.front.logged", n(today.logged))}
                </p>
                <p style={{ fontSize: ts(16), color: C.textMuted, margin: 0, lineHeight: meta.dir === "rtl" ? meta.lineHeight : 1.5 }}>
                  {t("admin.front.todayNote")}{" "}
                  <Link to="/app/admin/activity" style={{ color: C.green, fontWeight: 700, display: "inline-flex", alignItems: "center", minHeight: A11Y.minTapTargetPx }}>
                    {t("admin.front.moreNumbers")}
                  </Link>
                </p>
              </div>
            )}
          </div>

          {items.length > 0 && (
            <div>
              <Worklist embedded />
            </div>
          )}
        </div>
      )}
    </section>
  );
}
