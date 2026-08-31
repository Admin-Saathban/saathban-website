/* ════════════════════════════════════════════════
   Who may send you a first message — the setting, in Settings.

   PRODUCT_DECISIONS §6 gives this one word for word: three options,
   "People I've met somewhere on Saathban" as the default, and:

     Choosing "Anyone" shows ONE CALM SENTENCE first:
     "You'll get requests from people you haven't met. Saathban never
      asks for money, and neither should anyone here."

   One sentence, and it appears BEFORE the change rather than after it.
   Not a modal full of consequences, not a red warning, not a checkbox
   to acknowledge — the person is choosing to be more open, which is a
   perfectly reasonable thing to choose, and the screen's job is to make
   sure they know what they are choosing while treating them as somebody
   capable of choosing it.

   The other two options change with a single tap and no sentence,
   because narrowing who may reach you needs no warning.

   The setting governs FIRST contact only, which the hint says plainly:
   people already connected can always write, and a reply is never
   gated. send_dm_request enforces all of it (0055); this screen only
   writes the column.

   §10: a circle member may NEVER change this on somebody's behalf. The
   profiles UPDATE policy is self-only, so this writes for the signed-in
   person and nobody else, and a family member wanting it changed must
   go through propose_icon_change (0056) and be told yes.
   ════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { APP_COLORS as C, A11Y } from "../../shared/tokens.js";
import { useI18n } from "../lib/i18n.jsx";
import { useSession } from "../lib/session.jsx";
import supabase from "../lib/supabase.js";

const OPTIONS = [
  { value: "met", labelKey: "settings.whoCanMessage.met", hintKey: "settings.whoCanMessage.metHint", isDefault: true },
  { value: "anyone", labelKey: "settings.whoCanMessage.anyone", hintKey: null, isDefault: false },
  { value: "connected", labelKey: "settings.whoCanMessage.connected", hintKey: null, isDefault: false },
];

export default function WhoCanMessage() {
  const { t, ts } = useI18n();
  const { profile } = useSession();
  const myId = profile?.id;

  const [value, setValue] = useState(null);
  const [asking, setAsking] = useState(false);   // the calm sentence, before "Anyone"
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!myId) return undefined;
    let dead = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("who_can_message")
        .eq("id", myId)
        .maybeSingle();
      if (!dead) setValue(data?.who_can_message || "met");
    })();
    return () => { dead = true; };
  }, [myId]);

  const write = async (next) => {
    setBusy(true);
    setError("");
    const previous = value;
    setValue(next);
    const { error: e } = await supabase
      .from("profiles")
      .update({ who_can_message: next })
      .eq("id", myId);
    if (e) {
      setValue(previous);
      setError("settings.whoCanMessage.error");
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }
    setBusy(false);
    setAsking(false);
  };

  const pick = (next) => {
    if (busy || next === value) return;
    /* The one calm sentence, before the change and not after it. */
    if (next === "anyone") {
      setAsking(true);
      return;
    }
    write(next);
  };

  if (value === null) return null;

  return (
    <section style={{ marginBottom: 34 }}>
      <h2 style={{ fontSize: ts(22), fontWeight: 700, color: C.green, marginBottom: 6 }}>
        {t("settings.whoCanMessage.title")}
      </h2>
      <p style={{ fontSize: ts(17), color: C.textMuted, margin: "0 0 14px", lineHeight: 1.55 }}>
        {t("settings.whoCanMessage.hint")}
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {OPTIONS.map((o) => {
          const on = value === o.value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => pick(o.value)}
              disabled={busy}
              role="radio"
              aria-checked={on}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
                width: "100%",
                minHeight: A11Y.minTapTargetPx,
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
              <span aria-hidden="true" style={{ fontSize: ts(20), color: on ? C.green : C.textMuted, fontWeight: 800 }}>
                {on ? "✓" : "○"}
              </span>
              <span>
                <span style={{ display: "block", fontSize: ts(A11Y.minBodyPx), fontWeight: on ? 800 : 600, color: C.textMain }}>
                  {t(o.labelKey)}
                  {o.isDefault && (
                    <span style={{ fontWeight: 400, color: C.textMuted }}> {t("settings.whoCanMessage.isDefault")}</span>
                  )}
                </span>
                {o.hintKey && (
                  <span style={{ display: "block", fontSize: ts(16), color: C.textMuted, marginTop: 2 }}>
                    {t(o.hintKey)}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {asking && (
        <div
          style={{
            marginTop: 12,
            padding: "14px 16px",
            borderRadius: 14,
            background: C.cream,
            border: `2px solid ${C.warmGray}`,
          }}
        >
          {/* §6's sentence, exactly, and nothing stacked on top of it. */}
          <p style={{ margin: "0 0 12px", fontSize: ts(A11Y.minBodyPx), color: C.textMain, lineHeight: 1.55 }}>
            {t("settings.whoCanMessage.anyoneSentence")}
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => write("anyone")}
              disabled={busy}
              style={{
                minHeight: A11Y.minTapTargetPx, padding: "0 22px", borderRadius: 50, border: "none",
                background: C.green, color: C.cream, fontFamily: "inherit",
                fontSize: ts(A11Y.minBodyPx), fontWeight: 700, cursor: "pointer",
              }}
            >
              {t("settings.whoCanMessage.anyoneConfirm")}
            </button>
            <button
              type="button"
              onClick={() => setAsking(false)}
              style={{
                minHeight: A11Y.minTapTargetPx, padding: "0 22px", borderRadius: 50,
                border: `2px solid ${C.warmGray}`, background: C.white, color: C.textMain,
                fontFamily: "inherit", fontSize: ts(A11Y.minBodyPx), fontWeight: 600, cursor: "pointer",
              }}
            >
              {t("settings.whoCanMessage.keepAsIs")}
            </button>
          </div>
        </div>
      )}

      {saved && (
        <p role="status" style={{ color: C.green, fontWeight: 600, fontSize: ts(17), margin: "10px 0 0" }}>
          ✓ {t("settings.whoCanMessage.saved")}
        </p>
      )}
      {error && (
        <p role="alert" style={{ color: C.brown, fontWeight: 700, fontSize: ts(17), margin: "10px 0 0" }}>
          ⚠ {t(error)}
        </p>
      )}
    </section>
  );
}
