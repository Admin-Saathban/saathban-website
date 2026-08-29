/* /app — the front door while per-role dashboards (build step 6) are
   still to come. Successful auth lands here (Complete.jsx navigates to
   "/app"), so this page must link onward to everything that exists:
   the auth flows and the three working areas. Replaced by real
   role-aware routing when session handling lands. */

import { Link } from "react-router-dom";
import { COLORS as C, FONTS, A11Y } from "../../shared/tokens.js";

const AREAS = [
  {
    to: "/app/home",
    title: "Saath-Icon home",
    desc: "Calendar strip, daily log, points and sharing — on sample data.",
  },
  {
    to: "/app/settings",
    title: "Settings",
    desc: "Language (English / اردو), text size, and the RTL flip.",
  },
  {
    to: "/app/admin",
    title: "Admin",
    desc: "Buddy review queue and moderation — on sample data.",
  },
];

export default function AppHome() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: C.bg,
        fontFamily: FONTS.sans,
        color: C.textMain,
        padding: "48px 20px 64px",
      }}
    >
      <div style={{ maxWidth: 560, margin: "0 auto", textAlign: "center" }}>
        <img
          src="/logo-extended.png"
          alt="Saathban"
          style={{ height: 56, width: "auto", marginBottom: 28 }}
        />

        <h1
          style={{
            fontFamily: FONTS.serif,
            fontSize: "clamp(1.8rem, 4vw, 2.6rem)",
            fontWeight: 700,
            color: C.green,
            lineHeight: 1.2,
            marginBottom: 12,
          }}
        >
          Timeless Togetherness
        </h1>

        <p
          style={{
            fontSize: A11Y.minBodyPx,
            lineHeight: 1.7,
            color: C.textMuted,
            marginBottom: 28,
          }}
        >
          Welcome. Create an account or sign in to get started.
        </p>

        <div
          style={{
            display: "flex",
            gap: 14,
            justifyContent: "center",
            flexWrap: "wrap",
            marginBottom: 44,
          }}
        >
          <Link to="/app/auth" style={btn(true)}>
            Get started
          </Link>
          <Link to="/app/auth/login" style={btn(false)}>
            Sign in
          </Link>
        </div>

        <div style={{ textAlign: "start" }}>
          {AREAS.map((a) => (
            <Link
              key={a.to}
              to={a.to}
              style={{
                display: "block",
                background: C.white,
                border: `2px solid ${C.warmGray}`,
                borderRadius: 16,
                padding: "16px 20px",
                marginBottom: 12,
                textDecoration: "none",
                color: C.textMain,
              }}
            >
              <span
                style={{
                  display: "block",
                  fontFamily: FONTS.serif,
                  fontSize: 21,
                  fontWeight: 700,
                  color: C.green,
                  marginBottom: 2,
                }}
              >
                {a.title}
              </span>
              <span style={{ fontSize: A11Y.minBodyPx, color: C.textMuted }}>
                {a.desc}
              </span>
            </Link>
          ))}
        </div>

        <a
          href="/"
          style={{
            display: "inline-block",
            marginTop: 20,
            fontSize: A11Y.minBodyPx,
            color: C.textMuted,
          }}
        >
          Back to saathban.com
        </a>
      </div>
    </main>
  );
}

function btn(primary) {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: A11Y.minTapTargetPx,
    padding: "0 32px",
    borderRadius: 50,
    background: primary ? C.green : C.white,
    border: `2px solid ${C.green}`,
    color: primary ? C.cream : C.green,
    fontSize: A11Y.minBodyPx,
    fontWeight: 600,
    textDecoration: "none",
  };
}
