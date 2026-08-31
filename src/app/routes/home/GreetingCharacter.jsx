/* Greeting + the character companion (placeholder art).

   The character is a small sprout — hand-drawn SVG until the real
   character work lands. Its speech bubble is driven by the tone matrix
   in homeMock.js: mood-aware because mood is always logged first. */

import { APP_COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";

function SproutCharacter() {
  return (
    <svg
      viewBox="0 0 120 120"
      width="92"
      height="92"
      aria-hidden="true"
      style={{ flexShrink: 0, display: "block" }}
    >
      {/* soft ground shadow */}
      <ellipse cx="60" cy="108" rx="34" ry="7" fill={C.warmGray} opacity="0.55" />
      {/* stem and leaves */}
      <path
        d="M60 44 C 60 32, 60 26, 60 20"
        stroke={C.greenMuted}
        strokeWidth="5"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M60 30 C 48 28, 40 20, 40 10 C 52 10, 60 18, 60 30 Z"
        fill={C.sage}
      />
      <path
        d="M60 26 C 70 24, 78 17, 79 8 C 68 8, 61 15, 60 26 Z"
        fill={C.greenMuted}
      />
      {/* round body */}
      <circle cx="60" cy="74" r="34" fill={C.sage} />
      <circle cx="60" cy="74" r="34" fill="none" stroke={C.greenMuted} strokeWidth="2.5" />
      {/* face */}
      <circle cx="49" cy="70" r="3.6" fill={C.green} />
      <circle cx="71" cy="70" r="3.6" fill={C.green} />
      <path
        d="M50 82 C 55 88, 65 88, 70 82"
        stroke={C.green}
        strokeWidth="3.5"
        strokeLinecap="round"
        fill="none"
      />
      {/* cheeks */}
      <circle cx="43" cy="78" r="4.5" fill={C.brownLight} opacity="0.3" />
      <circle cx="77" cy="78" r="4.5" fill={C.brownLight} opacity="0.3" />
    </svg>
  );
}

export default function GreetingCharacter({ greeting, name, line }) {
  const { t, ts, meta } = useI18n();
  return (
    <section aria-label={t("home.greetingAria")} style={{ margin: "18px 0 22px" }}>
      <h1
        style={{
          fontFamily: meta.fonts.heading,
          fontSize: "clamp(1.75rem, 6vw, 2.3rem)",
          fontWeight: 700,
          color: C.green,
          lineHeight: 1.2,
          margin: "0 0 14px",
        }}
      >
        {greeting}, {name}
      </h1>

      <div style={{ display: "flex", alignItems: "flex-end", gap: 12 }}>
        <SproutCharacter />
        <p
          role="status"
          style={{
            position: "relative",
            flex: 1,
            margin: "0 0 10px",
            background: C.white,
            border: `2px solid ${C.warmGray}`,
            borderRadius: "18px 18px 18px 4px",
            padding: "14px 18px",
            fontSize: ts(17),
            lineHeight: 1.55,
            color: C.textMain,
          }}
        >
          {line}
        </p>
      </div>
    </section>
  );
}
