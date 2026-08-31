/* ════════════════════════════════════════════════
   Say hello — POSTS_SPEC.md §9.1.

   NOT AN INSTANT SEND. The sheet opens with a message already written
   in the box and the cursor in it. Nothing leaves until Send is
   pressed, and closing the sheet means nothing happened. That is the
   whole design: the hard part of getting back in touch is the first
   sentence, so the app writes a draft and hands it over — it does not
   speak on anybody's behalf.

   THE LINE ROTATES. Four variants, one picked per opening. Without
   that, Nasreen receives the identical sentence from four different
   people in a week and the warmth turns into a robot. It is a draft to
   edit, which is also why it is never sent as-is by the app.

   Sending closes the sheet and OPENS THE CHAT with the message in it
   (§9.1, and MOTION_SPEC §7: every action ends where its result
   lives). No toast — the message sitting in the thread is the receipt.

   The mic and photo glyphs sit beside Send and take you into the chat
   with those tools, rather than growing a second recorder and a second
   uploader inside a sheet that is meant to hold one decision.
   ════════════════════════════════════════════════ */

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { APP_COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { useSession } from "../../lib/session.jsx";
import { MotionStyles } from "../../lib/motion.jsx";
import { openDmWith } from "../people/peopleStore.js";
import { sendDeep } from "../people/myPeopleStore.js";

const VARIANTS = ["a", "b", "c", "d"];

export default function SayHelloSheet({ person, onClose }) {
  const { t, ts, meta } = useI18n();
  const { profile } = useSession();
  const navigate = useNavigate();
  const boxRef = useRef(null);

  const first = (person?.full_name || "").trim().split(" ")[0];
  /* Chosen once per opening, not per render. */
  const [variant] = useState(() => VARIANTS[Math.floor(Math.random() * VARIANTS.length)]);
  const [text, setText] = useState(() => t(`msg.hello.line_${variant}`, { name: first }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    /* Cursor in the box, at the end, so it reads as a draft of theirs
       rather than a message from the app they have to clear first. */
    const el = boxRef.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    const n = el.value.length;
    try { el.setSelectionRange(n, n); } catch { /* not all browsers */ }
  }, []);

  const goToChat = async (andSend) => {
    if (busy || !person?.id) return;
    setBusy(true);
    setError("");
    try {
      const requestId = await openDmWith(person.id);
      if (andSend && text.trim()) {
        await sendDeep(requestId, profile.id, { body: text.trim() });
      }
      onClose?.();
      navigate(`/app/people/${person.id}/chat`);
    } catch (err) {
      setError(err.message || t("msg.hello.failed"));
      setBusy(false);
    }
  };

  const glyph = {
    minWidth: A11Y.minTapTargetPx,
    minHeight: A11Y.minTapTargetPx,
    borderRadius: 50,
    border: `2px solid ${C.warmGray}`,
    background: C.white,
    color: C.textMain,
    fontSize: ts(20),
    cursor: "pointer",
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("msg.hello.title", { name: first })}
      onClick={onClose}
      className="sb-dim"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 80,
        background: "rgba(45,36,24,0.45)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
    >
      <MotionStyles />
      <div
        onClick={(e) => e.stopPropagation()}
        className="sb-sheet"
        dir={meta.dir}
        style={{
          width: "100%",
          maxWidth: 640,
          background: C.bg,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          padding: "18px 16px calc(18px + env(safe-area-inset-bottom))",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <h2 style={{ flex: 1, margin: 0, fontFamily: meta.fonts.heading, fontSize: ts(21), fontWeight: 800, color: C.green }}>
            {t("msg.hello.title", { name: first })}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("msg.hello.close")}
            style={{ ...glyph, border: "none", background: "transparent" }}
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>

        <textarea
          ref={boxRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          maxLength={1000}
          dir={meta.dir}
          style={{
            width: "100%",
            boxSizing: "border-box",
            fontFamily: "inherit",
            fontSize: ts(A11Y.minBodyPx),
            lineHeight: 1.5,
            color: C.textMain,
            background: C.white,
            border: `2px solid ${C.warmGray}`,
            borderRadius: 14,
            padding: "12px 14px",
            resize: "vertical",
            textAlign: "start",
          }}
        />

        {error && (
          <p role="alert" style={{ color: C.brown, fontWeight: 700, fontSize: ts(16), margin: "8px 0 0" }}>
            ⚠ {error}
          </p>
        )}

        <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 12 }}>
          <button type="button" style={glyph} aria-label={t("msg.hello.voice")} onClick={() => goToChat(false)}>
            <span aria-hidden="true">🎤</span>
          </button>
          <button type="button" style={glyph} aria-label={t("msg.hello.photo")} onClick={() => goToChat(false)}>
            <span aria-hidden="true">📷</span>
          </button>
          <button
            type="button"
            onClick={() => goToChat(true)}
            disabled={busy || !text.trim()}
            style={{
              flex: 1,
              minHeight: 56,
              borderRadius: 50,
              border: "none",
              background: C.green,
              color: C.cream,
              fontFamily: "inherit",
              fontSize: ts(A11Y.minBodyPx),
              fontWeight: 800,
              opacity: busy || !text.trim() ? 0.6 : 1,
              cursor: busy || !text.trim() ? "default" : "pointer",
            }}
          >
            {busy ? "…" : t("msg.hello.send")}
          </button>
        </div>
      </div>
    </div>
  );
}
