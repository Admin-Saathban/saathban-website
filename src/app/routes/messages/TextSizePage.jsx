/* ════════════════════════════════════════════════
   Text size, inside Messages — Menu → Text size.

   The Menu row used to be "Text size in chats" and dropped you at the
   top of the ~5,800px Settings page, far from the setting — and the
   setting is not about chats at all, it sizes the whole app. So the row
   is named for what it does, and the four choices are right here: the
   same TEXT_SIZES list and the same setter Settings uses, so the two
   screens can never disagree.
   ════════════════════════════════════════════════ */

import { APP_COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n, TEXT_SIZES } from "../../lib/i18n.jsx";

export default function TextSizePage() {
  const { t, ts, textSize, setTextSize } = useI18n();
  return (
    <section>
      <h2 style={{ fontSize: ts(22), fontWeight: 700, color: C.green, margin: "4px 0 6px" }}>
        {t("settings.textSize.title")}
      </h2>
      <p style={{ fontSize: ts(A11Y.minBodyPx), color: C.textMuted, margin: "0 0 16px", lineHeight: 1.5 }}>
        {t("settings.textSize.hint")}
      </p>
      <div
        role="radiogroup"
        aria-label={t("settings.textSize.title")}
        style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}
      >
        {TEXT_SIZES.map((s) => {
          const active = textSize === s.id;
          return (
            <button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setTextSize(s.id)}
              style={{
                minHeight: 76,
                boxSizing: "border-box",
                padding: 8,
                borderRadius: 16,
                border: `2px solid ${active ? C.green : C.warmGray}`,
                background: active ? C.selected : C.white,
                color: C.textMain,
                fontFamily: "inherit",
                fontSize: ts(A11Y.minBodyPx),
                fontWeight: active ? 800 : 600,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 2,
                cursor: "pointer",
              }}
            >
              {/* fixed px on purpose: each button previews its own step */}
              <span aria-hidden="true" style={{ fontSize: A11Y.minBodyPx * s.scale, fontWeight: 700 }}>Aa</span>
              {/* Never colour alone: the chosen one also carries a tick. */}
              <span>{active ? "✓ " : ""}{t(s.labelKey)}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
