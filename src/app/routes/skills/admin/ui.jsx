/* ════════════════════════════════════════════════
   Grow admin — shared pieces for /app/skills/admin.

   Bilingual fields side by side (English, then Urdu written right to
   left), the audience picker, status words, the unpublish choice, and
   the one place database refusals are turned into sentences.
   ════════════════════════════════════════════════ */

import { useState } from "react";
import { APP_COLORS as C, A11Y } from "../../../../shared/tokens.js";
import { useI18n } from "../../../lib/i18n.jsx";
import { ROLE_DISPLAY } from "../../../constants/roles.js";
import { ROLE_VALUES, newKey } from "../growData.js";

export function useAdminStyles() {
  const { ts, meta } = useI18n();
  return {
    card: {
      background: C.white,
      border: `1px solid ${C.warmGray}`,
      borderRadius: 16,
      padding: "16px 16px",
      marginBottom: 14,
    },
    h2: { fontFamily: meta.fonts.heading, fontSize: ts(22), fontWeight: 700, color: C.green, margin: "0 0 10px" },
    h3: { fontFamily: meta.fonts.heading, fontSize: ts(19), fontWeight: 700, color: C.textMain, margin: "0 0 6px" },
    label: { display: "block", fontSize: ts(16), fontWeight: 700, color: C.textMain, margin: "0 0 6px" },
    muted: { fontSize: ts(16), color: C.textMuted, lineHeight: 1.5, margin: "0 0 8px" },
    body: { fontSize: ts(A11Y.minBodyPx), color: C.textMain, lineHeight: 1.55, margin: "0 0 8px" },
    input: {
      width: "100%",
      boxSizing: "border-box",
      minHeight: A11Y.minTapTargetPx,
      padding: "8px 12px",
      borderRadius: 10,
      border: `1.5px solid ${C.warmGray}`,
      background: C.white,
      color: C.textMain,
      fontFamily: "inherit",
      fontSize: ts(17),
      lineHeight: 1.5,
    },
    row: { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" },
  };
}

export function Btn({ kind = "primary", small, style, ...props }) {
  const { ts } = useI18n();
  const base = {
    minHeight: A11Y.minTapTargetPx,
    padding: small ? "0 14px" : "0 18px",
    borderRadius: 50,
    fontFamily: "inherit",
    fontSize: ts(small ? 16 : 17),
    fontWeight: 700,
    cursor: props.disabled ? "default" : "pointer",
    opacity: props.disabled ? 0.6 : 1,
  };
  const kinds = {
    primary: { background: C.green, color: C.white, border: "none" },
    secondary: { background: C.white, color: C.textMain, border: `2px solid ${C.warmGray}` },
    danger: { background: C.white, color: C.error, border: `2px solid ${C.error}` },
  };
  return <button type="button" {...props} style={{ ...base, ...kinds[kind], ...style }} />;
}

export function Bilingual({ label, hint, en, ur, onEn, onUr, multiline, disabled, name }) {
  const { t } = useI18n();
  const s = useAdminStyles();
  const Input = multiline ? "textarea" : "input";
  const extra = multiline ? { rows: 3, style: { ...s.input, minHeight: 90 } } : { style: s.input };
  return (
    <fieldset style={{ border: "none", padding: 0, margin: "0 0 14px" }} data-field={name}>
      <legend style={s.label}>{label}</legend>
      {hint && <p style={s.muted}>{hint}</p>}
      <div className="sb-bilingual" style={{ display: "grid", gap: 8 }}>
        <label style={{ display: "block" }}>
          <span style={{ ...s.muted, display: "block", margin: "0 0 2px", fontSize: 14 }}>{t("grow.admin.english")}</span>
          <Input dir="ltr" lang="en" value={en || ""} disabled={disabled} onChange={(e) => onEn(e.target.value)} data-lang="en" {...extra} />
        </label>
        <label style={{ display: "block" }}>
          <span style={{ ...s.muted, display: "block", margin: "0 0 2px", fontSize: 14 }}>{t("grow.admin.urdu")}</span>
          <Input
            dir="rtl"
            lang="ur"
            value={ur || ""}
            disabled={disabled}
            onChange={(e) => onUr(e.target.value)}
            data-lang="ur"
            {...extra}
            style={{ ...extra.style, fontFamily: "'Noto Nastaliq Urdu', inherit", lineHeight: 2 }}
          />
        </label>
      </div>
    </fieldset>
  );
}

export function AudiencePicker({ value, onChange, disabled, name = "audience" }) {
  const { t } = useI18n();
  const s = useAdminStyles();
  const list = value || [];
  const everyone = list.length === 0;
  const [particular, setParticular] = useState(!everyone);
  const toggle = (role) => {
    const next = list.includes(role) ? list.filter((r) => r !== role) : [...list, role];
    onChange(next);
  };
  const radio = { display: "flex", alignItems: "center", gap: 10, minHeight: A11Y.minTapTargetPx, fontSize: 17, cursor: "pointer" };
  return (
    <fieldset style={{ border: "none", padding: 0, margin: "0 0 14px" }} data-field={name} disabled={disabled}>
      <legend style={s.label}>{t("grow.admin.audience")}</legend>
      <label style={radio}>
        <input
          type="radio"
          name={`${name}-mode`}
          checked={!particular}
          onChange={() => {
            setParticular(false);
            onChange([]);
          }}
          style={{ width: 22, height: 22 }}
        />
        {t("grow.admin.everyone")}
      </label>
      <label style={radio}>
        <input type="radio" name={`${name}-mode`} checked={particular} onChange={() => setParticular(true)} style={{ width: 22, height: 22 }} />
        {t("grow.admin.particularRoles")}
      </label>
      {particular && (
        <div style={{ paddingInlineStart: 30 }}>
          {ROLE_VALUES.map((role) => (
            <label key={role} style={radio}>
              <input type="checkbox" checked={list.includes(role)} onChange={() => toggle(role)} style={{ width: 22, height: 22 }} data-role={role} />
              {ROLE_DISPLAY[role]}
            </label>
          ))}
          {list.length === 0 && <p style={{ ...s.muted, color: C.error }}>{t("grow.admin.pickARole")}</p>}
        </div>
      )}
    </fieldset>
  );
}

export function audienceText(audience, t) {
  if (!audience || audience.length === 0) return t("grow.admin.everyone");
  return audience.map((r) => ROLE_DISPLAY[r] || r).join(", ");
}

export function StatusPill({ status }) {
  const { t, ts } = useI18n();
  const tone = {
    draft: { bg: "#F1F2F4", fg: C.textMuted, mark: "✎" },
    published: { bg: "#E3F1EC", fg: C.green, mark: "●" },
    closing: { bg: "#FBF1DC", fg: "#8A5A00", mark: "◐" },
    closed: { bg: "#F6E3E1", fg: C.error, mark: "○" },
  }[status] || { bg: "#F1F2F4", fg: C.textMuted, mark: "" };
  return (
    <span
      data-status={status}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 12px",
        borderRadius: 50,
        background: tone.bg,
        color: tone.fg,
        fontSize: ts(15),
        fontWeight: 700,
      }}
    >
      <span aria-hidden="true">{tone.mark}</span>
      {t(`grow.admin.status.${status}`)}
    </span>
  );
}

/* Publish, or unpublish choosing one of the two modes. The words say
   exactly what happens to part-way people (0165). */
export function StatusControls({ status, kind, onSet, busy }) {
  const { t } = useI18n();
  const s = useAdminStyles();
  const [choosing, setChoosing] = useState(false);
  if (choosing) {
    return (
      <div data-unpublish-choice style={{ border: `2px solid ${C.warmGray}`, borderRadius: 12, padding: 12, marginTop: 10 }}>
        <p style={{ ...s.body, fontWeight: 700 }}>{t("grow.admin.unpublishHow")}</p>
        <div style={{ display: "grid", gap: 10 }}>
          <div>
            <Btn kind="danger" disabled={busy} data-action="remove-now" onClick={() => { setChoosing(false); onSet("closed"); }}>
              {t("grow.admin.removeNow")}
            </Btn>
            <p style={{ ...s.muted, marginTop: 6 }}>{t(`grow.admin.removeNowExplain.${kind}`)}</p>
          </div>
          <div>
            <Btn kind="secondary" disabled={busy} data-action="let-finish" onClick={() => { setChoosing(false); onSet("closing"); }}>
              {t("grow.admin.letFinish")}
            </Btn>
            <p style={{ ...s.muted, marginTop: 6 }}>{t(`grow.admin.letFinishExplain.${kind}`)}</p>
          </div>
          <div>
            <Btn kind="secondary" small onClick={() => setChoosing(false)}>{t("grow.admin.cancel")}</Btn>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div style={s.row}>
      {status !== "published" && (
        <Btn disabled={busy} data-action="publish" onClick={() => onSet("published")}>
          {status === "draft" ? t("grow.admin.publish") : t("grow.admin.publishAgain")}
        </Btn>
      )}
      {status === "published" && (
        <Btn kind="secondary" disabled={busy} data-action="unpublish" onClick={() => setChoosing(true)}>
          {t("grow.admin.unpublish")}
        </Btn>
      )}
      {status === "closing" && (
        <Btn kind="danger" disabled={busy} data-action="remove-now" onClick={() => onSet("closed")}>
          {t("grow.admin.removeNow")}
        </Btn>
      )}
    </div>
  );
}

/* Options for a choice question: each one in both languages. With
   `answer`, one of them is marked as the right answer (course checks
   and exams). `locked` freezes the set (a survey people have answered)
   while leaving the wording editable. */
export function OptionsEditor({ options, onChange, answer, onAnswer, locked, name }) {
  const { t } = useI18n();
  const s = useAdminStyles();
  const list = options || [];
  const set = (i, patch) => onChange(list.map((o, k) => (k === i ? { ...o, ...patch } : o)));
  return (
    <div data-options={name} style={{ borderInlineStart: `3px solid ${C.warmGray}`, paddingInlineStart: 12, margin: "4px 0 12px" }}>
      <p style={s.label}>{t("grow.admin.options")}</p>
      {list.map((o, i) => (
        <div key={o.key} data-option-row={i} style={{ marginBottom: 10 }}>
          <div style={{ display: "grid", gap: 6 }}>
            <input style={s.input} dir="ltr" value={o.en} placeholder={t("grow.admin.optionEn", { n: i + 1 })} aria-label={t("grow.admin.optionEn", { n: i + 1 })} onChange={(e) => set(i, { en: e.target.value })} data-lang="en" />
            <input style={{ ...s.input, fontFamily: "'Noto Nastaliq Urdu', inherit", lineHeight: 2 }} dir="rtl" value={o.ur} placeholder={t("grow.admin.optionUr", { n: i + 1 })} aria-label={t("grow.admin.optionUr", { n: i + 1 })} onChange={(e) => set(i, { ur: e.target.value })} data-lang="ur" />
          </div>
          <div style={{ ...s.row, marginTop: 4 }}>
            {onAnswer && (
              <label style={{ display: "flex", alignItems: "center", gap: 8, minHeight: A11Y.minTapTargetPx, fontSize: 16 }}>
                <input type="radio" checked={answer === o.key} onChange={() => onAnswer(o.key)} style={{ width: 22, height: 22 }} />
                {answer === o.key ? `✓ ${t("grow.admin.rightAnswer")}` : t("grow.admin.markRight")}
              </label>
            )}
            {!locked && list.length > 2 && (
              <Btn kind="secondary" small onClick={() => onChange(list.filter((_, k) => k !== i))}>
                {t("grow.admin.removeOption")}
              </Btn>
            )}
          </div>
        </div>
      ))}
      {!locked && list.length < 15 && (
        <Btn kind="secondary" small data-action="add-option" onClick={() => onChange([...list, { key: newKey("o"), en: "", ur: "" }])}>
          {t("grow.admin.addOption")}
        </Btn>
      )}
    </div>
  );
}

export function moveItem(list, i, delta) {
  const j = i + delta;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

/* Database refusals, in words. The database is what refuses; this only
   says why. */
export function errorMessage(e, t) {
  const m = String(e?.message || "");
  if (e?.code === "42501" || /not allowed/i.test(m)) return t("grow.admin.err.notAllowed");
  if (e?.code === "23514" || /complete_when_offered/i.test(m)) return t("grow.admin.err.incomplete");
  if (/locked once people have answered/i.test(m)) return t("grow.admin.err.locked");
  if (/already in Pending/i.test(m)) return t("grow.admin.err.alreadyPending");
  if (/credential badge/i.test(m)) return t("grow.admin.err.badge");
  if (/Icons only/i.test(m)) return t("grow.admin.err.researchAudience");
  if (/publish the survey/i.test(m)) return t("grow.admin.err.publishFirst");
  if (/audience_check|audience/i.test(m)) return t("grow.admin.err.audience");
  return t("grow.admin.err.generic");
}

export function Notice({ children, tone = "info" }) {
  const { ts } = useI18n();
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      style={{
        border: `2px solid ${tone === "error" ? C.error : C.green}`,
        color: tone === "error" ? C.error : C.textMain,
        background: C.white,
        borderRadius: 12,
        padding: "10px 14px",
        fontSize: ts(17),
        fontWeight: 600,
        margin: "0 0 14px",
        lineHeight: 1.5,
      }}
    >
      {children}
    </p>
  );
}
