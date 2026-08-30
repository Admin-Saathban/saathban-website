/* ════════════════════════════════════════════════
   "Send a link" — one tap from a waiting table to WhatsApp.

   Takes either the code directly (the lobby knows it) or a session id
   (the invite notification only knows that, and fetches the code when
   tapped — an invitee may read their table, so RLS allows it).

   The button says what happened rather than assuming: the phone's
   share sheet on a phone, the clipboard on a desktop, and the bare
   URL to select by hand if both are refused. Never a silent tap.
   ════════════════════════════════════════════════ */

import { useState } from "react";
import { COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import supabase from "../../lib/supabase.js";
import { shareJoinLink, joinUrl, digitsOnly } from "./joinLink.js";

export default function ShareTableButton({
  code: codeProp,
  sessionId,
  game = null,
  hostName = "",
  compact = false,
  style = {},
}) {
  const { t, ts, lang } = useI18n();
  /* The game's own name, in the sharer's language — it goes into a
     message someone else will read, so "Ludo" or "لوڈو" beats a key. */
  const gameName =
    (lang === "ur" ? game?.name_ur : game?.name_en) || game?.name_en || t("games.title");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [fallbackUrl, setFallbackUrl] = useState("");

  const onShare = async () => {
    if (busy) return;
    setBusy(true);
    setNote("");
    setFallbackUrl("");
    try {
      let code = digitsOnly(codeProp);
      if (code.length < 6 && sessionId) {
        // The notification carries a session, not a code.
        const { data } = await supabase
          .from("game_sessions")
          .select("join_code, status")
          .eq("id", sessionId)
          .maybeSingle();
        code = digitsOnly(data?.join_code);
        if (data && data.status !== "lobby") {
          setNote(t("games.join.shareTooLate"));
          setBusy(false);
          return;
        }
      }
      if (code.length < 6) {
        setNote(t("games.join.shareUnavailable"));
        setBusy(false);
        return;
      }

      const how = await shareJoinLink({
        code,
        title: t("games.join.shareTitle", { game: gameName }),
        text: hostName
          ? t("games.join.shareTextHost", { host: hostName, game: gameName })
          : t("games.join.shareText", { game: gameName }),
      });
      if (how === "shared") setNote("");
      else if (how === "copied") setNote(t("games.join.copied"));
      else if (how === "unavailable") {
        setNote(t("games.join.copyFailed"));
        setFallbackUrl(joinUrl(code));
      }
    } catch {
      setNote(t("games.join.shareUnavailable"));
    }
    setBusy(false);
  };

  return (
    <div style={{ ...style }}>
      <button
        type="button"
        onClick={onShare}
        disabled={busy}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          minHeight: A11Y.minTapTargetPx,
          padding: compact ? "0 16px" : "0 22px",
          borderRadius: 50,
          border: `2px solid ${C.green}`,
          background: C.white,
          color: C.green,
          fontSize: ts(compact ? 16 : A11Y.minBodyPx),
          fontWeight: 700,
          fontFamily: "inherit",
          cursor: busy ? "default" : "pointer",
        }}
      >
        <span aria-hidden="true">📤</span> {t("games.join.sendLink")}
      </button>
      {note && (
        <p role="status" style={{ fontSize: ts(16), color: C.textMuted, margin: "8px 0 0" }}>
          {note}
        </p>
      )}
      {fallbackUrl && (
        <p
          dir="ltr"
          style={{
            fontSize: ts(15),
            color: C.textMain,
            background: C.bg,
            border: `1px solid ${C.warmGray}`,
            borderRadius: 10,
            padding: "8px 10px",
            margin: "6px 0 0",
            overflowWrap: "anywhere",
            userSelect: "all",
          }}
        >
          {fallbackUrl}
        </p>
      )}
    </div>
  );
}
