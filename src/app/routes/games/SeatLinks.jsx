/* ════════════════════════════════════════════════
   The chairs being held by a link — PRODUCT_DECISIONS §17.

   Shown at the table while it waits. Each held seat gets one action:
   send it. On a phone that is the WhatsApp share sheet; where the
   browser has no share sheet it copies, and says which it did rather
   than claiming "Shared!" when it only copied.

   Anyone at the table can re-send — the same rule the join code
   already follows, because a guest inviting the fourth player is the
   point. Re-sending makes a NEW link and kills the old one, which is
   0060's job, not this component's: a person who taps twice must not
   leave two keys in circulation.
   ════════════════════════════════════════════════ */

import { useCallback, useEffect, useState } from "react";
import { COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { pushToast } from "../../lib/feedback.jsx";
import { fetchSeatLinks, createSeatLink } from "../../lib/games.js";
import { Card, BodyText, SectionLabel, GhostBtn } from "./ui.jsx";

const seatUrl = (token) => `${window.location.origin}/app/seat/${token}`;

export default function SeatLinks({ sessionId, gameName }) {
  const { t, ts } = useI18n();
  const [links, setLinks] = useState([]);
  const [busy, setBusy] = useState(null);

  const load = useCallback(() => {
    fetchSeatLinks(sessionId).then(setLinks).catch(() => setLinks([]));
  }, [sessionId]);

  useEffect(load, [load]);

  const send = async (seatNo) => {
    if (busy) return;
    setBusy(seatNo);
    try {
      /* A fresh token every time it is sent. The old one dies in the
         same statement (0060), so the person cannot accidentally have
         two live keys to one chair. */
      const token = await createSeatLink(sessionId, seatNo);
      const url = seatUrl(token);
      const text = t("games.seatLink.shareText", { game: gameName || "" });
      if (navigator.share) {
        try {
          await navigator.share({ title: text, text, url });
          pushToast(t("games.seatLink.sent"), { tone: "success", key: "seatlink" });
        } catch {
          /* The person closed the share sheet. Not a failure, and it
             must not be reported as one. */
        }
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        pushToast(t("games.seatLink.copied"), { tone: "success", key: "seatlink" });
      } else {
        window.prompt(t("games.seatLink.copyPrompt"), url);
      }
      load();
    } catch {
      pushToast(t("games.seatLink.failed"), { tone: "error", key: "seatlink" });
    }
    setBusy(null);
  };

  /* §0.6 — nothing to show means nothing rendered, not an empty box. */
  if (!links.length) return null;

  return (
    <>
      <SectionLabel>{t("games.seatLink.heading")}</SectionLabel>
      {links.map((l) => (
        <Card key={l.seat_no} style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span aria-hidden="true" style={{ fontSize: 24 }}>🔗</span>
            <span style={{ flex: "1 1 150px", minWidth: 0 }}>
              <span style={{ display: "block", fontSize: ts(A11Y.minBodyPx), fontWeight: 700, color: C.textMain }}>
                {t("games.seatLink.seatHeld", { n: l.seat_no })}
              </span>
              <span style={{ display: "block", fontSize: ts(A11Y.minBodyPx), color: C.textMuted }}>
                {t("games.seatLink.firstToOpen")}
              </span>
            </span>
            <GhostBtn onClick={() => send(l.seat_no)} disabled={busy === l.seat_no}>
              {busy === l.seat_no ? "…" : t("games.seatLink.send")}
            </GhostBtn>
          </div>
        </Card>
      ))}
    </>
  );
}
