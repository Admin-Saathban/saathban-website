/* ════════════════════════════════════════════════
   Admin — small pieces shared by People, Activity, Content and Test
   data. Same floors as ui.jsx: 18px body, 48px targets, meaning in
   words and glyphs, never colour alone.
   ════════════════════════════════════════════════ */

import { APP_COLORS as C, APP_FONT, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { ROLE_DISPLAY } from "../../constants/roles.js";

export function PageTitle({ title, intro }) {
  return (
    <>
      <h1
        style={{
          fontFamily: APP_FONT,
          fontSize: 32,
          fontWeight: 700,
          color: C.green,
          margin: "0 0 6px",
        }}
      >
        {title}
      </h1>
      {intro && (
        <p style={{ color: C.textMuted, margin: "0 0 22px", maxWidth: 760, lineHeight: 1.55 }}>
          {intro}
        </p>
      )}
    </>
  );
}

const CHIP = {
  active: { bg: C.selected, fg: C.green, glyph: "" },
  paused: { bg: C.brown, fg: C.cream, glyph: "⏸ " },
  blocked: { bg: C.dark, fg: C.cream, glyph: "⛔ " },
  test: { bg: C.warmGray, fg: C.textMain, glyph: "⚗ " },
  noProfile: { bg: C.white, fg: C.textMuted, glyph: "… " },
  hidden: { bg: C.brown, fg: C.cream, glyph: "👁 " },
  neutral: { bg: C.warmGray, fg: C.textMain, glyph: "" },
};

export function Chip({ kind = "neutral", children }) {
  const s = CHIP[kind] || CHIP.neutral;
  return (
    <span
      style={{
        display: "inline-block",
        padding: "3px 12px",
        borderRadius: 50,
        background: s.bg,
        color: s.fg,
        border: `1px solid ${C.warmGray}`,
        fontSize: 15,
        fontWeight: 700,
        /* Short chips stay on one line by themselves; a long one ("Hidden
           by …, date") wraps instead of pushing a phone screen sideways. */
        maxWidth: "100%",
        overflowWrap: "anywhere",
      }}
    >
      {s.glyph}
      {children}
    </span>
  );
}

export function statusKinds(p) {
  const out = [];
  if (p.has_profile === false) out.push("noProfile");
  if (p.is_blocked) out.push("blocked");
  if (p.is_paused) out.push("paused");
  if (p.is_test) out.push("test");
  if (!out.length || (out.length === 1 && out[0] === "test")) out.unshift("active");
  return out;
}

export function StatusChips({ person }) {
  const { t } = useI18n();
  return (
    <span style={{ display: "inline-flex", gap: 6, flexWrap: "wrap" }}>
      {statusKinds(person).map((k) => (
        <Chip key={k} kind={k}>
          {t(`admin.people.status.${k}`)}
        </Chip>
      ))}
    </span>
  );
}

export function useRoleLabel() {
  const { t } = useI18n();
  return (role, level) => {
    if (!role) return t("admin.people.status.noProfile");
    if (role !== "admin") return ROLE_DISPLAY[role] || role;
    const lvl =
      level === "super"
        ? t("admin.levelSuper")
        : level === "moderator"
          ? t("admin.levelModerator")
          : t("admin.levelSupport");
    return `${ROLE_DISPLAY.admin} · ${lvl}`;
  };
}

export const inputStyle = {
  width: "100%",
  minHeight: A11Y.minTapTargetPx,
  boxSizing: "border-box",
  fontFamily: APP_FONT,
  fontSize: 18,
  background: C.cream,
  color: C.textMain,
  border: `1px solid ${C.warmGray}`,
  borderRadius: 10,
  padding: "0 14px",
};

export function TextField({ label, value, onChange, placeholder, hint, type = "text", autoComplete = "off" }) {
  return (
    <label style={{ display: "block", marginBottom: 12 }}>
      <span style={{ display: "block", fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        autoComplete={autoComplete}
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
        style={inputStyle}
      />
      {hint && <span style={{ display: "block", color: C.textMuted, fontSize: 15, marginTop: 4 }}>{hint}</span>}
    </label>
  );
}

export function Notice({ msg }) {
  if (!msg) return null;
  const err = msg.kind === "err";
  return (
    <p
      role={err ? "alert" : "status"}
      style={{
        border: `2px solid ${err ? C.brown : C.green}`,
        borderRadius: 10,
        padding: "10px 14px",
        color: err ? C.brown : C.green,
        fontWeight: 700,
        margin: "0 0 14px",
        overflowWrap: "anywhere",
      }}
    >
      {err ? "⚠ " : "✓ "}
      {msg.text}
    </p>
  );
}

/* A number with its words — the Activity screen is plain numbers. */
export function NumberRow({ label, value, strong }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        gap: 16,
        padding: "10px 0",
        borderBottom: `1px solid ${C.warmGray}`,
      }}
    >
      <span>{label}</span>
      <span style={{ fontWeight: 700, fontSize: strong ? 24 : 20, color: C.green, fontVariantNumeric: "tabular-nums" }}>
        {value ?? "—"}
      </span>
    </div>
  );
}

/* Counts from admin_person_footprint (0151): what goes, what other
   people lose with it, and what stays. Zeroes are left out. */
export function FootprintList({ footprint, files }) {
  const { t } = useI18n();
  if (!footprint) return null;
  const rows = (obj, prefix) =>
    Object.entries(obj || {})
      .filter(([, n]) => Number(n) > 0)
      .map(([k, n]) => ({ k, n, label: t(`admin.fp.${prefix}.${k}`) }));
  const removed = rows(footprint.removed, "removed");
  const others = rows(footprint.affects_others, "others");
  const stays = rows(footprint.stays, "stays");
  const list = (items, glyph) => (
    <ul style={{ margin: "4px 0 14px", paddingInlineStart: 22, lineHeight: 1.7 }}>
      {items.map((r) => (
        <li key={r.k}>
          {glyph}
          {r.label}: <strong>{r.n}</strong>
        </li>
      ))}
    </ul>
  );
  return (
    <div>
      <div style={{ fontWeight: 700 }}>{t("admin.fp.removedTitle")}</div>
      {removed.length || files ? (
        <>
          {list(removed, "")}
          {files > 0 && (
            <p style={{ margin: "-8px 0 14px" }}>
              {t("admin.fp.files", { n: files })}
            </p>
          )}
        </>
      ) : (
        <p style={{ margin: "4px 0 14px", color: C.textMuted }}>{t("admin.fp.nothing")}</p>
      )}
      {others.length > 0 && (
        <>
          <div style={{ fontWeight: 700, color: C.brown }}>⚑ {t("admin.fp.othersTitle")}</div>
          {list(others, "")}
        </>
      )}
      {stays.length > 0 && (
        <>
          <div style={{ fontWeight: 700 }}>{t("admin.fp.staysTitle")}</div>
          {list(stays, "")}
        </>
      )}
    </div>
  );
}

/* A DATE column ("2026-09-13") is a day on a calendar, not an instant.
   new Date("2026-09-13") reads it as UTC midnight, which shows as the
   12th anywhere west of Greenwich. Built from its parts it stays put. */
export function fmtDay(ymd) {
  if (!ymd) return "—";
  const [y, m, d] = String(ymd).slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function lastActive(p) {
  const a = p.last_seen_at ? Date.parse(p.last_seen_at) : 0;
  const b = p.last_sign_in_at ? Date.parse(p.last_sign_in_at) : 0;
  const m = Math.max(a, b);
  return m ? new Date(m).toISOString() : null;
}
