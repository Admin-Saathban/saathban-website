/* ════════════════════════════════════════════════
   /app/s/:token — somebody's day, opened by whoever they sent the
   link to.

   OUTSIDE RequireAuth, like g/:id and join/:code, because the whole
   point is a link that opens with no account. This component never
   calls useSession: a page that throws for a stranger is worse than
   no page.

   The security is not this route. It is read_share_link (0114), which
   names the fields it returns rather than handing back the payload
   wholesale — a first name and the score summary, nothing else — and
   answers null for missing, expired and revoked alike, so the endpoint
   cannot be used to learn that a token was ever real.
   ════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { APP_COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { fetchSharedScore } from "./shareData.js";

export default function SharedScore() {
  const { token } = useParams();
  const { t, ts, meta, lang } = useI18n();
  const [state, setState] = useState({ status: "loading", data: null });

  useEffect(() => {
    let alive = true;
    fetchSharedScore(token)
      .then((data) => alive && setState({ status: data ? "ready" : "gone", data }))
      /* A network failure is not an expired link, and telling somebody
         their friend's link has expired when the request simply failed
         would be its own small lie. */
      .catch(() => alive && setState({ status: "error", data: null }));
    return () => { alive = false; };
  }, [token]);

  const wrap = {
    minHeight: "100vh",
    background: C.cream,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "32px 20px",
  };
  const card = {
    width: "min(100%, 480px)",
    background: C.white,
    borderRadius: 24,
    padding: "34px 28px",
    textAlign: "center",
  };

  if (state.status === "loading") {
    return (
      <main style={wrap}>
        <p role="status" style={{ fontSize: ts(A11Y.minBodyPx), color: C.textMuted }}>
          {t("home.score.shared.loading")}
        </p>
      </main>
    );
  }

  if (state.status !== "ready") {
    return (
      <main style={wrap}>
        <div style={card}>
          <h1 style={{ fontFamily: meta.fonts.heading, fontSize: ts(26), color: C.brown, margin: "0 0 10px" }}>
            {t(state.status === "error" ? "home.score.shared.errorTitle" : "home.score.shared.goneTitle")}
          </h1>
          <p style={{ fontSize: ts(A11Y.minBodyPx), color: C.textMuted, lineHeight: 1.6, margin: 0 }}>
            {t(state.status === "error" ? "home.score.shared.errorBody" : "home.score.shared.goneBody")}
          </p>
        </div>
      </main>
    );
  }

  const { name, points, logs, expires_at: expiresAt } = state.data;
  const until = expiresAt
    ? new Date(expiresAt).toLocaleDateString(lang === "ur" ? "ur-PK" : "en-GB", {
        day: "numeric",
        month: "long",
      })
    : null;

  return (
    <main style={wrap}>
      <div style={card}>
        <h1 style={{ fontFamily: meta.fonts.heading, fontSize: ts(28), color: C.green, margin: "0 0 6px" }}>
          {name ? t("home.score.shared.titleNamed", { name }) : t("home.score.shared.title")}
        </h1>

        <p style={{ fontSize: ts(48), fontWeight: 800, color: C.brown, margin: "18px 0 4px", lineHeight: 1 }}>
          {points}
        </p>
        <p style={{ fontSize: ts(A11Y.minBodyPx), color: C.textMuted, margin: 0 }}>
          {t("home.score.shared.points")}
        </p>

        <p style={{ fontSize: ts(19), color: C.textMain, margin: "22px 0 0", lineHeight: 1.6 }}>
          {logs === 1 ? t("home.score.shared.logsOne") : t("home.score.shared.logsMany", { n: logs })}
        </p>

        {/* Said plainly, because the sharer was promised it. */}
        {until && (
          <p style={{ fontSize: ts(16), color: C.textMuted, margin: "26px 0 0", lineHeight: 1.6 }}>
            {t("home.score.shared.expiresOn", { date: until })}
          </p>
        )}

        <p style={{ fontSize: ts(16), color: C.textMuted, margin: "18px 0 0", lineHeight: 1.6 }}>
          {t("home.score.shared.whatIsThis")}
        </p>
      </div>
    </main>
  );
}
