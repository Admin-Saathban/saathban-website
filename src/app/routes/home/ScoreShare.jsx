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
import { Link, useNavigate } from "react-router-dom";
import Icon from "../../components/Icon.jsx";
import { startShareDraft } from "../community/shareDraft.js";
import { fetchShareAudience, namesLine } from "../../lib/shareAudience.js";
import { APP_COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { BADGES } from "./homeMock.js";
import { useSession } from "../../lib/session.jsx";
import useBackToClose from "../../components/useBackToClose";
import {
  shareScoreToCommunity,
  shareScoreToAudience,
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

/* ── EVERY ROW SHOWS WHAT GOES OUT BEFORE IT GOES ──

   Owner: a share must show the thing, let it be edited, let the person
   press the final button, and then show where it landed. This sheet did
   the work on the tap and reported a line such as "Your score is on the
   community board ✓" — no artifact, no destination a person could open,
   and for the people rows no names.

   - Community goes INTO the composer with the real feed card on it
     (shareDraft.js); the person presses Share there and lands on the
     post.
   - My Circle and Friends open a step inside the sheet: who it goes to,
     the words of the notification (editable), Send, then who it went to,
     the notification as they will read it, and the page it opens.
   - The link shows what the link shows first, then the link, a copy
     button, and the page itself.

   The two people rows used to reach the SAME people (circle and
   conversations together, 0115). They are separate audiences now
   (0120). */

const fieldStyle = (ts) => ({
  display: "block",
  width: "100%",
  boxSizing: "border-box",
  minHeight: A11Y.minTapTargetPx,
  marginTop: 6,
  padding: "10px 14px",
  borderRadius: 12,
  border: "2px solid " + C.warmGray,
  background: C.white,
  color: C.textMain,
  fontFamily: "inherit",
  fontSize: ts(A11Y.minBodyPx),
  lineHeight: 1.5,
});

const primaryBtn = (ts, off) => ({
  minHeight: A11Y.minTapTargetPx,
  padding: "0 24px",
  borderRadius: 50,
  border: "none",
  background: C.green,
  color: C.cream,
  fontFamily: "inherit",
  fontSize: ts(A11Y.minBodyPx),
  fontWeight: 700,
  opacity: off ? 0.5 : 1,
  cursor: off ? "default" : "pointer",
});

const ghostBtn = (ts) => ({
  display: "inline-flex",
  alignItems: "center",
  minHeight: A11Y.minTapTargetPx,
  padding: "0 20px",
  borderRadius: 50,
  border: "2px solid " + C.warmGray,
  background: C.white,
  color: C.textMain,
  fontFamily: "inherit",
  fontSize: ts(A11Y.minBodyPx),
  fontWeight: 600,
  textDecoration: "none",
  cursor: "pointer",
});

function ShareRow({ icon, title, sub, onClick, busy, disabled }) {
  const { ts, meta } = useI18n();
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      aria-disabled={disabled || busy ? "true" : undefined}
      style={{
        width: "100%",
        minHeight: 64,
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "12px 16px",
        borderRadius: 16,
        border: "2px solid " + C.warmGray,
        background: C.white,
        fontFamily: "inherit",
        textAlign: "start",
        cursor: busy || disabled ? "default" : "pointer",
        opacity: disabled ? 0.55 : 1,
      }}
    >
      <Icon name={icon} size={26} style={{ color: C.green }} />
      <span style={{ flex: 1 }}>
        <span style={{ display: "block", fontSize: ts(17), fontWeight: 700, color: C.textMain }}>{title}</span>
        <span style={{ display: "block", fontSize: ts(A11Y.minBodyPx), color: C.textMuted, lineHeight: 1.45 }}>{sub}</span>
      </span>
      {!disabled && (
        <Icon name="chevron" size={20} style={{ color: C.textMuted, transform: meta.dir === "rtl" ? "scaleX(-1)" : undefined }} />
      )}
    </button>
  );
}

/* The notification as the other person will read it. */
function NoticePreview({ title, body }) {
  const { ts } = useI18n();
  return (
    <div style={{ display: "flex", gap: 10, padding: "12px 14px", borderRadius: 14, background: C.white, border: "1.5px solid " + C.warmGray, margin: "10px 0 14px" }}>
      <Icon name="bell" size={22} style={{ color: C.green, marginTop: 2 }} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: ts(A11Y.minBodyPx), fontWeight: 700, color: C.textMain, overflowWrap: "anywhere" }}>{title}</span>
        {body && <span style={{ display: "block", fontSize: ts(16), color: C.textMuted, marginTop: 2, overflowWrap: "anywhere" }}>{body}</span>}
      </span>
    </div>
  );
}

/* What the link shows — the same card /app/s/:token draws. */
function ScoreLinkCard({ name, points, logs }) {
  const { t, ts, meta } = useI18n();
  return (
    <div style={{ background: C.white, borderRadius: 20, padding: "22px 20px", textAlign: "center", border: "1.5px solid " + C.warmGray, margin: "10px 0 14px" }}>
      <p style={{ fontFamily: meta.fonts.heading, fontSize: ts(22), color: C.green, margin: "0 0 6px", fontWeight: 700 }}>
        {name ? t("home.score.shared.titleNamed", { name }) : t("home.score.shared.title")}
      </p>
      <p style={{ fontSize: ts(40), fontWeight: 800, color: C.brown, margin: "10px 0 2px", lineHeight: 1 }}>{points}</p>
      <p style={{ fontSize: ts(16), color: C.textMuted, margin: 0 }}>{t("home.score.shared.points")}</p>
      <p style={{ fontSize: ts(17), color: C.textMain, margin: "12px 0 0", lineHeight: 1.5 }}>
        {logs === 1 ? t("home.score.shared.logsOne") : t("home.score.shared.logsMany", { n: logs })}
      </p>
    </div>
  );
}

function StepHeading({ children }) {
  const { ts } = useI18n();
  return <h3 style={{ fontSize: ts(20), fontWeight: 700, color: C.textMain, margin: "0 0 6px" }}>{children}</h3>;
}

function PeopleStep({ audience, summary, firstName, onBack, onClose }) {
  const { t, ts } = useI18n();
  const [names, setNames] = useState(null);
  const [title, setTitle] = useState(
    firstName ? t("home.score.share.notifyTitle", { name: firstName }) : t("home.score.share.notifyTitleAnon")
  );
  const [body, setBody] = useState(t("home.score.share.notifyBody", { points: summary.points }));
  const [state, setState] = useState({ status: "editing", sent: 0, token: null });

  useEffect(() => {
    let alive = true;
    fetchShareAudience(audience)
      .then((n) => alive && setNames(n))
      .catch(() => alive && setNames([]));
    return () => { alive = false; };
  }, [audience]);

  const heading = audience === "circle" ? t("home.score.share.circleTitle") : t("home.score.share.friendsTitle");
  const cannotSend = state.status === "sending" || !title.trim() || !names || names.length === 0;

  const send = async () => {
    if (cannotSend) return;
    setState((s) => ({ ...s, status: "sending" }));
    try {
      const { sent, token } = await shareScoreToAudience(audience, { ...summary, title, body });
      setState({ status: "sent", sent, token });
    } catch {
      setState((s) => ({ ...s, status: "failed" }));
    }
  };

  if (state.status === "sent") {
    return (
      <div role="status">
        <StepHeading>{heading}</StepHeading>
        <p style={{ fontSize: ts(A11Y.minBodyPx), fontWeight: 600, color: C.textMain, margin: "0 0 4px", lineHeight: 1.5 }}>
          {t("share.sentTo", { names: namesLine(names, t) })}
        </p>
        <p style={{ fontSize: ts(16), color: C.textMuted, margin: 0, lineHeight: 1.5 }}>
          {state.sent === 0 ? t("share.sentNone") : state.sent === 1 ? t("share.sentCountOne") : t("share.sentCount", { n: state.sent })}
        </p>
        <NoticePreview title={title} body={body} />
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {state.token && (
            <Link to={"/app/s/" + state.token} style={ghostBtn(ts)}>
              {t("share.openPage")}
            </Link>
          )}
          <button type="button" onClick={onClose} style={primaryBtn(ts, false)}>
            {t("share.done")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <StepHeading>{heading}</StepHeading>
      <p style={{ fontSize: ts(A11Y.minBodyPx), color: C.textMuted, margin: "0 0 12px", lineHeight: 1.5 }}>
        {names === null
          ? t("share.loadingNames")
          : names.length === 0
            ? t("share.nobodyYet")
            : t("share.goesTo", { names: namesLine(names, t) })}
      </p>
      <label style={{ display: "block", fontSize: ts(16), fontWeight: 600, color: C.textMain, marginBottom: 10 }}>
        {t("share.titleLabel")}
        <input value={title} maxLength={140} onChange={(e) => setTitle(e.target.value)} style={fieldStyle(ts)} />
      </label>
      <label style={{ display: "block", fontSize: ts(16), fontWeight: 600, color: C.textMain, marginBottom: 14 }}>
        {t("share.bodyLabel")}
        <textarea value={body} rows={2} maxLength={500} onChange={(e) => setBody(e.target.value)} style={{ ...fieldStyle(ts), resize: "vertical" }} />
      </label>
      {state.status === "failed" && (
        <p role="alert" style={{ fontSize: ts(16), color: C.brown, fontWeight: 600, margin: "0 0 10px" }}>
          {t("home.score.share.shareFailed")}
        </p>
      )}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button type="button" onClick={send} disabled={cannotSend} style={primaryBtn(ts, cannotSend)}>
          {state.status === "sending" ? t("share.sending") : t("share.sendCta")}
        </button>
        <button type="button" onClick={onBack} style={ghostBtn(ts)}>
          {t("share.notNow")}
        </button>
      </div>
    </div>
  );
}

function LinkStep({ summary, firstName, onBack, onClose }) {
  const { t, ts } = useI18n();
  const [state, setState] = useState({ status: "preview", url: "", token: null, copied: false });

  const make = async () => {
    if (state.status === "making") return;
    setState((s) => ({ ...s, status: "making" }));
    try {
      const token = await createScoreShareLink(summary);
      setState({ status: "ready", url: sharedScoreUrl(token), token, copied: false });
    } catch {
      setState((s) => ({ ...s, status: "failed" }));
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(state.url);
      setState((s) => ({ ...s, copied: true }));
    } catch {
      /* No clipboard here. The link is on screen, selectable, either way. */
    }
  };

  return (
    <div>
      <StepHeading>{t("home.score.share.linkTitle")}</StepHeading>
      <p style={{ fontSize: ts(A11Y.minBodyPx), color: C.textMuted, margin: 0, lineHeight: 1.5 }}>
        {state.status === "ready" ? t("share.linkReady") : t("share.linkPreview")}
      </p>
      <ScoreLinkCard name={firstName} points={summary.points} logs={summary.logs} />
      {state.status === "ready" ? (
        <>
          <p style={{ margin: "0 0 12px", fontSize: ts(16), color: C.textMain, wordBreak: "break-all", userSelect: "text" }}>{state.url}</p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button type="button" onClick={copy} style={primaryBtn(ts, false)}>
              {state.copied ? t("share.copied") : t("share.copyCta")}
            </button>
            <Link to={"/app/s/" + state.token} style={ghostBtn(ts)}>
              {t("share.openPage")}
            </Link>
            <button type="button" onClick={onClose} style={ghostBtn(ts)}>
              {t("share.done")}
            </button>
          </div>
        </>
      ) : (
        <>
          {state.status === "failed" && (
            <p role="alert" style={{ fontSize: ts(16), color: C.brown, fontWeight: 600, margin: "0 0 10px" }}>
              {t("home.score.share.shareFailed")}
            </p>
          )}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button type="button" onClick={make} disabled={state.status === "making"} style={primaryBtn(ts, state.status === "making")}>
              {state.status === "making" ? t("share.sending") : t("share.makeLinkCta")}
            </button>
            <button type="button" onClick={onBack} style={ghostBtn(ts)}>
              {t("share.notNow")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function ShareSheet({ onClose, circleMembers, doneCount, points, total }) {
  const { t, ts, meta } = useI18n();
  const { profile } = useSession();
  const navigate = useNavigate();
  const closeRef = useRef(null);
  /* null = the four choices; "circle" | "friends" | "link" = that step. */
  const [step, setStep] = useState(null);

  useBackToClose(true, onClose);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  const circleEmpty = circleMembers.length === 0;
  const today = new Date().toISOString().slice(0, 10);
  const summary = { points, logs: doneCount, day: today };
  const firstName = (profile?.full_name || "").split(" ")[0];

  /* The community card reads points, done and total (0018). This path
     sent only "logs", so the card it made had blanks where its numbers
     belonged; the draft carries all of them. */
  const toCommunity = () => {
    onClose();
    startShareDraft(navigate, {
      type: "score",
      payload: { points, done: doneCount, total, logs: doneCount, day: today },
      body: t("share.scoreBody"),
    });
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
              border: "2px solid " + C.warmGray,
              background: C.white,
              color: C.textMain,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <Icon name="close" size={22} />
          </button>
        </div>

        {step === "circle" || step === "friends" ? (
          <PeopleStep audience={step} summary={summary} firstName={firstName} onBack={() => setStep(null)} onClose={onClose} />
        ) : step === "link" ? (
          <LinkStep summary={summary} firstName={firstName} onBack={() => setStep(null)} onClose={onClose} />
        ) : (
          <>
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
                icon="people"
                title={t("home.score.share.circleTitle")}
                sub={circleEmpty ? t("home.score.share.circleEmpty") : t("home.score.share.circleSend", { n: circleMembers.length })}
                disabled={circleEmpty}
                onClick={() => setStep("circle")}
              />
              <ShareRow
                icon="messages"
                title={t("home.score.share.friendsTitle")}
                sub={t("home.score.share.friendsSub")}
                onClick={() => setStep("friends")}
              />
              <ShareRow
                icon="globe"
                title={t("home.score.share.communityTitle")}
                sub={t("home.score.share.communitySub")}
                onClick={toCommunity}
              />
              <ShareRow
                icon="invite"
                title={t("home.score.share.linkTitle")}
                sub={t("home.score.share.linkSub")}
                onClick={() => setStep("link")}
              />
            </div>
          </>
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
          total={totalModules}
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
