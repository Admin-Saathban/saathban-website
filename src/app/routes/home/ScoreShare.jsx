/* Today's score + sharing.

   Points reward participation, never performance (SPEC.md): every logged
   module earns the same flat credit, a rest day keeps everything safe,
   and there is no comparison with anyone anywhere on this screen.

   The share sheet defaults to private. The mock circle is empty on
   purpose — the Circle row must read as a door ("if there's someone
   you'd like…"), never as a gap. Community sharing is score-level only. */

import { useEffect, useRef, useState } from "react";
import { COLORS as C, FONTS, A11Y } from "../../../shared/tokens.js";
import { BADGES, SHARE_LINK_MOCK } from "./homeMock.js";

function nextBadge(totalPoints) {
  const next = BADGES.find((b) => b.at > totalPoints);
  if (!next) return null;
  const prevAt = [...BADGES].reverse().find((b) => b.at <= totalPoints)?.at || 0;
  const pct = Math.round(((totalPoints - prevAt) / (next.at - prevAt)) * 100);
  return { ...next, toGo: next.at - totalPoints, pct };
}

/* ─── Share sheet ─── */

function ShareRow({ icon, title, sub, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: "100%",
        minHeight: 64,
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "12px 16px",
        borderRadius: 16,
        border: `2px solid ${C.warmGray}`,
        background: C.white,
        fontFamily: FONTS.sans,
        textAlign: "left",
        cursor: "pointer",
      }}
    >
      <span aria-hidden="true" style={{ fontSize: 26 }}>{icon}</span>
      <span style={{ flex: 1 }}>
        <span style={{ display: "block", fontSize: 19, fontWeight: 700, color: C.textMain }}>
          {title}
        </span>
        <span style={{ display: "block", fontSize: 18, color: C.textMuted, lineHeight: 1.45 }}>
          {sub}
        </span>
      </span>
    </button>
  );
}

function ShareSheet({ onClose, onToast, circleMembers, doneCount, points }) {
  const closeRef = useRef(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const circleEmpty = circleMembers.length === 0;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(SHARE_LINK_MOCK);
    } catch {
      /* clipboard unavailable — the toast still explains what the link does */
    }
    onToast("Link copied. It shows your score only, and stops working after 7 days.");
    onClose();
  };

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(45, 36, 24, 0.5)",
        zIndex: 40,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Share today"
        style={{
          width: "min(100%, 600px)",
          maxHeight: "88vh",
          overflowY: "auto",
          background: C.cream,
          borderRadius: "24px 24px 0 0",
          padding: "20px 20px 28px",
          boxShadow: "0 -8px 32px rgba(45, 36, 24, 0.25)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
          <h2
            style={{
              fontFamily: FONTS.serif,
              fontSize: 24,
              fontWeight: 700,
              color: C.brown,
              margin: 0,
              flex: 1,
            }}
          >
            Share today
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close sharing"
            style={{
              width: A11Y.minTapTargetPx,
              height: A11Y.minTapTargetPx,
              borderRadius: 14,
              border: `2px solid ${C.warmGray}`,
              background: C.white,
              fontSize: 22,
              fontWeight: 700,
              color: C.textMain,
              cursor: "pointer",
            }}
          >
            ✕
          </button>
        </div>

        <p style={{ fontSize: 18, color: C.textMuted, margin: "0 0 16px", lineHeight: 1.5 }}>
          {doneCount > 0
            ? `Today so far: ${doneCount} ${doneCount === 1 ? "log" : "logs"}, ${points} points.`
            : "Nothing logged yet — you can still share once there is."}{" "}
          Today stays private unless you choose otherwise.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <ShareRow
            icon="🏡"
            title="My Circle"
            sub={
              circleEmpty
                ? "If there's someone you'd like kept in the loop, you can invite them from Settings."
                : `Send today's summary to your circle (${circleMembers.length}).`
            }
            onClick={() => {
              onToast(
                circleEmpty
                  ? "Invites live in Settings, whenever you'd like."
                  : "Today's summary sent to your circle."
              );
              onClose();
            }}
          />
          <ShareRow
            icon="🤝"
            title="Friends on Saathban"
            sub="Your connections see today's summary."
            onClick={() => {
              onToast("Shared with your friends on Saathban.");
              onClose();
            }}
          />
          <ShareRow
            icon="🌳"
            title="Community"
            sub="Score only — never your notes, mood, or medication."
            onClick={() => {
              onToast("Your score is up on the community board.");
              onClose();
            }}
          />
          <ShareRow
            icon="🔗"
            title="Copy a link"
            sub="Shows your score only. The link stops working after 7 days."
            onClick={copyLink}
          />
        </div>
      </div>
    </div>
  );
}

/* ─── The score card ─── */

export default function ScoreShare({
  points,
  doneCount,
  totalModules,
  lifetimePoints,
  restDay,
  onToggleRest,
  editable,
  circleMembers,
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const badge = nextBadge(lifetimePoints + points);

  const showToast = (msg) => {
    setToast(msg);
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => setToast(null), 5000);
  };

  return (
    <section
      aria-label="Today's points"
      style={{
        background: C.green,
        borderRadius: 22,
        padding: "24px 20px",
        marginBottom: 20,
        color: C.cream,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <div style={{ textAlign: "center" }}>
          <span
            style={{
              display: "block",
              fontFamily: FONTS.sans,
              fontSize: 52,
              fontWeight: 700,
              lineHeight: 1,
              fontVariantNumeric: "lining-nums",
            }}
          >
            {restDay ? "☾" : points}
          </span>
          <span style={{ display: "block", fontSize: 18, opacity: 0.9, marginTop: 4 }}>
            {restDay ? "rest day" : "points today"}
          </span>
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 19, lineHeight: 1.5, margin: 0, fontWeight: 500 }}>
            {restDay
              ? "Resting counts as looking after yourself. Everything is safe."
              : doneCount === 0
              ? "Points are for showing up, in your own way, in your own time."
              : `${doneCount} of ${totalModules} logs today. Every one counts the same.`}
          </p>
        </div>
      </div>

      {badge && !restDay && (
        <div style={{ marginTop: 18 }}>
          <p style={{ fontSize: 18, margin: "0 0 8px", opacity: 0.95 }}>
            {badge.toGo} points to your next badge, “{badge.name}”
          </p>
          <div
            role="progressbar"
            aria-valuenow={badge.pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Progress to the ${badge.name} badge`}
            style={{
              height: 14,
              borderRadius: 7,
              background: "rgba(250, 243, 233, 0.25)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${Math.max(badge.pct, 4)}%`,
                height: "100%",
                borderRadius: 7,
                background: C.sage,
              }}
            />
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 10, marginTop: 20, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          style={{
            flex: "1 1 200px",
            minHeight: 56,
            borderRadius: 50,
            border: "none",
            background: C.cream,
            color: C.green,
            fontSize: 19,
            fontWeight: 700,
            fontFamily: FONTS.sans,
            cursor: "pointer",
          }}
        >
          Share today
        </button>
        {editable && (
          <button
            type="button"
            onClick={onToggleRest}
            aria-pressed={restDay}
            style={{
              flex: "1 1 200px",
              minHeight: 56,
              borderRadius: 50,
              border: `2px solid ${C.cream}`,
              background: restDay ? C.cream : "transparent",
              color: restDay ? C.green : C.cream,
              fontSize: 19,
              fontWeight: 700,
              fontFamily: FONTS.sans,
              cursor: "pointer",
            }}
          >
            {restDay ? "✓ Rest day — tap to undo" : "Make it a rest day"}
          </button>
        )}
      </div>

      {sheetOpen && (
        <ShareSheet
          onClose={() => setSheetOpen(false)}
          onToast={showToast}
          circleMembers={circleMembers}
          doneCount={doneCount}
          points={points}
        />
      )}

      {toast && (
        <div
          role="status"
          style={{
            position: "fixed",
            left: "50%",
            transform: "translateX(-50%)",
            bottom: 24,
            zIndex: 50,
            maxWidth: "min(92vw, 560px)",
            background: C.brown,
            color: C.cream,
            fontSize: 18,
            lineHeight: 1.5,
            fontFamily: FONTS.sans,
            padding: "14px 22px",
            borderRadius: 16,
            boxShadow: "0 6px 24px rgba(45, 36, 24, 0.35)",
          }}
        >
          {toast}
        </div>
      )}
    </section>
  );
}
