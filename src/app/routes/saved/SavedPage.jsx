/* ════════════════════════════════════════════════
   Saved posts — /app/saved. NAVIGATION_SPEC §6, row 5.

   THIS ONE IS A DOOR, NOT A FEATURE, AND IT SAYS SO.

   §6 lists Saved posts as one of the seven rows, so the row must be
   there. But nothing in the app can save a post: there is no table, no
   save action in any post menu, and inventing one would mean reaching
   into the community lane's Feed while they are working in it.

   navItems.js already draws the distinction this rests on: an empty
   SECTION is absent, but a door to something deliberately not built
   yet is present and explains itself — Grow with Saathban is the
   precedent. What is forbidden is a row that opens a page pretending
   to be finished, or worse, opens nothing at all. That second one is
   what this replaces.

   The second line is a promise about privacy, not a feature tease,
   because the question a person actually has about a saved post is who
   else can see it.
   ════════════════════════════════════════════════ */

import { Link, useLocation } from "react-router-dom";
import { APP_COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { roleHomePath, useSession } from "../../lib/session.jsx";
import AppHeader from "../../components/AppHeader.jsx";
import { arrivalClass } from "../../components/motion.jsx";

export default function SavedPage() {
  const { t, ts, meta } = useI18n();
  const { profile } = useSession();
  const { state } = useLocation();

  return (
    <>
      <AppHeader />
      <main
        className={arrivalClass(state)}
        style={{
          minHeight: "100vh",
          background: C.bg,
          color: C.textMain,
          fontFamily: meta.fonts.body,
          padding: "16px 16px 80px",
        }}
      >
        <div style={{ maxWidth: 600, margin: "0 auto" }}>
          <h1
            style={{
              fontFamily: meta.fonts.heading,
              fontSize: ts(26),
              fontWeight: 700,
              color: C.green,
              margin: "0 0 14px",
            }}
          >
            {t("saved.title")}
          </h1>

          <p style={{ fontSize: ts(20), fontWeight: 600, margin: "0 0 8px", lineHeight: 1.45 }}>
            {t("saved.notYet")}
          </p>
          <p style={{ fontSize: ts(A11Y.minBodyPx), color: C.textMuted, margin: "0 0 24px", lineHeight: 1.6 }}>
            {t("saved.notYetBody")}
          </p>

          <Link
            to={profile ? roleHomePath(profile.role) : "/app"}
            style={{
              display: "inline-flex",
              alignItems: "center",
              minHeight: A11Y.minTapTargetPx,
              padding: "0 20px",
              borderRadius: 50,
              /* An outline, because this one IS tappable (§4.1). */
              border: `2px solid ${C.green}`,
              color: C.green,
              fontSize: ts(A11Y.minBodyPx),
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            {t("saved.home")}
          </Link>
        </div>
      </main>
    </>
  );
}
