/* ════════════════════════════════════════════════
   The first three screens — PRODUCT_DECISIONS §2.

   1. "How are you today?"  — five faces, one tap, a warm response.
   2. "Here's what we'll keep track of" — three on, three shown off.
   3. "Who should we let in?" — one field, one big Skip for now.

   THEY LEARN THE LOOP BY DOING IT. Screen one is not a demonstration
   of the daily log; it IS the daily log, writing a real entry for
   today. So the home screen behind this already has something on it
   before they ever reach it, and the first thing they were asked to
   do turned out to be the whole habit.

   WARMTH COMES FROM RESPONDING, NOT CONFIRMING (§5). The answer to a
   tap is "Achha laga sun kar" — not "logged ✓". A tick is a receipt;
   a receipt is what a form gives you.

   NEVER FORCE A LONELY PERSON TO ADMIT THEY HAVE NOBODY. Screen three
   asks once, and "Skip for now" is a full-width button of the same
   weight as the invite — not a grey link under it. §0.6: an empty
   state is a door, never a scoreboard, and the door has to be as easy
   to walk through as the other one.

   ONE PATH ONLY (§2). There is no branch for "alone" vs "helped by
   family" vs "at an event". A person setting this up for their mother
   sees exactly what their mother would see, which is the only way the
   assisted case cannot drift from the solo one.

   IT IS A GATE, NOT A ROUTE. Mounted by IconHome when the profile has
   no `onboarded_at` stamp, so it needs no entry in the router and
   cannot be reached by anyone who has already finished it. The stamp
   lives in profiles.settings, which is jsonb and already NOT NULL — no
   schema for a thing that is only ever true once.
   ════════════════════════════════════════════════ */

import { useState } from "react";
import { COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { MOODS, isoDate } from "../home/homeMock.js";
import { useDailyLogs } from "../home/logStore.js";
import { useIconPrefs, toggleModule } from "../../lib/iconPrefs.js";
import supabase from "../../lib/supabase.js";
import AppHeader from "../../components/AppHeader.jsx";

/* §5's defaults, named here so screen two shows the same three on and
   the same three off that the log itself will use. */
export const ON_AT_START = ["mood", "sleep", "water"];
export const SHOWN_BUT_OFF = ["medication", "diet", "exercise"];

export async function stampOnboarded(profileId, settings) {
  await supabase
    .from("profiles")
    .update({ settings: { ...(settings || {}), onboarded_at: new Date().toISOString() } })
    .eq("id", profileId);
}

function Screen({ title, children, note }) {
  const { ts, meta } = useI18n();
  return (
    <>
    <AppHeader />
    <main
      style={{
        minHeight: "100vh",
        background: C.bg,
        fontFamily: meta.fonts.body,
        color: C.textMain,
        fontSize: ts(A11Y.minBodyPx),
        padding: "20px 18px calc(28px + env(safe-area-inset-bottom, 0px))",
        maxWidth: 560,
        margin: "0 auto",
      }}
    >
    <section
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 18,
        padding: "8px 0 4px",
        textAlign: "center",
      }}
    >
      <h1
        style={{
          fontFamily: meta.fonts.heading,
          fontSize: ts(30),
          fontWeight: 700,
          color: C.green,
          margin: 0,
          lineHeight: 1.3,
        }}
      >
        {title}
      </h1>
      {note && (
        <p style={{ margin: 0, fontSize: ts(A11Y.minBodyPx), color: C.textMuted, lineHeight: 1.55 }}>
          {note}
        </p>
      )}
      {children}
    </section>
    </main>
    </>
  );
}

function BigButton({ onClick, children, primary = true, disabled }) {
  const { ts } = useI18n();
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        width: "100%",
        minHeight: 62,
        borderRadius: 50,
        border: primary ? "none" : `2px solid ${C.warmGray}`,
        background: primary ? C.green : C.white,
        color: primary ? C.cream : C.textMain,
        fontSize: ts(20),
        fontWeight: 700,
        fontFamily: "inherit",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.55 : 1,
      }}
    >
      {children}
    </button>
  );
}

export default function FirstRun({ profile, onDone }) {
  const { t, ts } = useI18n();
  const { writeEntry } = useDailyLogs(profile.id);
  const prefs = useIconPrefs(profile.id);

  const [step, setStep] = useState(1);
  const [picked, setPicked] = useState(null);
  const [invite, setInvite] = useState("");
  const [busy, setBusy] = useState(false);

  /* Screen one writes a REAL entry. If this were a mock, the home
     screen behind it would be empty on arrival and the first thing
     they did would have been a rehearsal. */
  const pickMood = (id) => {
    if (picked) return;
    setPicked(id);
    try {
      writeEntry(isoDate(new Date()), "mood", { choices: [id] });
    } catch {
      /* The log queues offline and syncs later; a failure here must
         not strand somebody on their first screen. */
    }
  };

  const finish = async () => {
    setBusy(true);
    try {
      await stampOnboarded(profile.id, profile.settings);
    } catch {
      /* If the stamp fails they simply meet this again — annoying,
         never broken, and far better than a dead end on day one. */
    }
    setBusy(false);
    onDone?.();
  };

  if (step === 1) {
    return (
      <Screen title={t("onboarding.mood.title")}>
        <div
          role="group"
          aria-label={t("onboarding.mood.title")}
          style={{ display: "flex", justifyContent: "center", gap: 6, flexWrap: "wrap" }}
        >
          {MOODS.map((m) => {
            const chosen = picked === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => pickMood(m.id)}
                aria-pressed={chosen}
                aria-label={t(m.labelKey)}
                style={{
                  minWidth: 64,
                  minHeight: 78,
                  borderRadius: 18,
                  border: `2px solid ${chosen ? C.green : C.warmGray}`,
                  background: chosen ? "#fffdf5" : C.white,
                  cursor: picked ? "default" : "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 2,
                  padding: 4,
                  opacity: picked && !chosen ? 0.45 : 1,
                }}
              >
                <span aria-hidden="true" style={{ fontSize: 30, lineHeight: 1 }}>{m.face}</span>
                <span style={{ fontSize: ts(A11Y.minBodyPx), fontWeight: 600, color: C.textMain }}>
                  {t(m.labelKey)}
                </span>
              </button>
            );
          })}
        </div>

        {picked && (
          <>
            {/* Responding, not confirming. */}
            <p role="status" style={{ margin: 0, fontSize: ts(21), fontWeight: 600, color: C.green }}>
              {t("onboarding.mood.response")}
            </p>
            <p style={{ margin: 0, fontSize: ts(A11Y.minBodyPx), color: C.textMuted }}>
              {t("onboarding.mood.firstDay")}
            </p>
            <BigButton onClick={() => setStep(2)}>{t("onboarding.next")}</BigButton>
          </>
        )}
      </Screen>
    );
  }

  if (step === 2) {
    const enabled = new Set(prefs?.enabledModules || ON_AT_START);
    const row = (id, on) => (
      <li
        key={id}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "12px 14px",
          borderRadius: 16,
          border: `2px solid ${on ? C.sage : C.warmGray}`,
          background: on ? "#fffdf5" : C.white,
          marginBottom: 8,
          textAlign: "start",
        }}
      >
        <span aria-hidden="true" style={{ fontSize: ts(22) }}>{on ? "✓" : "○"}</span>
        <span style={{ flex: 1, fontSize: ts(A11Y.minBodyPx), fontWeight: 600, color: C.textMain }}>
          {t(`onboarding.modules.${id}`)}
        </span>
        <span style={{ fontSize: ts(A11Y.minBodyPx), color: C.textMuted }}>
          {on ? t("onboarding.modules.on") : t("onboarding.modules.off")}
        </span>
      </li>
    );

    return (
      <Screen title={t("onboarding.modules.title")} note={t("onboarding.modules.changeAny")}>
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {ON_AT_START.map((id) => row(id, enabled.has(id) || ON_AT_START.includes(id)))}
          {SHOWN_BUT_OFF.map((id) => row(id, enabled.has(id)))}
        </ul>
        <BigButton onClick={() => setStep(3)}>{t("onboarding.modules.cta")}</BigButton>
      </Screen>
    );
  }

  return (
    <Screen title={t("onboarding.invite.title")} note={t("onboarding.invite.note")}>
      <div style={{ textAlign: "start" }}>
        <label
          htmlFor="onboard-invite"
          style={{ display: "block", fontSize: ts(A11Y.minBodyPx), fontWeight: 600, marginBottom: 6 }}
        >
          {t("onboarding.invite.label")}
        </label>
        <input
          id="onboard-invite"
          value={invite}
          onChange={(e) => setInvite(e.target.value)}
          inputMode="email"
          autoComplete="off"
          placeholder={t("onboarding.invite.placeholder")}
        />
      </div>

      <BigButton onClick={finish} disabled={busy || !invite.trim()}>
        {t("onboarding.invite.send")}
      </BigButton>
      {/* The same weight as the invite, not a grey link beneath it. */}
      <BigButton onClick={finish} primary={false} disabled={busy}>
        {t("onboarding.invite.skip")}
      </BigButton>
    </Screen>
  );
}
