/* ════════════════════════════════════════════════
   "Can people add your name to their posts?" — POSTS_SPEC §5.

   §5 gives the tagged person three things: a notification, a way to
   remove the tag, and the ability to turn tagging off ENTIRELY. This
   is the third, and it is the strongest of them — the other two are
   remedies after the fact, this one is consent before it.

   It is a real gate, not a display preference: 0077's insert policy
   checks allow_tagging, so with this off a post_tags row cannot be
   written at all. The composer's picker will simply not offer you.

   Off is a quiet, ordinary choice here. There is no warning about
   missing out, and no count of how many times somebody has been
   tagged — a number would turn a privacy switch into a scoreboard.
   ════════════════════════════════════════════════ */

import { useCallback, useEffect, useState } from "react";
import { APP_COLORS as C, A11Y } from "../../shared/tokens.js";
import { useI18n } from "../lib/i18n.jsx";
import { useSession } from "../lib/session.jsx";
import supabase from "../lib/supabase.js";

export default function TaggingSetting() {
  const { t, ts } = useI18n();
  const { profile } = useSession();
  const myId = profile?.id;

  const [on, setOn] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!myId) return;
    const { data } = await supabase
      .from("profiles")
      .select("allow_tagging")
      .eq("id", myId)
      .maybeSingle();
    setOn(data?.allow_tagging !== false);
  }, [myId]);
  useEffect(() => { load(); }, [load]);

  if (on === null) return null;

  const flip = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    const next = !on;
    setOn(next);
    const { error: e } = await supabase
      .from("profiles")
      .update({ allow_tagging: next })
      .eq("id", myId);
    if (e) {
      setOn(!next);
      setError("posts.tagging.failed");
    }
    setBusy(false);
  };

  return (
    <section style={{ marginBottom: 34 }}>
      <h2 style={{ fontSize: ts(22), fontWeight: 700, color: C.green, marginBottom: 6 }}>
        {t("posts.tagging.title")}
      </h2>
      <p style={{ fontSize: ts(17), color: C.textMuted, margin: "0 0 14px", lineHeight: 1.55 }}>
        {t("posts.tagging.hint")}
      </p>

      <button
        type="button"
        role="switch"
        aria-checked={on}
        disabled={busy}
        onClick={flip}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          width: "100%",
          minHeight: 62,
          padding: "12px 16px",
          borderRadius: 14,
          border: on ? `3px solid ${C.green}` : `2px solid ${C.warmGray}`,
          background: on ? "#EEF3E8" : C.white,
          fontFamily: "inherit",
          textAlign: "start",
          cursor: "pointer",
        }}
      >
        {/* Never colour alone. */}
        <span aria-hidden="true" style={{ fontSize: ts(20), fontWeight: 800, color: on ? C.green : C.textMuted }}>
          {on ? "✓" : "○"}
        </span>
        <span style={{ fontSize: ts(A11Y.minBodyPx), fontWeight: 700, color: C.textMain }}>
          {t(on ? "posts.tagging.on" : "posts.tagging.off")}
        </span>
      </button>

      {error && (
        <p role="alert" style={{ color: C.brown, fontWeight: 700, fontSize: ts(17), margin: "10px 0 0" }}>
          ⚠ {t(error)}
        </p>
      )}
    </section>
  );
}
