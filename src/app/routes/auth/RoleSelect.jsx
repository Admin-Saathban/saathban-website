/* ════════════════════════════════════════════════
   /app/auth — role selection (SPEC.md, Signup flow).

   Role choice comes FIRST, as large tappable cards with an
   illustration and one line of plain description — not a dropdown.
   There is no admin card: admin accounts are provisioned internally.

   ?finish=1 — a session exists but no profile yet (assisted signup,
   or a bare sign-in link): same cards, welcoming copy, and the signup
   forms skip the credential step.
   ════════════════════════════════════════════════ */

import { Link, useSearchParams } from "react-router-dom";
import { COLORS as C, A11Y } from "../../../shared/tokens.js";
import { AuthScreen, Title } from "../../components/ui.jsx";
import { ROLE_DISPLAY } from "../../constants/roles.js";
import { useI18n } from "../../lib/i18n.jsx";

/* Simple warm line-art, one glyph per role. Decorative only. */
function TeacupArt() {
  return (
    <svg width="56" height="56" viewBox="0 0 64 64" aria-hidden="true">
      <path d="M14 28h30v12a15 15 0 0 1-30 0z" fill={C.sage} />
      <path
        d="M44 30h5a6 6 0 0 1 0 12h-6"
        fill="none"
        stroke={C.brown}
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M23 22c0-4 4-4 4-8M33 22c0-4 4-4 4-8"
        fill="none"
        stroke={C.brown}
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CompanionsArt() {
  return (
    <svg width="56" height="56" viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="22" cy="21" r="8" fill={C.olive} />
      <circle cx="42" cy="21" r="8" fill={C.sage} />
      <path
        d="M10 50c2-10 8-15 12-15 3 0 6 3 10 3s7-3 10-3c4 0 10 5 12 15"
        fill="none"
        stroke={C.brown}
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function HomeHeartArt() {
  return (
    <svg width="56" height="56" viewBox="0 0 64 64" aria-hidden="true">
      <path
        d="M12 30 32 14l20 16v20H12z"
        fill="none"
        stroke={C.brown}
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path
        d="M32 46c-6-5-9-8-9-11.5a5 5 0 0 1 9-2.8 5 5 0 0 1 9 2.8C41 38 38 41 32 46z"
        fill={C.sage}
      />
    </svg>
  );
}

const CARDS = [
  { role: "saath_icon", path: "signup/icon", descKey: "auth.roleSelect.cardIcon", Art: TeacupArt },
  { role: "saath_buddy", path: "signup/buddy", descKey: "auth.roleSelect.cardBuddy", Art: CompanionsArt },
  { role: "family_member", path: "signup/fam", descKey: "auth.roleSelect.cardFam", Art: HomeHeartArt },
];

export default function RoleSelect() {
  const { t, meta } = useI18n();
  const [params] = useSearchParams();
  const finish = params.get("finish") === "1";
  const suffix = finish ? "?finish=1" : "";

  return (
    <AuthScreen>
      <Title>{finish ? t("auth.roleSelect.finishTitle") : t("auth.roleSelect.title")}</Title>

      <div style={{ display: "grid", gap: 16, marginTop: 24 }}>
        {CARDS.map(({ role, path, descKey, Art }) => (
          <Link
            key={role}
            to={`${path}${suffix}`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 20,
              minHeight: 104,
              padding: "18px 22px",
              background: C.white,
              border: `2px solid ${C.warmGray}`,
              borderRadius: 18,
              textDecoration: "none",
              color: C.textMain,
            }}
          >
            <span style={{ flexShrink: 0, display: "flex" }} aria-hidden="true">
              <Art />
            </span>
            <span>
              <span
                style={{
                  display: "block",
                  fontFamily: meta.fonts.heading,
                  fontSize: 23,
                  fontWeight: 700,
                  color: C.green,
                  marginBottom: 4,
                }}
              >
                {ROLE_DISPLAY[role]}
              </span>
              <span
                style={{
                  display: "block",
                  fontSize: A11Y.minBodyPx,
                  color: C.textMuted,
                }}
              >
                {t(descKey)}
              </span>
            </span>
          </Link>
        ))}
      </div>

      {!finish && (
        <p style={{ textAlign: "center", fontSize: A11Y.minBodyPx, marginTop: 32 }}>
          {t("auth.roleSelect.haveAccount")}{" "}
          <Link to="login" style={{ color: C.brown, fontWeight: 600 }}>
            {t("auth.roleSelect.signIn")}
          </Link>
        </p>
      )}

      <p style={{ textAlign: "center", marginTop: 8 }}>
        <a
          href="/"
          style={{ fontSize: A11Y.minBodyPx, color: C.textMuted }}
        >
          {t("auth.roleSelect.backToSite")}
        </a>
      </p>
    </AuthScreen>
  );
}
