/* ════════════════════════════════════════════════
   Three things that can be shared — mock screen 9.

   The total that never resets, a streak with its count, and simply a
   good day. Each goes through the composer pattern (shareDraft.js): the
   community composer opens with the real card on it and editable words,
   the person presses Share there, and lands on the post. Nothing leaves
   the phone from here.

   Used on My journey, and inside the sheet Home's "Your days" card opens.
   ════════════════════════════════════════════════ */

import { useNavigate } from "react-router-dom";
import { APP_COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { useSession } from "../../lib/session.jsx";
import { startShareDraft } from "../community/shareDraft.js";
import { useMyStreaks, itemTitle, itemIcon, tn } from "./streaksData.js";
import { Card, Btn, ItemIcon, Muted } from "./ui.jsx";

/* The mock's soft "Share" pill, with a 48px target around it. */
export function SoftPill({ children, onClick, label }) {
  const { ts } = useI18n();
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      style={{ minHeight: 48, minWidth: 48, background: "transparent", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", flexShrink: 0, display: "inline-flex", alignItems: "center" }}
    >
      <span style={{ background: C.selected, color: C.green, borderRadius: 14, padding: "8px 14px", fontSize: ts(A11Y.minBodyPx), fontWeight: 700, whiteSpace: "nowrap" }}>{children}</span>
    </button>
  );
}

export default function ShareThings({ onBeforeShare }) {
  const { t, ts } = useI18n();
  const { profile } = useSession();
  const navigate = useNavigate();
  const { rows, days } = useMyStreaks(profile?.id);
  const n = days ? days.days : null;

  const go = (draft) => {
    if (onBeforeShare) onBeforeShare();
    startShareDraft(navigate, draft);
  };

  return (
    <div data-share-things="">
      <Card style={{ textAlign: "center", padding: "20px 16px" }}>
        <p style={{ margin: 0, fontSize: ts(40), fontWeight: 800, color: C.green, lineHeight: 1.1, fontVariantNumeric: "tabular-nums" }}>{n == null ? "…" : n}</p>
        <p style={{ margin: "6px 0 0", fontSize: ts(A11Y.minBodyPx), color: C.textMuted }}>{tn(t, "streaks.share.daysLabel", n ?? 0)}</p>
        <Btn
          data-share="days_total"
          disabled={n == null}
          onClick={() => go({ type: "days_total", payload: { days: n }, body: t("streaks.share.daysBody") })}
          style={{ marginTop: 14 }}
        >
          {t("streaks.share.daysShare")}
        </Btn>
      </Card>

      {(rows || []).map((s) => {
        const title = itemTitle(t, s.item_key, s.item_name);
        return (
          <Card key={s.id}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <ItemIcon name={itemIcon(s.item_key)} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: ts(18), fontWeight: 700, overflowWrap: "anywhere" }}>{title}</p>
                <p style={{ margin: "2px 0 0", fontSize: ts(A11Y.minBodyPx), color: C.textMuted }}>
                  {s.run > 0
                    ? tn(t, "streaks.share.runLine", s.run, { longest: s.longest })
                    : t("streaks.share.resting", { longest: s.longest })}
                </p>
              </div>
              {s.run > 0 && (
                <SoftPill
                  label={t("streaks.share.shareAria", { item: title })}
                  onClick={() =>
                    go({
                      type: "streak",
                      payload: { item_key: s.item_key, item_name: s.item_name, run: s.run, longest: s.longest },
                      body: t("streaks.share.streakBody"),
                    })
                  }
                >
                  {t("streaks.share.share")}
                </SoftPill>
              )}
            </div>
          </Card>
        );
      })}

      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <ItemIcon name="log" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: ts(18), fontWeight: 700 }}>{t("streaks.share.goodDay")}</p>
            <p style={{ margin: "2px 0 0", fontSize: ts(A11Y.minBodyPx), color: C.textMuted }}>{t("streaks.share.goodDaySub")}</p>
          </div>
          <SoftPill
            label={t("streaks.share.shareAria", { item: t("streaks.share.goodDay") })}
            onClick={() => go({ type: "good_day", payload: {}, body: "" })}
          >
            {t("streaks.share.share")}
          </SoftPill>
        </div>
      </Card>

      <Muted style={{ marginTop: 10 }}>{t("streaks.share.privacy")}</Muted>
    </div>
  );
}
