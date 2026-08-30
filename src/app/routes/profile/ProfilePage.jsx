/* ════════════════════════════════════════════════
   Profile screen — view and edit your own safe fields (name, city,
   languages). Any role; the role is shown, respectfully, never as a
   rank. Editing role / tier / admin flags is impossible here — the DB
   forbids it (migration 0002) and this form never offers it.

   Accessibility floors: labelled inputs ≥48px, ≥18px text via ts(),
   visible focus, errors carried in words with role="alert". RTL and
   font come from the LanguageProvider.
   ════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { useSession } from "../../lib/session.jsx";
import { ROLE_DISPLAY } from "../../constants/roles.js";
import { STRINGS } from "./strings.js";
import { fetchMyProfile, updateMyProfile } from "./data.js";
import { LANGUAGES, INTERESTS, ABOUT_PROMPTS } from "./profileFields.js";
import { useI18n as useT } from "../../lib/i18n.jsx";

/* Tappable, multi-select, and never colour alone: a chosen chip
   carries a tick AND a heavier border AND a filled background. */
function ChipGroup({ options, chosen, labelFor, onToggle, ts }) {
  const set = new Set(chosen || []);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
      {options.map((id) => {
        const on = set.has(id);
        return (
          <button
            key={id}
            type="button"
            onClick={() => onToggle(id)}
            aria-pressed={on}
            style={{
              minHeight: A11Y.minTapTargetPx,
              padding: "0 16px",
              borderRadius: 50,
              border: `${on ? 3 : 2}px solid ${on ? C.green : C.warmGray}`,
              background: on ? "#fffdf5" : C.white,
              color: C.textMain,
              fontSize: ts(A11Y.minBodyPx),
              fontWeight: on ? 700 : 500,
              fontFamily: "inherit",
              cursor: "pointer",
            }}
          >
            {on ? "✓ " : ""}
            {labelFor(id)}
          </button>
        );
      })}
    </div>
  );
}

export default function ProfilePage() {
  const { lang, ts, meta } = useI18n();
  const { t } = useT();
  const s = STRINGS[lang] || STRINGS.en;
  const { profile, refreshProfile } = useSession();

  const [form, setForm] = useState(null); // null = loading
  const [role, setRole] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | saving | saved
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!profile?.id) return;
      try {
        const p = await fetchMyProfile(profile.id);
        if (!alive) return;
        setRole(p.role);
        setForm({
          full_name: p.full_name || "",
          city: p.city || "",
          /* Sets, not strings. A free-text box turns "Punjabi" into
             "punjabi", "Panjabi" and "پنجابی", and nothing can match
             on it afterwards — which is the whole point of the field. */
          languages: p.languages || [],
          interests: p.interests || [],
          about: p.about || "",
          about_prompt: p.about_prompt || ABOUT_PROMPTS[0],
        });
      } catch {
        if (alive) setError(s.loadError);
      }
    })();
    return () => {
      alive = false;
    };
  }, [profile?.id, s.loadError]);

  const toggleIn = (field, id) =>
    setForm((f) => {
      const cur = new Set(f[field] || []);
      cur.has(id) ? cur.delete(id) : cur.add(id);
      return { ...f, [field]: [...cur] };
    });

  const onChange = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    setStatus("idle");
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.full_name.trim()) {
      setError(s.nameRequired);
      return;
    }
    setStatus("saving");
    try {
      await updateMyProfile(profile.id, {
        full_name: form.full_name,
        city: form.city,
        languages: form.languages,
        interests: form.interests,
        about: form.about.trim() || null,
        about_prompt: form.about.trim() ? form.about_prompt : null,
      });
      await refreshProfile(); // so the rest of the app sees the new name
      setStatus("saved");
    } catch {
      setStatus("idle");
      setError(s.saveError);
    }
  };

  const labelStyle = { display: "block", fontSize: ts(A11Y.minBodyPx), fontWeight: 600, marginBottom: 6 };
  const inputStyle = {
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
  const hintStyle = { fontSize: ts(16), color: C.textMuted, margin: "6px 0 0", lineHeight: 1.5 };

  return (
    <main style={{ minHeight: "100vh", background: C.bg, color: C.textMain, padding: "20px 16px 64px" }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <h1 style={{ fontFamily: meta.fonts.heading, fontSize: ts(32), fontWeight: 700, color: C.green, margin: "4px 0 6px" }}>
          {s.title}
        </h1>
        <p style={{ fontSize: ts(A11Y.minBodyPx), color: C.textMuted, margin: "0 0 6px" }}>{s.subtitle}</p>
        {role && (
          <p style={{ fontSize: ts(A11Y.minBodyPx), color: C.brown, fontWeight: 600, margin: "0 0 22px" }}>
            {s.roleLine(ROLE_DISPLAY[role] || ROLE_DISPLAY.saath_icon)}
          </p>
        )}

        {form === null ? (
          <p aria-busy="true" style={{ fontSize: ts(A11Y.minBodyPx), color: C.textMuted }}>···</p>
        ) : (
          <form onSubmit={onSubmit} noValidate>
            <div style={{ marginBottom: 20 }}>
              <label htmlFor="pf-name" style={labelStyle}>{s.nameLabel}</label>
              <input id="pf-name" style={inputStyle} value={form.full_name} onChange={onChange("full_name")} autoComplete="name" />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label htmlFor="pf-city" style={labelStyle}>{s.cityLabel}</label>
              <input id="pf-city" style={inputStyle} value={form.city} onChange={onChange("city")} autoComplete="address-level2" />
              <p style={hintStyle}>{s.cityHint}</p>
            </div>

            {/* §8: the highest-value field in the app — it decides
                whether a Buddy can genuinely talk with them. Tapped,
                never typed. */}
            <fieldset style={{ border: "none", padding: 0, margin: "0 0 24px" }}>
              <legend style={labelStyle}>{t("profile.languagesLabel")}</legend>
              <p style={hintStyle}>{t("profile.languagesHint")}</p>
              <ChipGroup
                options={LANGUAGES}
                chosen={form.languages}
                labelFor={(id) => t(`profile.languages.${id}`)}
                onToggle={(id) => toggleIn("languages", id)}
                ts={ts}
              />
            </fieldset>

            <fieldset style={{ border: "none", padding: 0, margin: "0 0 24px" }}>
              <legend style={labelStyle}>{t("profile.interestsLabel")}</legend>
              <p style={hintStyle}>{t("profile.interestsHint")}</p>
              <ChipGroup
                options={INTERESTS}
                chosen={form.interests}
                labelFor={(id) => t(`profile.interests.${id}`)}
                onToggle={(id) => toggleIn("interests", id)}
                ts={ts}
              />
            </fieldset>

            {/* §8: the PROMPT is the field. "Where did you grow up?"
                gets a real sentence; "tell people about yourself" gets
                nothing. */}
            <fieldset style={{ border: "none", padding: 0, margin: "0 0 24px" }}>
              <legend style={labelStyle}>{t("profile.aboutLabel")}</legend>
              <p style={hintStyle}>{t("profile.aboutHint")}</p>
              <ChipGroup
                options={ABOUT_PROMPTS}
                chosen={[form.about_prompt]}
                labelFor={(id) => t(`profile.prompts.${id}`)}
                onToggle={(id) => setForm((f) => ({ ...f, about_prompt: id }))}
                ts={ts}
              />
              <textarea
                id="pf-about"
                aria-label={t(`profile.prompts.${form.about_prompt}`)}
                style={{ ...inputStyle, marginTop: 10, minHeight: 96, resize: "vertical" }}
                value={form.about}
                onChange={onChange("about")}
                maxLength={280}
              />
            </fieldset>

            {error && (
              <p role="alert" style={{ fontSize: ts(A11Y.minBodyPx), color: C.error, fontWeight: 600, margin: "0 0 16px" }}>
                {error}
              </p>
            )}
            {status === "saved" && (
              <p role="status" style={{ fontSize: ts(A11Y.minBodyPx), color: C.green, fontWeight: 600, margin: "0 0 16px" }}>
                ✓ {s.saved}
              </p>
            )}

            <button
              type="submit"
              disabled={status === "saving"}
              style={{
                minHeight: 56,
                width: "100%",
                padding: "0 28px",
                borderRadius: 50,
                border: "none",
                background: C.green,
                color: C.cream,
                fontSize: ts(19),
                fontWeight: 600,
                fontFamily: "inherit",
                cursor: status === "saving" ? "default" : "pointer",
                opacity: status === "saving" ? 0.7 : 1,
              }}
            >
              {status === "saving" ? s.saving : s.save}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
