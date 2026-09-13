/* ════════════════════════════════════════════════
   "Your days" — below Today's log (mock screen 1).

   ONE HEADLINE NUMBER: days with Saathban, from my_days(). It never
   resets and never goes down. It replaces the points card that stood
   here, and the score, the "of 10" and the badge bar went with it.

   The whole-day rest toggle stays: resting is participation, and it was
   never about points. Share opens the three shareable things.
   ════════════════════════════════════════════════ */

import { useState } from "react";
import { APP_COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { useSession } from "../../lib/session.jsx";
import { useMyStreaks, tn } from "./streaksData.js";
import { Card, Label, Sheet, SheetTitle } from "./ui.jsx";
import ShareThings, { SoftPill } from "./ShareThings.jsx";

export default function YourDays({ restDay, onToggleRest, editable }) {
  const { t, ts } = useI18n();
  const { profile } = useSession();
  const { days } = useMyStreaks(profile?.id);
  const [open, setOpen] = useState(false);
  const n = days ? days.days : null;

  return (
    <section aria-label={t("streaks.days.label")} data-your-days="" style={{ marginBottom: 20 }}>
      <Label style={{ marginTop: 4 }}>{t("streaks.days.label")}</Label>
      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: ts(19), fontWeight: 700, color: C.textMain }}>
              {n == null ? "…" : tn(t, "streaks.days.count", n)}
            </p>
            <p style={{ margin: "2px 0 0", fontSize: ts(A11Y.minBodyPx), color: C.textMuted, lineHeight: 1.45 }}>
              {t("streaks.days.sub")}
            </p>
          </div>
          <SoftPill onClick={() => setOpen(true)} label={t("streaks.share.sheetTitle")}>
            {t("streaks.days.share")}
          </SoftPill>
        </div>
      </Card>

      {editable && (
        <button
          type="button"
          onClick={onToggleRest}
          aria-pressed={restDay}
          style={{
            width: "100%",
            minHeight: 52,
            borderRadius: 16,
            border: `1.5px solid ${C.green}`,
            background: restDay ? C.selected : "transparent",
            color: C.green,
            fontSize: ts(17),
            fontWeight: 700,
            fontFamily: "inherit",
            cursor: "pointer",
            marginTop: 4,
          }}
        >
          {restDay ? t("home.score.restOn") : t("home.score.restOff")}
        </button>
      )}
      {restDay && (
        <p style={{ fontSize: ts(A11Y.minBodyPx), color: C.textMuted, margin: "8px 4px 0", lineHeight: 1.5 }}>{t("home.score.restLine")}</p>
      )}

      <Sheet open={open} onClose={() => setOpen(false)} label={t("streaks.share.sheetTitle")}>
        <SheetTitle>{t("streaks.share.sheetTitle")}</SheetTitle>
        <div style={{ background: C.ground, borderRadius: 16, padding: 10, marginTop: 10 }}>
          <ShareThings onBeforeShare={() => setOpen(false)} />
        </div>
      </Sheet>
    </section>
  );
}
