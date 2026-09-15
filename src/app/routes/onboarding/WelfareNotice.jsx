/* ════════════════════════════════════════════════
   "If a few days feel heavy" — the welfare notice.

   CLAUDE.md: consecutive low-mood days quietly flag staff for human
   outreach, DISCLOSED PLAINLY AT ONBOARDING. The owner: flagging
   people who were never told is not acceptable. So a person is told
   here, once, and the database will not flag anyone until they have
   tapped "I understand" (0182 records it; 0183 only counts mood
   entries from that day on).

   Where it appears:
     - in FirstRun, straight after the first mood tap — the moment mood
       logging is introduced;
     - for an Icon who finished onboarding before this existed, as a
       gate in front of Home and the daily log (HomeRoutes), the next
       time they open either, before mood logging carries on.

   It is told, not asked. The spec implies no opt-out of a check-in,
   so there is no second button; the one button records that they read
   it and lets them carry on. It never blocks the app: if recording
   fails they go on anyway and simply see this again next time.

   Plain words, no clinical framing, nothing about "monitoring". What
   staff see is said exactly: that low days happened in a row — never
   the moods, the notes, or any other log.
   ════════════════════════════════════════════════ */

import { useState } from "react";
import { APP_COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { useSession } from "../../lib/session.jsx";
import supabase from "../../lib/supabase.js";

export async function acknowledgeWelfareNotice() {
  const { data, error } = await supabase.rpc("acknowledge_welfare_notice");
  if (error) throw error;
  return data;
}

/* The same full page in FirstRun and in the gate for existing Icons —
   one notice, one look, wherever it is met. No app header: like
   FirstRun, a gate with navigation in it is not a gate. */
export default function WelfareNotice({ onDone }) {
  const { t, ts, meta } = useI18n();
  const { refreshProfile } = useSession();
  const [busy, setBusy] = useState(false);

  const ok = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await acknowledgeWelfareNotice();
      /* So the stamp is on the profile the rest of the app holds, and
         the gate stays gone after Home is left and opened again. */
      refreshProfile?.();
    } catch {
      /* Never a dead end: they have read it. The stamp is simply not
         recorded, so they will meet this again next time — and until it
         is recorded, nobody can be flagged. */
    }
    setBusy(false);
    onDone?.();
  };

  const para = {
    margin: 0,
    fontSize: ts(A11Y.minBodyPx + 1),
    color: C.textMain,
    lineHeight: meta.dir === "rtl" ? meta.lineHeight + 0.3 : 1.6,
    textAlign: "start",
  };

  return (
    <main
      data-welfare-notice
      style={{
        minHeight: "100vh",
        background: C.bg,
        fontFamily: meta.fonts.body,
        color: C.textMain,
        fontSize: ts(A11Y.minBodyPx),
        padding: "20px 18px calc(28px + env(safe-area-inset-bottom, 0px))",
        maxWidth: 560,
        margin: "0 auto",
        boxSizing: "border-box",
      }}
    >
      <section style={{ display: "flex", flexDirection: "column", gap: 16, padding: "8px 0 4px" }}>
        <h1
          style={{
            fontFamily: meta.fonts.heading,
            fontSize: ts(30),
            fontWeight: 700,
            color: C.green,
            margin: 0,
            lineHeight: meta.dir === "rtl" ? meta.lineHeight + 0.2 : 1.3,
            textAlign: "center",
          }}
        >
          {t("welfare.notice.title")}
        </h1>

        <p style={para}>{t("welfare.notice.body")}</p>
        <p style={para}>{t("welfare.notice.onlyThat")}</p>
        <p style={para}>{t("welfare.notice.aPerson")}</p>
        <p style={para}>{t("welfare.notice.noMessage")}</p>
        <p
          style={{
            ...para,
            fontSize: ts(A11Y.minBodyPx),
            color: C.textMuted,
            borderInlineStart: `4px solid ${C.warmGray}`,
            paddingInlineStart: 12,
          }}
        >
          {t("welfare.notice.urgent")}
        </p>

        <button
          type="button"
          onClick={ok}
          disabled={busy}
          aria-busy={busy}
          data-welfare-ok
          style={{
            width: "100%",
            minHeight: 62,
            marginTop: 6,
            borderRadius: 50,
            border: "none",
            background: C.green,
            color: C.cream,
            fontSize: ts(20),
            fontWeight: 700,
            fontFamily: "inherit",
            cursor: busy ? "default" : "pointer",
            opacity: busy ? 0.7 : 1,
          }}
        >
          {busy ? t("welfare.notice.busy") : t("welfare.notice.ok")}
        </button>
      </section>
    </main>
  );
}
