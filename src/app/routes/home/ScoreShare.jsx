/* Today's score + sharing.

   Points reward participation, never performance (SPEC.md): every logged
   module earns the same flat credit, a rest day keeps everything safe,
   and there is no comparison with anyone anywhere on this screen.

   The share sheet defaults to private. The mock circle is empty on
   purpose — the Circle row must read as a door ("if there's someone
   you'd like…"), never as a gap. Community sharing is score-level only.

   All copy lives in locales/ under home.score.*; badge names resolve
   from home.score.badges.*. */

import { useEffect, useRef, useState } from "react";
import { APP_COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { BADGES } from "./homeMock.js";
import { useSession } from "../../lib/session.jsx";
import {
  shareScoreToCommunity,
  shareScoreWithPeople,
  createScoreShareLink,
  sharedScoreUrl,
} from "./shareData.js";

function nextBadge(totalPoints) {
  const next = BADGES.find((b) => b.at > totalPoints);
  if (!next) return null;
  const prevAt = [...BADGES].reverse().find((b) => b.at <= totalPoints)?.at || 0;
  const pct = Math.round(((totalPoints - prevAt) / (next.at - prevAt)) * 100);
  return { ...next, toGo: next.at - totalPoints, pct };
}

/* ─── Share sheet ─── */

function ShareRow({ icon, title, sub, onClick, done, busy, disabled }) {
  const { ts } = useI18n();
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy || done}
      aria-disabled={disabled || busy || done ? "true" : undefined}
      style={{
        width: "100%",
        minHeight: 64,
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "12px 16px",
        borderRadius: 16,
        /* Done is marked by the glyph AND the words, never colour
           alone — the row says where it went and stops offering to go
           there again. */
        border: `2px solid ${done ? C.green : C.warmGray}`,
        background: C.white,
        fontFamily: "inherit",
        textAlign: "start",
        cursor: done || busy || disabled ? "default" : "pointer",
        opacity: disabled && !done ? 0.55 : 1,
      }}
    >
      <span aria-hidden="true" style={{ fontSize: ts(26) }}>{done ? "✓" : icon}</span>
      <span style={{ flex: 1 }}>
        <span style={{ display: "block", fontSize: ts(17), fontWeight: 700, color: C.textMain }}>
          {title}
        </span>
        <span style={{ display: "block", fontSize: ts(A11Y.minBodyPx), color: C.textMuted, lineHeight: 1.45 }}>
          {sub}
        </span>
      </span>
    </button>
  );
}

function ShareSheet({ onClose, onToast, circleMembers, doneCount, points }) {
  const { t, ts, meta } = useI18n();
  const { profile } = useSession();
  const closeRef = useRef(null);
  /* Per destination, not per sheet: sharing to the community says
     nothing about whether a link was copied. */
  const [done, setDone] = useState({});
  const [busy, setBusy] = useState(null);
  const [link, setLink] = useState("");

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const circleEmpty = circleMembers.length === 0;

  const today = new Date().toISOString().slice(0, 10);
  const summary = { points, logs: doneCount, day: today };

  /* One press does the work once. A second press on a finished row is
     ignored rather than repeating the claim — thirty presses used to
     mean thirty identical confirmations of nothing. */
  const once = async (key, work) => {
    if (busy || done[key]) return;
    setBusy(key);
    try {
      const line = await work();
      setDone((d) => ({ ...d, [key]: true }));
      if (line) onToast(line);
    } catch {
      onToast(t("home.score.share.shareFailed"));
    } finally {
      setBusy(null);
    }
  };

  const copyLink = () =>
    once("link", async () => {
      const token = await createScoreShareLink(summary);
      const url = sharedScoreUrl(token);
      setLink(url);
      try {
        await navigator.clipboard.writeText(url);
        return t("home.score.share.toastLinkCopied");
      } catch {
        /* No clipboard (an insecure context, or a browser that refuses
           without a gesture it recognises). The link is real either
           way, so show it rather than claiming a copy that did not
           happen. */
        return t("home.score.share.toastLinkShown");
      }
    });

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
        aria-label={t("home.score.shareToday")}
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
              fontFamily: meta.fonts.heading,
              fontSize: ts(24),
              fontWeight: 700,
              color: C.brown,
              margin: 0,
              flex: 1,
            }}
          >
            {t("home.score.shareToday")}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label={t("home.score.share.close")}
            style={{
              width: A11Y.minTapTargetPx,
              height: A11Y.minTapTargetPx,
              borderRadius: 14,
              border: `2px solid ${C.warmGray}`,
              background: C.white,
              fontSize: ts(22),
              fontWeight: 700,
              color: C.textMain,
              cursor: "pointer",
            }}
          >
            ✕
          </button>
        </div>

        <p style={{ fontSize: ts(A11Y.minBodyPx), color: C.textMuted, margin: "0 0 16px", lineHeight: 1.5 }}>
          {doneCount > 0
            ? doneCount === 1
              ? t("home.score.share.soFarOne", { points })
              : t("home.score.share.soFarMany", { n: doneCount, points })
            : t("home.score.share.nothingYet")}{" "}
          {t("home.score.share.staysPrivate")}
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <ShareRow
            icon="🏡"
            title={t("home.score.share.circleTitle")}
            sub={
              circleEmpty
                ? t("home.score.share.circleEmpty")
                : t("home.score.share.circleSend", { n: circleMembers.length })
            }
            disabled={circleEmpty}
            busy={busy === "circle"}
            done={done.circle}
            onClick={() => {
              /* Nobody in the circle is not a failed share — it is a
                 door, and it says where the door is. */
              if (circleEmpty) {
                onToast(t("home.score.share.toastCircleEmpty"));
                return;
              }
              once("circle", async () => {
                const first = (profile?.full_name || "").split(" ")[0];
                const { sent } = await shareScoreWithPeople({
                  ...summary,
                  /* The notification is read by somebody else, so it
                     carries words rather than being assembled from
                     English in the data layer. */
                  title: first
                    ? t("home.score.share.notifyTitle", { name: first })
                    : t("home.score.share.notifyTitleAnon"),
                  body: t("home.score.share.notifyBody", { points }),
                });
                /* Nothing written means nobody was told, whatever the
                   button hoped. */
                if (sent === 0) {
                  setDone((d) => ({ ...d, circle: false }));
                  return t("home.score.share.toastPeopleNone");
                }
                return sent === 1
                  ? t("home.score.share.toastPeopleSentOne")
                  : t("home.score.share.toastCircleSentN", { n: sent });
              });
            }}
          />
          <ShareRow
            icon="🤝"
            title={t("home.score.share.friendsTitle")}
            sub={t("home.score.share.friendsSub")}
            busy={busy === "people"}
            done={done.people}
            onClick={() =>
              once("people", async () => {
                const first = (profile?.full_name || "").split(" ")[0];
                const { sent } = await shareScoreWithPeople({
                  ...summary,
                  /* The notification is read by somebody else, so it
                     carries words rather than being assembled from
                     English in the data layer. */
                  title: first
                    ? t("home.score.share.notifyTitle", { name: first })
                    : t("home.score.share.notifyTitleAnon"),
                  body: t("home.score.share.notifyBody", { points }),
                });
                /* Told nobody is not "shared" — say so plainly and
                   leave the row open. */
                if (sent === 0) {
                  setDone((d) => ({ ...d, people: false }));
                  return t("home.score.share.toastPeopleNone");
                }
                return sent === 1
                  ? t("home.score.share.toastPeopleSentOne")
                  : t("home.score.share.toastPeopleSent", { n: sent });
              })
            }
          />
          <ShareRow
            icon="🌳"
            title={t("home.score.share.communityTitle")}
            sub={t("home.score.share.communitySub")}
            busy={busy === "community"}
            done={done.community}
            onClick={() =>
              once("community", async () => {
                await shareScoreToCommunity(profile.id, summary);
                return t("home.score.share.toastCommunityDone");
              })
            }
          />
          <ShareRow
            icon="🔗"
            title={t("home.score.share.linkTitle")}
            sub={t("home.score.share.linkSub")}
            busy={busy === "link"}
            done={done.link}
            onClick={copyLink}
          />
        </div>

        {link && (
          <p
            style={{
              margin: "14px 0 0",
              fontSize: ts(16),
              color: C.textMuted,
              wordBreak: "break-all",
              userSelect: "text",
            }}
          >
            {link}
          </p>
        )}
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
  const { t, ts } = useI18n();
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
      aria-label={t("home.score.ariaPoints")}
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
              fontFamily: "inherit",
              fontSize: ts(52),
              fontWeight: 700,
              lineHeight: 1,
              fontVariantNumeric: "lining-nums",
            }}
          >
            {restDay ? "☾" : points}
          </span>
          <span style={{ display: "block", fontSize: ts(A11Y.minBodyPx), opacity: 0.9, marginTop: 4 }}>
            {restDay ? t("home.score.restDayWord") : t("home.score.pointsToday")}
          </span>
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: ts(17), lineHeight: 1.5, margin: 0, fontWeight: 500 }}>
            {restDay
              ? t("home.score.restLine")
              : doneCount === 0
              ? t("home.score.showUpLine")
              : t("home.score.countLine", { n: doneCount, total: totalModules })}
          </p>
        </div>
      </div>

      {badge && !restDay && (
        <div style={{ marginTop: 18 }}>
          <p style={{ fontSize: ts(A11Y.minBodyPx), margin: "0 0 8px", opacity: 0.95 }}>
            {t("home.score.badgeToGo", { n: badge.toGo, name: t(badge.nameKey) })}
          </p>
          <div
            role="progressbar"
            aria-valuenow={badge.pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={t("home.score.badgeAria", { name: t(badge.nameKey) })}
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
            fontSize: ts(17),
            fontWeight: 700,
            fontFamily: "inherit",
            cursor: "pointer",
          }}
        >
          {t("home.score.shareToday")}
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
              fontSize: ts(17),
              fontWeight: 700,
              fontFamily: "inherit",
              cursor: "pointer",
            }}
          >
            {restDay ? t("home.score.restOn") : t("home.score.restOff")}
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
            fontSize: ts(A11Y.minBodyPx),
            lineHeight: 1.5,
            fontFamily: "inherit",
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
