/* ════════════════════════════════════════════════
   Admin lane — small shared UI primitives.

   Desktop-first (admins are the Saathban team on laptops), but the
   accessibility floors still apply: 18px body text, 48px tap targets.
   All colour comes from the shared brand tokens — no hardcoded hex.
   There is no red in the palette, so danger/flag emphasis is carried by
   the dark brown + weight + an explicit glyph, never colour alone.
   ════════════════════════════════════════════════ */

import { APP_COLORS as C, APP_FONT, A11Y } from "../../../shared/tokens.js";
import { statusLabel } from "./data.js";
import { useI18n } from "../../lib/i18n.jsx";

// ─── Status chip ───
// Each pipeline stage gets a distinct token pairing; the label always
// carries the meaning so colour is never the only signal.
const STATUS_STYLES = {
  pending: { bg: C.warmGray, fg: C.textMain },
  interviewing: { bg: C.olive, fg: C.white },
  /* 2.08:1 BEFORE THIS. C.dark on C.sage — and C.sage is #0B5D2A,
     byte-identical to C.green since the palette collapse, so this was
     near-black ink on the dark accent: less than half the 4.5:1 AA
     floor, on the chip that tells a reviewer whether a volunteer is
     cleared to be alone with an isolated person.

     It read as legible in review because the NAME said "sage" and sage
     used to be a pale green. The name went on describing a colour the
     token had stopped holding.

     Pale ground, accent ink: 7.13:1, and still distinct from `active`
     below, which is the same green the other way round. */
  probation: { bg: C.selected, fg: C.green },
  active: { bg: C.green, fg: C.cream },
  suspended: { bg: C.brown, fg: C.cream },
  rejected: { bg: C.dark, fg: C.warmGray },
};

export function StatusChip({ status }) {
  const { t } = useI18n();
  const s = STATUS_STYLES[status] || STATUS_STYLES.pending;
  return (
    <span
      style={{
        display: "inline-block",
        padding: "4px 14px",
        borderRadius: 50,
        background: s.bg,
        color: s.fg,
        fontSize: 15,
        fontWeight: 600,
        letterSpacing: 0.3,
        whiteSpace: "nowrap",
      }}
    >
      {statusLabel(status, t)}
    </span>
  );
}

// ─── Red-flag badge — glyph + count/text, never colour alone ───
export function FlagBadge({ count, label }) {
  const { t } = useI18n();
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 12px",
        borderRadius: 50,
        background: C.brown,
        color: C.cream,
        fontSize: 14,
        fontWeight: 700,
      }}
    >
      ⚑ {label ?? t(count === 1 ? "admin.flagOne" : "admin.flagMany", { n: count })}
    </span>
  );
}

// ─── Layout blocks ───
export function Card({ title, aside, children, style }) {
  return (
    <section
      style={{
        background: C.white,
        border: `1px solid ${C.warmGray}`,
        borderRadius: 14,
        padding: "22px 26px",
        ...style,
      }}
    >
      {(title || aside) && (
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 16,
            marginBottom: 14,
          }}
        >
          {title && (
            <h2
              style={{
                fontFamily: APP_FONT,
                fontSize: 21,
                fontWeight: 600,
                color: C.green,
                margin: 0,
              }}
            >
              {title}
            </h2>
          )}
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}

export function Field({ label, children, wide }) {
  return (
    <div style={{ gridColumn: wide ? "1 / -1" : undefined }}>
      <div
        style={{
          fontSize: 14,
          fontWeight: 700,
          letterSpacing: 0.8,
          textTransform: "uppercase",
          color: C.textMuted,
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: A11Y.minBodyPx, color: C.textMain, lineHeight: 1.6 }}>
        {children ?? "—"}
      </div>
    </div>
  );
}

// ─── Buttons ───
// kind: "primary" (green solid), "outline" (default actions),
//       "danger" (dark brown solid — reject/suspend territory)
export function AdminBtn({ kind = "outline", disabled, onClick, children, title }) {
  const looks = {
    primary: { background: C.green, color: C.cream, border: `2px solid ${C.green}` },
    outline: { background: C.white, color: C.green, border: `2px solid ${C.green}` },
    danger: { background: C.brown, color: C.cream, border: `2px solid ${C.brown}` },
    ghost: { background: "transparent", color: C.textMuted, border: `2px solid ${C.warmGray}` },
  };
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      style={{
        minHeight: A11Y.minTapTargetPx,
        padding: "0 22px",
        borderRadius: 10,
        fontFamily: APP_FONT,
        fontSize: 17,
        fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.45 : 1,
        ...looks[kind],
      }}
    >
      {children}
    </button>
  );
}

// ─── Pipeline stepper: pending → interviewing → probation → active ───
// Suspended/rejected render as a terminal note beside the track rather
// than a step — they are exits, not stages.
export function PipelineStepper({ status, pipeline }) {
  const { t } = useI18n();
  const idx = pipeline.indexOf(status);
  const offTrack = idx === -1;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0, flexWrap: "wrap" }}>
      {pipeline.map((stage, i) => {
        const reached = !offTrack && i <= idx;
        const current = !offTrack && i === idx;
        return (
          <div key={stage} style={{ display: "flex", alignItems: "center" }}>
            {i > 0 && (
              <div
                style={{
                  width: 34,
                  height: 2,
                  background: reached ? C.green : C.warmGray,
                }}
              />
            )}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 14px",
                borderRadius: 50,
                border: `2px solid ${reached ? C.green : C.warmGray}`,
                background: current ? C.green : C.white,
                color: current ? C.cream : reached ? C.green : C.textMuted,
                fontSize: 15,
                fontWeight: current ? 700 : 500,
              }}
            >
              {reached && !current ? "✓ " : ""}
              {statusLabel(stage, t)}
            </div>
          </div>
        );
      })}
      {offTrack && (
        <div style={{ marginLeft: 16 }}>
          <StatusChip status={status} />
        </div>
      )}
    </div>
  );
}

// ─── Date helpers ───
export function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function fmtDateTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function hoursAgo(iso) {
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 36e5));
}

export function ageFromDob(dob) {
  const d = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}
