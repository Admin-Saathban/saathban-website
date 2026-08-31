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
import { APP_COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { LOCALES } from "../../locales/index.js";
import { MOODS, isoDate, greetingKeyForHour } from "../home/homeMock.js";
import { useDailyLogs } from "../home/logStore.js";
import { useIconPrefs, toggleModule } from "../../lib/iconPrefs.js";
import supabase from "../../lib/supabase.js";

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
    {/* NO APP HEADER. This is a GATE, and a gate with navigation in
        it is not a gate.

        It used to draw one, from when the header was a mark and a
        back arrow. Rebuilding the header on 30 August gave it an
        avatar, search, a bell and messages — four ways out of a
        screen nobody has finished — and nothing failed, because the
        onboarding gate is a conditional render inside HomeRoutes
        rather than a route, so no prefix rule could ever have
        noticed. Found by looking at the §9 screenshot. */}
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
  const { t, ts, lang, setLang } = useI18n();
  const { writeEntry } = useDailyLogs(profile.id);
  const prefs = useIconPrefs(profile.id);

  const [step, setStep] = useState(0);
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

  /* ── §9: THE LANGUAGE SCREEN, AND WHY IT IS FIRST ──

     The switch lives in Settings only — the owner ruled out a flag or
     an ا/A in the header. That leaves one real risk, which §9 names:
     somebody opens the app in a language they cannot read and cannot
     find the setting that would fix it. Everything else on this
     screen assumes you can read the screen.

     So it is chosen BY LOOKING, NOT BY READING A LANGUAGE NAME. Each
     card is a live sample of the real interface in that script — the
     actual greeting and the actual log line, in that language's own
     font. A person who reads neither Latin nor Nastaliq still sees
     two shapes and knows which one is theirs. "English" and "اردو"
     are on the cards too, but they are the caption, not the choice.

     It says where to change it later, because §9 requires that, and
     because a person who taps the wrong one must not be trapped.

     Asked once. The onboarding stamp gates this whole flow, so it
     never appears again. */
  if (step === 0) {
    const sample = (code) => ({
      dir: code === "ur" ? "rtl" : "ltr",
      font: LOCALES[code].meta.fonts.body,
      /* The REAL greeting for the real hour, so the preview is the
         screen they are about to see rather than a specimen. */
      greeting: LOCALES[code].strings.home[greetingKeyForHour(new Date().getHours()).split(".")[1]],
      line: LOCALES[code].strings.hub.logLine
        .replace("{done}", code === "ur" ? "١" : "1")
        .replace("{total}", code === "ur" ? "٢" : "2"),
      label: LOCALES[code].meta.label,
    });
    return (
      <Screen title={t("onboarding.language.title")} note={t("onboarding.language.later")}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {["en", "ur"].map((code) => {
            const sp = sample(code);
            return (
              <button
                key={code}
                type="button"
                onClick={() => {
                  setLang(code);
                  setStep(1);
                }}
                lang={code}
                dir={sp.dir}
                aria-label={LOCALES[code].meta.label}
                style={{
                  width: "100%",
                  textAlign: sp.dir === "rtl" ? "right" : "left",
                  padding: "18px 20px",
                  borderRadius: 18,
                  /* An outline, because it IS the control — §4.1. The
                     current language keeps a thicker one so the
                     default is visible without being preselected. */
                  border:
                    lang === code ? `3px solid ${C.green}` : `2px solid ${C.warmGray}`,
                  background: C.white,
                  color: C.textMain,
                  cursor: "pointer",
                  fontFamily: sp.font,
                }}
              >
                <span
                  style={{
                    display: "block",
                    fontSize: 26,
                    fontWeight: 700,
                    color: C.green,
                    lineHeight: LOCALES[code].meta.lineHeight + 0.4,
                  }}
                >
                  {sp.greeting}
                </span>
                <span
                  style={{
                    display: "block",
                    fontSize: 17,
                    color: C.textMuted,
                    marginTop: 2,
                    lineHeight: LOCALES[code].meta.lineHeight,
                  }}
                >
                  {sp.line}
                </span>
                <span
                  style={{
                    display: "block",
                    marginTop: 10,
                    fontSize: 15,
                    fontWeight: 700,
                    color: C.textMain,
                  }}
                >
                  {sp.label}
                </span>
              </button>
            );
          })}
        </div>
      </Screen>
    );
  }

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
