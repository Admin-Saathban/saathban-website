/* ════════════════════════════════════════════════
   Account and privacy — TONIGHT.md LANE 2 §7.

   Settings had a language toggle, a text size and a messaging rule,
   and nothing at all about the account itself. A person who signed up
   with a magic link had no way to set a password, no way to see which
   email address they were using, and no way to sign out except the
   header menu that §3 has now removed.

   EVERY SETTING STATES PLAINLY WHAT IT DOES. §7 says no bare toggles,
   and that rule bites hardest here: "Who can see my profile" with two
   options and no sentence is a question a person answers wrongly and
   never revisits. So each control carries its consequence in words.

   THE PASSWORD SECTION CHANGES ITS OWN NAME. Somebody who has never
   had one is not "changing" it, and asking them to type a current
   password they were never given is the kind of dead end that ends an
   evening. Supabase reports whether the account carries a password
   identity, so the screen asks the right question rather than a
   generic one.

   NOTHING HERE IS HIDDEN BEHIND AN UNMET REQUIREMENT (§6's rule,
   which applies everywhere and not only to invites): every control is
   visible, and one that cannot act yet says why when you touch it.
   ════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { COLORS as C, A11Y } from "../../shared/tokens.js";
import { useI18n } from "../lib/i18n.jsx";
import { useSession } from "../lib/session.jsx";
import supabase from "../lib/supabase.js";
import InfoPanel from "../components/InfoPanel.jsx";

const PROFILE_VISIBILITY = ["members", "connections"];
const CHECKIN_VISIBILITY = ["circle", "connections", "nobody"];

function Row({ children }) {
  return <div style={{ marginBottom: 18 }}>{children}</div>;
}

function Choice({ name, options, value, onPick, labelFor, hintFor, ts }) {
  return (
    <div role="radiogroup" aria-label={name} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {options.map((id) => {
        const on = value === id;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onPick(id)}
            style={{
              textAlign: "start",
              minHeight: A11Y.minTapTargetPx,
              padding: "12px 16px",
              borderRadius: 16,
              border: `${on ? 3 : 2}px solid ${on ? C.green : C.warmGray}`,
              background: on ? "#fffdf5" : C.white,
              color: C.textMain,
              fontFamily: "inherit",
              cursor: "pointer",
            }}
          >
            <span style={{ display: "block", fontSize: ts(A11Y.minBodyPx), fontWeight: 700 }}>
              {on ? "✓ " : ""}
              {labelFor(id)}
            </span>
            {/* The consequence, in words. §7: no bare toggles. */}
            <span style={{ display: "block", fontSize: ts(A11Y.minBodyPx), color: C.textMuted, lineHeight: 1.5 }}>
              {hintFor(id)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default function AccountSettings() {
  const { t, ts } = useI18n();
  const { profile, refreshProfile } = useSession();

  const [email, setEmail] = useState("");
  const [hasPassword, setHasPassword] = useState(null);
  const [newEmail, setNewEmail] = useState("");
  const [pw, setPw] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleteInfo, setDeleteInfo] = useState(false);

  const settings = profile?.settings || {};
  const profileVis = settings.profile_visibility || "members";
  const checkinVis = settings.checkin_visibility || "circle";

  useEffect(() => {
    let alive = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!alive) return;
      setEmail(data?.user?.email || "");
      /* Whether this account can sign in with a password at all. It
         decides which question the section asks, so a link-only
         account is never asked for a password it does not have. */
      const ids = data?.user?.identities || [];
      setHasPassword(ids.some((i) => i.provider === "email") && !!data?.user?.email);
    });
    return () => {
      alive = false;
    };
  }, []);

  const saveSetting = async (key, value) => {
    setErr("");
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ settings: { ...settings, [key]: value } })
        .eq("id", profile.id);
      if (error) throw error;
      await refreshProfile();
      setNote(t("settings.account.saved"));
    } catch {
      setErr(t("settings.account.saveFailed"));
    }
  };

  const changeEmail = async () => {
    setErr(""); setNote("");
    if (!newEmail.trim() || !newEmail.includes("@")) return setErr(t("settings.account.emailInvalid"));
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
      if (error) throw error;
      /* Supabase sends a confirmation to BOTH addresses; nothing has
         changed until it is opened, and saying so is the difference
         between a person waiting calmly and a person trying again. */
      setNote(t("settings.account.emailSent", { email: newEmail.trim() }));
      setNewEmail("");
    } catch {
      setErr(t("settings.account.emailFailed"));
    }
    setBusy(false);
  };

  const changePassword = async () => {
    setErr(""); setNote("");
    if (pw.length < 8) return setErr(t("settings.account.pwShort"));
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) throw error;
      setPw("");
      setNote(hasPassword ? t("settings.account.pwChanged") : t("settings.account.pwSet"));
      setHasPassword(true);
    } catch {
      setErr(t("settings.account.pwFailed"));
    }
    setBusy(false);
  };

  const input = {
    width: "100%",
    minHeight: A11Y.minTapTargetPx,
    boxSizing: "border-box",
    padding: "10px 14px",
    borderRadius: 12,
    border: `2px solid ${C.warmGray}`,
    background: C.white,
    color: C.textMain,
    fontFamily: "inherit",
    fontSize: ts(A11Y.minBodyPx),
  };
  const btn = (primary = true) => ({
    minHeight: A11Y.minTapTargetPx,
    padding: "0 20px",
    marginTop: 10,
    borderRadius: 50,
    border: primary ? "none" : `2px solid ${C.warmGray}`,
    background: primary ? C.green : C.white,
    color: primary ? C.cream : C.textMain,
    fontSize: ts(A11Y.minBodyPx),
    fontWeight: 700,
    fontFamily: "inherit",
    cursor: busy ? "default" : "pointer",
    opacity: busy ? 0.6 : 1,
  });
  const label = { display: "block", fontSize: ts(A11Y.minBodyPx), fontWeight: 600, marginBottom: 6 };
  const hint = { fontSize: ts(A11Y.minBodyPx), color: C.textMuted, margin: "6px 0 0", lineHeight: 1.5 };

  return (
    <>
      {err && (
        <p role="alert" style={{ fontSize: ts(A11Y.minBodyPx), color: C.brown, fontWeight: 700, margin: "0 0 12px" }}>
          {err}
        </p>
      )}
      {note && (
        <p role="status" style={{ fontSize: ts(A11Y.minBodyPx), color: C.green, fontWeight: 700, margin: "0 0 12px" }}>
          {note}
        </p>
      )}

      <Row>
        <span style={label}>{t("settings.account.emailLabel")}</span>
        <p style={{ ...hint, margin: "0 0 8px", color: C.textMain, fontWeight: 600 }} dir="ltr">
          {email || "—"}
        </p>
        <label htmlFor="set-email" style={label}>{t("settings.account.emailChange")}</label>
        <input id="set-email" type="email" inputMode="email" style={input}
               value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
        <p style={hint}>{t("settings.account.emailHint")}</p>
        <button type="button" style={btn()} disabled={busy} onClick={changeEmail}>
          {t("settings.account.emailCta")}
        </button>
      </Row>

      <Row>
        {/* The heading itself changes: somebody who has never had a
            password is not changing one. */}
        <label htmlFor="set-pw" style={label}>
          {hasPassword === false ? t("settings.account.pwSetTitle") : t("settings.account.pwChangeTitle")}
        </label>
        <input id="set-pw" type="password" autoComplete="new-password" style={input}
               value={pw} onChange={(e) => setPw(e.target.value)} />
        <p style={hint}>
          {hasPassword === false ? t("settings.account.pwSetHint") : t("settings.account.pwChangeHint")}
        </p>
        <button type="button" style={btn()} disabled={busy} onClick={changePassword}>
          {hasPassword === false ? t("settings.account.pwSetCta") : t("settings.account.pwChangeCta")}
        </button>
      </Row>

      <Row>
        <span style={label}>{t("settings.privacy.profileTitle")}</span>
        <Choice
          name={t("settings.privacy.profileTitle")}
          options={PROFILE_VISIBILITY}
          value={profileVis}
          onPick={(v) => saveSetting("profile_visibility", v)}
          labelFor={(id) => t(`settings.privacy.profile.${id}`)}
          hintFor={(id) => t(`settings.privacy.profileHint.${id}`)}
          ts={ts}
        />
      </Row>

      <Row>
        <span style={label}>{t("settings.privacy.checkinTitle")}</span>
        <Choice
          name={t("settings.privacy.checkinTitle")}
          options={CHECKIN_VISIBILITY}
          value={checkinVis}
          onPick={(v) => saveSetting("checkin_visibility", v)}
          labelFor={(id) => t(`settings.privacy.checkin.${id}`)}
          hintFor={(id) => t(`settings.privacy.checkinHint.${id}`)}
          ts={ts}
        />
      </Row>

      <Row>
        <span style={label}>{t("settings.notify.title")}</span>
        <p style={hint}>{t("settings.notify.hint")}</p>
        <Link to="/app/notifications/settings" style={{ ...btn(false), display: "inline-flex", alignItems: "center", textDecoration: "none" }}>
          {t("settings.notify.cta")}
        </Link>
      </Row>

      <Row>
        <button
          type="button"
          onClick={async () => {
            try { await supabase.auth.signOut(); } catch { /* already out */ }
            window.location.assign("/app/auth");
          }}
          style={{ ...btn(false), width: "100%", marginTop: 0 }}
        >
          {t("auth.welcome.signOut")}
        </button>
        <p style={hint}>{t("settings.account.deleteHint")}</p>
        <button
          type="button"
          onClick={() => setDeleteInfo(true)}
          style={{
            background: "none", border: "none", padding: "8px 0",
            minHeight: A11Y.minTapTargetPx,
            fontSize: ts(A11Y.minBodyPx), color: C.brown, fontWeight: 600,
            fontFamily: "inherit", cursor: "pointer", textDecoration: "underline",
          }}
        >
          {t("settings.account.deleteCta")}
        </button>
        <InfoPanel
          open={deleteInfo}
          title={t("settings.account.deleteTitle")}
          body={t("settings.account.deleteBody")}
          onClose={() => setDeleteInfo(false)}
        />
      </Row>
    </>
  );
}
