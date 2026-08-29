/* ════════════════════════════════════════════════
   Your milestones — the points → badges → celebrations loop
   (SPEC.md, "Points, character, celebrations").

   On mount the screen calls the catch-up award RPC (idempotent; new
   logs and posts already award via DB triggers), then celebrates each
   unseen badge ONCE — a warm full-screen moment, one badge at a time,
   marked seen on Continue. If a human at Saathban attached a note to
   the award, it appears inside the celebration.

   No comparison anywhere: no counts of other people, no ranks, no
   "top". Unearned badges render as things still ahead — doors, never
   locks.
   ════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import {
  fetchMyProgress,
  fetchBadgeDefinitions,
  fetchMyEarnedBadges,
  awardMyBadges,
  markBadgeSeen,
  ARC_TARGET_DAYS,
} from "../../lib/points.js";
import { Card, SectionLabel, PrimaryBtn, BodyText } from "./ui.jsx";

const css = `
  .ms-celebrate { animation: msPop 0.5s ease both; }
  @keyframes msPop {
    from { opacity: 0; transform: scale(0.92) translateY(14px); }
    to { opacity: 1; transform: none; }
  }
  @media (prefers-reduced-motion: reduce) {
    .ms-celebrate { animation: none !important; }
  }
`;

const badgeName = (b, lang) => (lang === "ur" ? b.name_ur : b.name_en);
const badgeDesc = (b, lang) => (lang === "ur" ? b.desc_ur : b.desc_en);

function Celebration({ badge, earned, onContinue, busy }) {
  const { t, ts, lang, meta } = useI18n();
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("milestones.celebration.heading")}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        background: "rgba(6, 50, 20, 0.88)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        className="ms-celebrate"
        style={{
          width: "min(100%, 460px)",
          background: C.cream,
          borderRadius: 26,
          padding: "36px 26px",
          textAlign: "center",
        }}
      >
        <p aria-hidden="true" style={{ fontSize: 72, lineHeight: 1, margin: "0 0 10px" }}>
          {badge.emoji}
        </p>
        <p style={{ fontSize: ts(18), fontWeight: 700, color: C.greenMuted, letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 6px" }}>
          {t("milestones.celebration.heading")}
        </p>
        <h1
          lang={lang}
          style={{
            fontFamily: meta.fonts.heading,
            fontSize: ts(30),
            fontWeight: 700,
            color: C.green,
            margin: "0 0 12px",
          }}
        >
          {badgeName(badge, lang)}
        </h1>
        <BodyText lang={lang} style={{ marginBottom: 18 }}>
          {badgeDesc(badge, lang)}
        </BodyText>

        {earned.message && (
          <div
            style={{
              background: C.white,
              border: `2px solid ${C.sage}`,
              borderRadius: 16,
              padding: "16px 18px",
              margin: "0 0 20px",
              textAlign: "start",
            }}
          >
            <p style={{ fontSize: ts(18), fontWeight: 700, color: C.greenMuted, margin: "0 0 6px" }}>
              💌 {t("milestones.celebration.messageLabel")}
            </p>
            <BodyText style={{ margin: 0 }}>{earned.message}</BodyText>
          </div>
        )}

        <PrimaryBtn onClick={onContinue} disabled={busy} style={{ width: "100%" }}>
          {t("milestones.celebration.continueCta")}
        </PrimaryBtn>
      </div>
    </div>
  );
}

export default function Milestones() {
  const { t, ts, lang, meta } = useI18n();

  const [progress, setProgress] = useState(null);
  const [defs, setDefs] = useState([]);
  const [earned, setEarned] = useState([]);
  const [queue, setQueue] = useState([]); // unseen earned rows, celebrated one by one
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await awardMyBadges().catch(() => []); // catch-up; triggers cover live events
        const [p, d, e] = await Promise.all([
          fetchMyProgress(),
          fetchBadgeDefinitions(),
          fetchMyEarnedBadges(),
        ]);
        if (cancelled) return;
        setProgress(p);
        setDefs(d);
        setEarned(e);
        setQueue(e.filter((x) => !x.seen_at));
      } catch {
        if (!cancelled) {
          setError("milestones.loadError");
          setProgress({ points: 0, presence_days: 0, current_streak: 0 });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const defByKey = Object.fromEntries(defs.map((d) => [d.key, d]));
  const earnedKeys = new Set(earned.map((e) => e.badge_key));

  const continueCelebration = async () => {
    const current = queue[0];
    setBusy(true);
    try {
      await markBadgeSeen(current.id);
      setEarned((prev) =>
        prev.map((e) => (e.id === current.id ? { ...e, seen_at: new Date().toISOString() } : e))
      );
      setQueue((q) => q.slice(1));
    } catch {
      setQueue((q) => q.slice(1)); // never trap someone in a celebration
    } finally {
      setBusy(false);
    }
  };

  const days = progress?.presence_days ?? 0;
  const arcPct = Math.min(100, Math.round((days / ARC_TARGET_DAYS) * 100));
  const celebrating = queue.length > 0 && defByKey[queue[0].badge_key];

  return (
    <>
      <style>{css}</style>

      {celebrating && (
        <Celebration
          badge={defByKey[queue[0].badge_key]}
          earned={queue[0]}
          onContinue={continueCelebration}
          busy={busy}
        />
      )}

      <h1
        style={{
          fontFamily: meta.fonts.heading,
          fontSize: ts(32),
          fontWeight: 700,
          color: C.green,
          margin: "12px 0 8px",
        }}
      >
        {t("milestones.title")}
      </h1>
      <BodyText muted>{t("milestones.intro")}</BodyText>

      {error && (
        <BodyText role="alert" style={{ fontWeight: 700, color: C.brown }}>
          ⚠ {t(error)}
        </BodyText>
      )}

      {/* Points + streak */}
      <Card style={{ background: C.green, border: "none", color: C.cream }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
          <div style={{ textAlign: "center" }}>
            <span style={{ display: "block", fontSize: ts(48), fontWeight: 700, lineHeight: 1 }}>
              {progress ? progress.points : "…"}
            </span>
            <span style={{ display: "block", fontSize: ts(18), opacity: 0.9, marginTop: 4 }}>
              {t("milestones.points.label")}
            </span>
          </div>
          <div style={{ flex: "1 1 220px" }}>
            <p style={{ fontSize: ts(18), lineHeight: 1.55, margin: "0 0 8px", fontWeight: 500 }}>
              {t("milestones.points.line")}
            </p>
            <p style={{ fontSize: ts(18), lineHeight: 1.5, margin: 0, opacity: 0.9 }}>
              {(progress?.current_streak ?? 0) === 0
                ? t("milestones.streak.lineNone")
                : (progress?.current_streak ?? 0) === 1
                ? t("milestones.streak.lineOne")
                : t("milestones.streak.lineMany", { n: progress?.current_streak ?? 0 })}{" "}
              {t("milestones.streak.forgiveness")}
            </p>
          </div>
        </div>
      </Card>

      {/* The 100-day arc */}
      <Card>
        <p style={{ fontFamily: meta.fonts.heading, fontSize: ts(22), fontWeight: 700, color: C.brown, margin: "0 0 6px" }}>
          🌳 {t("milestones.arc.title")}
        </p>
        <BodyText style={{ marginBottom: 10 }}>
          {days >= ARC_TARGET_DAYS
            ? t("milestones.arc.done")
            : days === 0
            ? t("milestones.arc.lineNone")
            : days === 1
            ? t("milestones.arc.lineOne")
            : t("milestones.arc.lineMany", { days })}
        </BodyText>
        <div
          role="progressbar"
          aria-valuenow={Math.min(days, ARC_TARGET_DAYS)}
          aria-valuemin={0}
          aria-valuemax={ARC_TARGET_DAYS}
          aria-label={t("milestones.arc.title")}
          style={{ height: 14, borderRadius: 7, background: C.cream, border: `1px solid ${C.warmGray}`, overflow: "hidden", marginBottom: 10 }}
        >
          <div
            style={{
              width: `${Math.max(arcPct, days > 0 ? 4 : 0)}%`,
              height: "100%",
              borderRadius: 7,
              background: C.sage,
            }}
          />
        </div>
        <BodyText muted style={{ margin: 0, fontSize: ts(18) }}>
          {t("milestones.arc.note")}
        </BodyText>
      </Card>

      {/* Earned badges */}
      {earned.length > 0 && (
        <>
          <SectionLabel>{t("milestones.badges.earnedLabel")}</SectionLabel>
          {earned
            .slice()
            .reverse()
            .map((e) => {
              const b = defByKey[e.badge_key];
              if (!b) return null;
              return (
                <Card key={e.id} style={{ padding: 18 }}>
                  <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                    <span aria-hidden="true" style={{ fontSize: ts(34), lineHeight: 1 }}>
                      {b.emoji}
                    </span>
                    <div style={{ flex: 1 }}>
                      <BodyText lang={lang} style={{ fontWeight: 700, margin: 0 }}>
                        {badgeName(b, lang)}
                      </BodyText>
                      <BodyText lang={lang} muted style={{ margin: "2px 0 0", fontSize: ts(16) }}>
                        {badgeDesc(b, lang)}
                      </BodyText>
                      <BodyText muted style={{ margin: "6px 0 0", fontSize: ts(16) }}>
                        {t("milestones.badges.earnedOn", {
                          date: new Date(e.earned_at).toLocaleDateString(
                            lang === "ur" ? "ur-PK" : "en-GB",
                            { day: "numeric", month: "long" }
                          ),
                        })}
                      </BodyText>
                      {e.message && (
                        <div
                          style={{
                            background: C.cream,
                            border: `1.5px solid ${C.sage}`,
                            borderRadius: 12,
                            padding: "10px 14px",
                            marginTop: 10,
                          }}
                        >
                          <BodyText style={{ margin: 0, fontSize: ts(17) }}>
                            💌 <strong>{t("milestones.badges.noteFrom")}:</strong> {e.message}
                          </BodyText>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
        </>
      )}

      {/* Still ahead — doors, never locks */}
      <SectionLabel>{t("milestones.badges.aheadLabel")}</SectionLabel>
      <BodyText muted style={{ fontSize: ts(18) }}>
        {t("milestones.badges.aheadNote")}
      </BodyText>
      {defs
        .filter((b) => !earnedKeys.has(b.key))
        .map((b) => (
          <Card key={b.key} style={{ padding: 18, background: "rgba(255,255,255,0.6)" }}>
            <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
              <span aria-hidden="true" style={{ fontSize: ts(30), lineHeight: 1, opacity: 0.55 }}>
                {b.emoji}
              </span>
              <div>
                <BodyText lang={lang} style={{ fontWeight: 600, margin: 0, color: C.textMuted }}>
                  {badgeName(b, lang)}
                </BodyText>
                <BodyText lang={lang} muted style={{ margin: "2px 0 0", fontSize: ts(16) }}>
                  {badgeDesc(b, lang)}
                </BodyText>
              </div>
            </div>
          </Card>
        ))}
    </>
  );
}
