/* ════════════════════════════════════════════════
   Skills tab — three real cards, each with a "Tell me when this opens"
   button wired to skill_interest (migration 0012). The button is a
   toggle: tap once to join the list, again to leave. Interest is the
   demand signal that decides what launches (SPEC.md, Skills).

   Any signed-in role. Accessibility floors throughout; the interested
   state is shown with a ✓ and words, never colour alone.
   ════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import supabase from "../../lib/supabase.js";
import { APP_COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { useSession } from "../../lib/session.jsx";
import { STRINGS, SKILLS } from "./strings.js";
import { fetchMyInterests, setInterest } from "./data.js";
import { pushToast } from "../../lib/feedback.jsx";

function SkillCard({ skill, s, interested, busy, onToggle }) {
  const { ts, meta } = useI18n();
  const card = s.cards[skill];
  return (
    <section
      style={{
        background: C.white,
        border: `1px solid ${interested ? C.sage : C.warmGray}`,
        borderRadius: 20,
        padding: 24,
        marginBottom: 18,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
        <span aria-hidden="true" style={{ fontSize: ts(30) }}>{card.emoji}</span>
        <h2 style={{ fontFamily: meta.fonts.heading, fontSize: ts(24), fontWeight: 700, color: C.green, margin: 0 }}>
          {card.name}
        </h2>
      </div>
      <p style={{ fontSize: ts(A11Y.minBodyPx), color: C.textMain, lineHeight: 1.6, margin: "0 0 18px" }}>
        {card.desc}
      </p>

      <button
        type="button"
        aria-pressed={interested}
        disabled={busy}
        onClick={onToggle}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
          minHeight: 56,
          padding: "0 24px",
          borderRadius: 50,
          border: `2px solid ${C.green}`,
          background: interested ? C.green : C.white,
          color: interested ? C.cream : C.green,
          fontSize: ts(A11Y.minBodyPx),
          fontWeight: 600,
          fontFamily: "inherit",
          cursor: busy ? "default" : "pointer",
        }}
      >
        {interested && <span aria-hidden="true">✓</span>}
        {interested ? s.interestedCta : s.interestCta}
      </button>

      {interested && (
        <p role="status" style={{ fontSize: ts(16), color: C.textMuted, margin: "10px 0 0" }}>
          {s.interestedNote}
        </p>
      )}
    </section>
  );
}

/* The things that are actually OPEN. §16 puts the course and the
   survey inside Grow, and until tonight they were routed but nothing
   linked to them — so a person could not reach either. They now sit
   ABOVE the three not-yet-open sections, because a page whose every
   card says "coming soon" teaches people to stop opening it. */
function OpenCard({ title, desc, cta, to, note }) {
  const { ts } = useI18n();
  return (
    <section
      data-open-card={to}
      style={{
        background: C.white,
        border: `2px solid ${C.green}`,
        borderRadius: 18,
        padding: "18px 20px",
        marginBottom: 14,
      }}
    >
      <h2 style={{ fontSize: ts(22), fontWeight: 700, color: C.green, margin: "0 0 6px" }}>{title}</h2>
      <p style={{ fontSize: ts(A11Y.minBodyPx), color: C.textMain, lineHeight: 1.6, margin: "0 0 14px" }}>
        {desc}
      </p>
      {note && (
        <p style={{ fontSize: ts(A11Y.minBodyPx), fontWeight: 700, color: C.green, margin: "0 0 12px" }}>
          🏅 {note}
        </p>
      )}
      <Link
        to={to}
        style={{
          display: "inline-flex",
          alignItems: "center",
          minHeight: A11Y.minTapTargetPx,
          padding: "0 22px",
          borderRadius: 50,
          background: C.green,
          color: C.white,
          fontSize: ts(A11Y.minBodyPx),
          fontWeight: 700,
          textDecoration: "none",
        }}
      >
        {cta}
      </Link>
    </section>
  );
}

export default function SkillsPage() {
  const { lang, ts, meta, t } = useI18n();
  const s = STRINGS[lang] || STRINGS.en;
  const { profile } = useSession();
  const [courseBadge, setCourseBadge] = useState(false);

  const [interested, setInterestedSet] = useState(null); // null = loading; else Set
  const [busy, setBusy] = useState(null); // skill id currently saving
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const mine = await fetchMyInterests();
        if (alive) setInterestedSet(new Set(mine));
      } catch {
        if (alive) setInterestedSet(new Set());
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  /* Whether they already hold the course badge, so the card can say so
     rather than inviting them to earn it twice. */
  useEffect(() => {
    if (!profile?.id) return undefined;
    let alive = true;
    supabase
      .from("course_progress")
      .select("badge_at")
      .eq("profile_id", profile.id)
      .maybeSingle()
      .then(({ data }) => alive && setCourseBadge(!!data?.badge_at));
    return () => { alive = false; };
  }, [profile?.id]);

  const toggle = async (skill) => {
    if (!profile?.id) return;
    const on = !interested.has(skill);
    setError("");
    setBusy(skill);
    // optimistic
    setInterestedSet((prev) => {
      const next = new Set(prev);
      on ? next.add(skill) : next.delete(skill);
      return next;
    });
    try {
      await setInterest(profile.id, skill, on);
      if (on) pushToast(t("feedback.interestNoted"));
    } catch {
      // rollback
      setInterestedSet((prev) => {
        const next = new Set(prev);
        on ? next.delete(skill) : next.add(skill);
        return next;
      });
      setError(s.saveError);
      pushToast(s.saveError, { tone: "error" });
    } finally {
      setBusy(null);
    }
  };

  return (
    <main style={{ minHeight: "100vh", background: C.bg, color: C.textMain, padding: "20px 16px 64px" }}>
      <div style={{ maxWidth: 620, margin: "0 auto" }}>
        <h1 style={{ fontFamily: meta.fonts.heading, fontSize: ts(32), fontWeight: 700, color: C.green, margin: "4px 0 6px" }}>
          {s.title}
        </h1>
        <p style={{ fontSize: ts(A11Y.minBodyPx), color: C.textMuted, margin: "0 0 22px", lineHeight: 1.6 }}>
          {s.subtitle}
        </p>

        {error && (
          <p role="alert" style={{ fontSize: ts(A11Y.minBodyPx), color: C.error, fontWeight: 600, margin: "0 0 16px" }}>
            {error}
          </p>
        )}

        {/* ── Open now ── */}
        <p
          style={{
            fontSize: ts(A11Y.minBodyPx),
            fontWeight: 700,
            color: C.textMuted,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            margin: "0 0 10px",
          }}
        >
          {s.openNow}
        </p>

        <OpenCard
          title={s.courseName}
          desc={s.courseDesc}
          cta={s.courseCta}
          to="/app/skills/course"
          note={courseBadge ? s.courseDone : null}
        />

        {/* §16: the survey is Icons only — no Fam version. The card is
            absent for everyone else rather than shown and refused. */}
        {profile?.role === "saath_icon" && (
          <OpenCard title={s.surveyName} desc={s.surveyDesc} cta={s.surveyCta} to="/app/skills/survey" />
        )}

        <p
          style={{
            fontSize: ts(A11Y.minBodyPx),
            fontWeight: 700,
            color: C.textMuted,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            margin: "26px 0 10px",
          }}
        >
          {s.comingSoon}
        </p>

        {interested === null ? (
          <p aria-busy="true" style={{ fontSize: ts(A11Y.minBodyPx), color: C.textMuted }}>···</p>
        ) : (
          SKILLS.map((skill) => (
            <SkillCard
              key={skill}
              skill={skill}
              s={s}
              interested={interested.has(skill)}
              busy={busy === skill}
              onToggle={() => toggle(skill)}
            />
          ))
        )}
      </div>
    </main>
  );
}
