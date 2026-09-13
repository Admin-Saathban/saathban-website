/* ════════════════════════════════════════════════
   The thread's own menu — Messages rework.

   BLOCK, MUTE AND REPORT TOGETHER, reachable from the header of every
   conversation (CLAUDE.md: block, report and mute in every thread).
   Before this, a conversation had Report on each message and nothing
   else: Block lived only on the profile page, which the thread no longer
   links to, and Mute lived only in the feed and the bell.

   Each row says what it will do beneath its name, and a row whose act
   has already been done offers its undo instead (Unmute, Bring back) —
   never both, never a switch whose state has to be read off a colour.

   Mute and Archive only make sense in an open conversation, so they are
   absent (not disabled) while a request is still waiting. Report and
   Block are always here: they matter most exactly when a stranger is
   the one writing.
   ════════════════════════════════════════════════ */

import { APP_COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { MotionStyles } from "../../lib/motion.jsx";
import useBackToClose from "../../components/useBackToClose.js";

function Item({ label, sub, onClick, disabled, danger }) {
  const { ts } = useI18n();
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "block",
        width: "100%",
        boxSizing: "border-box",
        minHeight: 64,
        padding: "10px 16px",
        marginBottom: 8,
        background: C.white,
        border: `2px solid ${danger ? C.brown : C.warmGray}`,
        borderRadius: 16,
        textAlign: "start",
        fontFamily: "inherit",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <span style={{ display: "block", fontSize: ts(A11Y.minBodyPx), fontWeight: 700, color: danger ? C.brown : C.textMain }}>
        {label}
      </span>
      {sub && (
        <span style={{ display: "block", fontSize: ts(16), color: C.textMuted, marginTop: 2, lineHeight: 1.4 }}>
          {sub}
        </span>
      )}
    </button>
  );
}

export default function ThreadMenu({ name, open, canReport, state, busy, onClose, onMute, onArchive, onReport, onBlock }) {
  /* Mounted only while open, so the component that owns the panel owns
     its dismissal. */
  useBackToClose(true, onClose);
  const { t, ts, meta } = useI18n();

  return (
    <div
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
        role="dialog"
        aria-modal="true"
        aria-label={t("msg.thread.menuTitle", { name })}
        dir={meta.dir}
        className="sb-sheet"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 640,
          boxSizing: "border-box",
          background: C.bg,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          padding: "16px 16px calc(16px + env(safe-area-inset-bottom))",
          maxHeight: "90dvh",
          overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <h2 style={{ flex: 1, minWidth: 0, margin: 0, fontFamily: meta.fonts.heading, fontSize: ts(21), fontWeight: 800, color: C.green, overflowWrap: "anywhere" }}>
            {t("msg.thread.menuTitle", { name })}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("msg.thread.close")}
            style={{
              minWidth: A11Y.minTapTargetPx,
              minHeight: A11Y.minTapTargetPx,
              border: "none",
              background: "transparent",
              color: C.textMain,
              fontSize: ts(20),
              cursor: "pointer",
            }}
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>

        <div role="menu">
          {open && (
            <Item
              label={t(state.muted ? "msg.thread.unmute" : "msg.thread.mute")}
              sub={t(state.muted ? "msg.thread.unmuteSub" : "msg.thread.muteSub", { name })}
              onClick={onMute}
              disabled={busy}
            />
          )}
          {open && (
            <Item
              label={t(state.archived ? "msg.thread.unarchive" : "msg.thread.archive")}
              sub={t(state.archived ? "msg.thread.unarchiveSub" : "msg.thread.archiveSub")}
              onClick={onArchive}
              disabled={busy}
            />
          )}
          {canReport && (
            <Item label={t("msg.thread.report")} sub={t("msg.thread.reportSub")} onClick={onReport} disabled={busy} />
          )}
          <Item
            label={t("msg.thread.block", { name })}
            sub={t("msg.thread.blockSub")}
            onClick={onBlock}
            disabled={busy}
            danger
          />
        </div>
      </div>
    </div>
  );
}
