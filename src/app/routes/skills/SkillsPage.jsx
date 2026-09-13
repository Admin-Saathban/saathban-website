/* ════════════════════════════════════════════════
   Grow with Saathban — /app/skills.

   Top to bottom, as the owner set it out:
     1. the title
     2. a survey bar, when a published survey is offered to this person —
        it drops down slowly (no slide under reduced motion) with the
        survey's name and description; open it or dismiss it
     3. the Pending drawer — a clickable arrow, CLOSED by default. Tapping
        turns the arrow down and reveals what is pending; with nothing
        pending the arrow still turns and nothing drops down
     4. Courses and training — New courses, then Past courses
     5. Not open yet — the three "Tell me when this opens" cards

   ONE STATE, MANY PLACES. This page decides nothing. grow_page() (0164)
   computes the bar, Pending, New and Past from the same completion and
   offer state, so a course in Pending and in New at once is ONE course:
   finishing it anywhere removes it from both and puts it in Past.

   Accessibility floors throughout (18px body, 48px targets, state in
   words as well as colour).
   ════════════════════════════════════════════════ */

import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { APP_COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { useSession } from "../../lib/session.jsx";
import { pushToast } from "../../lib/feedback.jsx";
import { wantsLessMotion } from "../../components/motion.jsx";
import { STRINGS, SKILLS } from "./strings.js";
import { fetchMyInterests, setInterest } from "./data.js";
import { fetchGrowPage, dismissSurvey, pick } from "./growData.js";

const EMPTY = { surveys: [], pending: [], new_courses: [], past_courses: [] };

/* THE BAR DROPS SLOWLY. The height itself is animated (grid rows 0fr →
   1fr), not a max-height ceiling: a max-height of 420px reached a 236px
   bar in a quarter of a second, which is a snap that merely starts late.
   Measured frame by frame, this one is still opening at a full second. */
const GROW_CSS = `
  @keyframes sb-grow-bar-drop {
    0%   { grid-template-rows: 0fr; opacity: 0; margin-bottom: 0; }
    100% { grid-template-rows: 1fr; opacity: 1; margin-bottom: 18px; }
  }
  @keyframes sb-grow-bar-slide {
    0%   { transform: translateY(-28px); }
    100% { transform: translateY(0); }
  }
  @keyframes sb-grow-bar-lift {
    0%   { grid-template-rows: 1fr; opacity: 1; margin-bottom: 18px; }
    100% { grid-template-rows: 0fr; opacity: 0; margin-bottom: 0; }
  }
  @keyframes sb-grow-bar-fade { from { opacity: 0; } to { opacity: 1; } }
  /* Slow on purpose: a bar that snaps in reads as an alert. */
  .sb-grow-bar { display: grid; grid-template-rows: 1fr; margin-bottom: 18px;
    animation: sb-grow-bar-drop 1600ms cubic-bezier(.3,.55,.35,1) 300ms both; }
  .sb-grow-bar-inner { min-height: 0; overflow: hidden;
    animation: sb-grow-bar-slide 1600ms cubic-bezier(.3,.55,.35,1) 300ms both; }
  .sb-grow-bar.is-leaving { animation: sb-grow-bar-lift 520ms ease-in both; }
  .sb-grow-bar.is-leaving .sb-grow-bar-inner { animation: none; }
  .sb-grow-arrow { display: inline-block; transition: transform 240ms ease; }
  .sb-grow-drawer { animation: sb-grow-drawer-in 260ms ease-out both; }
  @keyframes sb-grow-drawer-in { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: none; } }
  @media (prefers-reduced-motion: reduce) {
    .sb-grow-bar, .sb-grow-bar-inner, .sb-grow-bar.is-leaving, .sb-grow-drawer { animation: none; }
    .sb-grow-arrow { transition: none; }
  }
`;

const srOnly = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
  border: 0,
};

function SkillCard({ skill, s, interested, busy, onToggle }) {
  const { ts, meta } = useI18n();
  const card = s.cards[skill];
  return (
    <section
      id={`grow-skill-${skill}`}
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
        <h3 style={{ fontFamily: meta.fonts.heading, fontSize: ts(24), fontWeight: 700, color: C.green, margin: 0 }}>
          {card.name}
        </h3>
      </div>
      <p style={{ fontSize: ts(A11Y.minBodyPx), color: C.textMain, lineHeight: 1.6, margin: "0 0 18px" }}>
        {card.desc}
      </p>
      <InterestButton interested={interested} busy={busy} onToggle={onToggle} s={s} />
      {interested && (
        <p role="status" style={{ fontSize: ts(16), color: C.textMuted, margin: "10px 0 0" }}>
          {s.interestedNote}
        </p>
      )}
    </section>
  );
}

function InterestButton({ interested, busy, onToggle, s }) {
  const { ts } = useI18n();
  return (
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
  );
}

const pillLink = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: A11Y.minTapTargetPx,
  padding: "0 22px",
  borderRadius: 50,
  background: C.green,
  color: C.white,
  fontWeight: 700,
  textDecoration: "none",
  border: "none",
  fontFamily: "inherit",
  cursor: "pointer",
};

/* ── 2. The survey bar ── */
function SurveyBar({ survey, onDismissed }) {
  const { t, ts, lang, meta } = useI18n();
  const navigate = useNavigate();
  const [leaving, setLeaving] = useState(false);
  const [busy, setBusy] = useState(false);

  const dismiss = async () => {
    setBusy(true);
    try {
      await dismissSurvey(survey.id);
    } catch {
      setBusy(false);
      pushToast(t("grow.page.dismissFailed"), { tone: "error", key: "grow-bar" });
      return;
    }
    pushToast(t("grow.bar.dismissed"), { key: "grow-bar" });
    if (wantsLessMotion()) {
      onDismissed();
      return;
    }
    setLeaving(true);
    window.setTimeout(onDismissed, 540);
  };

  return (
    <aside
      className={`sb-grow-bar${leaving ? " is-leaving" : ""}`}
      data-survey-bar={survey.id}
      aria-label={t("grow.bar.label")}
    >
      <div className="sb-grow-bar-inner">
      <div
        style={{
          background: C.white,
          border: `2px solid ${C.green}`,
          borderRadius: 18,
          padding: "16px 18px",
        }}
      >
        <p style={{ fontSize: ts(15), fontWeight: 700, color: C.textMuted, margin: "0 0 4px", letterSpacing: meta.dir === "rtl" ? 0 : "0.03em" }}>
          {t("grow.bar.label")}
        </p>
        <h2 style={{ fontFamily: meta.fonts.heading, fontSize: ts(22), fontWeight: 700, color: C.green, margin: "0 0 6px", lineHeight: meta.dir === "rtl" ? meta.lineHeight : 1.3 }}>
          {pick(survey, "title", lang)}
        </h2>
        <p style={{ fontSize: ts(A11Y.minBodyPx), color: C.textMain, lineHeight: 1.6, margin: "0 0 14px" }}>
          {pick(survey, "desc", lang)}
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            data-action="open-survey"
            style={{ ...pillLink, fontSize: ts(A11Y.minBodyPx) }}
            onClick={() => navigate(`/app/skills/survey/${survey.id}`)}
          >
            {survey.started ? t("grow.bar.resume") : t("grow.bar.open")}
          </button>
          <button
            type="button"
            data-action="dismiss-survey"
            disabled={busy}
            onClick={dismiss}
            style={{
              ...pillLink,
              fontSize: ts(A11Y.minBodyPx),
              background: C.white,
              color: C.textMain,
              border: `2px solid ${C.warmGray}`,
              fontWeight: 600,
            }}
          >
            {t("grow.bar.dismiss")}
          </button>
        </div>
      </div>
      </div>
    </aside>
  );
}

/* ── 3. Pending ── */
function PendingDrawer({ items, s, interested, busySkill, onToggleInterest }) {
  const { t, ts, lang, meta } = useI18n();
  const [open, setOpen] = useState(false);
  const rtl = meta.dir === "rtl";
  const hasItems = items.length > 0;

  const label = (item) => {
    if (item.type === "skill") return s.cards[item.skill]?.name || item.skill;
    return pick(item, "title", lang);
  };
  const kindLabel = (item) =>
    item.type === "course" ? t(`grow.page.kind.${item.kind}`) : t(`grow.page.kind.${item.type}`);

  return (
    <section data-pending={hasItems ? "items" : "empty"} style={{ marginBottom: 26 }}>
      <button
        type="button"
        data-pending-toggle
        aria-expanded={open}
        aria-controls="sb-grow-pending"
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          width: "100%",
          minHeight: 56,
          padding: "0 16px",
          borderRadius: 16,
          border: `1.5px solid ${C.warmGray}`,
          background: C.white,
          color: C.textMain,
          fontFamily: "inherit",
          fontSize: ts(20),
          fontWeight: 700,
          textAlign: "start",
          cursor: "pointer",
        }}
      >
        <span
          aria-hidden="true"
          className="sb-grow-arrow"
          data-arrow={open ? "down" : "closed"}
          style={{
            color: C.green,
            fontSize: ts(18),
            width: 22,
            textAlign: "center",
            transform: open ? (rtl ? "rotate(-90deg)" : "rotate(90deg)") : "none",
          }}
        >
          {rtl ? "◀" : "▶"}
        </span>
        <span style={{ flex: 1 }}>{t("grow.page.pending")}</span>
      </button>

      {/* Nothing pending: the arrow turns and nothing drops down. A
          screen reader still hears why nothing appeared. */}
      <p role="status" style={srOnly}>
        {open && !hasItems ? t("grow.page.nothingPending") : ""}
      </p>

      {open && hasItems && (
        <ul
          id="sb-grow-pending"
          className="sb-grow-drawer"
          style={{ listStyle: "none", margin: "10px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 10 }}
        >
          {items.map((item) => (
            <li
              key={item.id}
              data-pending-item={item.type}
              data-target={item.target || item.skill}
              style={{
                background: C.white,
                border: `1px solid ${C.warmGray}`,
                borderInlineStart: `4px solid ${C.green}`,
                borderRadius: 14,
                padding: "14px 16px",
              }}
            >
              <p style={{ fontSize: ts(15), fontWeight: 700, color: C.textMuted, margin: "0 0 2px" }}>{kindLabel(item)}</p>
              <p style={{ fontSize: ts(20), fontWeight: 700, color: C.textMain, margin: "0 0 10px", lineHeight: rtl ? meta.lineHeight : 1.35 }}>
                {label(item)}
              </p>
              {item.type === "course" && (
                <Link to={`/app/skills/course/${item.target}`} style={{ ...pillLink, fontSize: ts(A11Y.minBodyPx) }}>
                  {t("grow.page.open")}
                </Link>
              )}
              {item.type === "survey" && (
                <Link to={`/app/skills/survey/${item.target}`} style={{ ...pillLink, fontSize: ts(A11Y.minBodyPx) }}>
                  {t("grow.page.open")}
                </Link>
              )}
              {item.type === "skill" && (
                <InterestButton
                  s={s}
                  interested={interested?.has(item.skill) || false}
                  busy={busySkill === item.skill}
                  onToggle={() => onToggleInterest(item.skill)}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ── 4. Courses and training ── */
function CourseCard({ course, past }) {
  const { t, ts, lang, meta } = useI18n();
  const dateLocale = lang === "ur" ? "ur-PK" : "en-GB";
  const badgeName = course.badge ? pick(course.badge, "name", lang) : "";
  return (
    <article
      data-course={course.id}
      data-course-slug={course.slug || ""}
      data-course-state={past ? "past" : "new"}
      style={{
        background: C.white,
        border: `${past ? 1 : 2}px solid ${past ? C.warmGray : C.green}`,
        borderRadius: 18,
        padding: "18px 20px",
        marginBottom: 14,
      }}
    >
      <p style={{ fontSize: ts(15), fontWeight: 700, color: C.textMuted, margin: "0 0 2px" }}>
        {t(`grow.page.kind.${course.kind}`)}
      </p>
      <h4 style={{ fontFamily: meta.fonts.heading, fontSize: ts(22), fontWeight: 700, color: C.green, margin: "0 0 6px", lineHeight: meta.dir === "rtl" ? meta.lineHeight : 1.3 }}>
        {pick(course, "title", lang)}
      </h4>
      <p style={{ fontSize: ts(A11Y.minBodyPx), color: C.textMain, lineHeight: 1.6, margin: "0 0 12px" }}>
        {pick(course, "desc", lang)}
      </p>

      {past ? (
        <>
          {course.badge && (
            <p data-earned-badge={course.badge.key} style={{ fontSize: ts(A11Y.minBodyPx), fontWeight: 700, color: C.green, margin: "0 0 4px" }}>
              <span aria-hidden="true">{course.badge.emoji} </span>
              {t("grow.page.badgeEarned", { badge: badgeName })}
            </p>
          )}
          {course.completed_at && (
            <p style={{ fontSize: ts(16), color: C.textMuted, margin: "0 0 12px" }}>
              {t("grow.page.finishedOn", {
                date: new Date(course.completed_at).toLocaleDateString(dateLocale, { day: "numeric", month: "long", year: "numeric" }),
              })}
            </p>
          )}
          <Link
            to={`/app/skills/course/${course.id}`}
            style={{ ...pillLink, fontSize: ts(A11Y.minBodyPx), background: C.white, color: C.green, border: `2px solid ${C.green}` }}
          >
            {t("grow.page.review")}
          </Link>
        </>
      ) : (
        <>
          {course.badge && (
            <p data-badge={course.badge.key} style={{ fontSize: ts(16), color: C.textMuted, margin: "0 0 6px" }}>
              <span aria-hidden="true">{course.badge.emoji} </span>
              {t("grow.page.earns", { badge: badgeName })}
            </p>
          )}
          {course.started && (
            <p style={{ fontSize: ts(16), fontWeight: 600, color: C.textMain, margin: "0 0 12px" }}>
              {t("grow.page.started")}
            </p>
          )}
          <Link to={`/app/skills/course/${course.id}`} style={{ ...pillLink, fontSize: ts(A11Y.minBodyPx), marginTop: 4 }}>
            {course.started ? t("grow.page.continue") : t("grow.page.open")}
          </Link>
        </>
      )}
    </article>
  );
}

export default function SkillsPage() {
  const { lang, ts, meta, t } = useI18n();
  const s = STRINGS[lang] || STRINGS.en;
  const { profile } = useSession();

  const [grow, setGrow] = useState(null); // null = loading
  const [loadFailed, setLoadFailed] = useState(false);
  const [interested, setInterestedSet] = useState(null); // null = loading; else Set
  const [busy, setBusy] = useState(null); // skill id currently saving
  const [error, setError] = useState("");
  const alive = useRef(true);

  const load = useCallback(async () => {
    try {
      const data = await fetchGrowPage();
      if (!alive.current) return;
      setGrow({ ...EMPTY, ...(data || {}) });
      setLoadFailed(false);
    } catch {
      if (!alive.current) return;
      setGrow((g) => g || EMPTY);
      setLoadFailed(true);
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    load();
    (async () => {
      try {
        const mine = await fetchMyInterests();
        if (alive.current) setInterestedSet(new Set(mine));
      } catch {
        if (alive.current) setInterestedSet(new Set());
      }
    })();
    return () => {
      alive.current = false;
    };
  }, [load]);

  const toggle = async (skill) => {
    if (!profile?.id || !interested) return;
    const on = !interested.has(skill);
    setError("");
    setBusy(skill);
    setInterestedSet((prev) => {
      const next = new Set(prev);
      on ? next.add(skill) : next.delete(skill);
      return next;
    });
    try {
      await setInterest(profile.id, skill, on);
      if (on) pushToast(t("feedback.interestNoted"));
      /* Asking to be told is what completes a "tell me" pointer in
         Pending, so the server is asked again rather than guessed. */
      load();
    } catch {
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

  const survey = grow?.surveys?.[0] || null;

  const sectionLabel = {
    fontSize: ts(A11Y.minBodyPx),
    fontWeight: 700,
    color: C.textMuted,
    letterSpacing: meta.dir === "rtl" ? 0 : "0.04em",
    textTransform: meta.dir === "rtl" ? "none" : "uppercase",
    margin: "26px 0 10px",
  };
  const subHeading = {
    fontFamily: meta.fonts.heading,
    fontSize: ts(20),
    fontWeight: 700,
    color: C.textMain,
    margin: "16px 0 10px",
  };
  const emptyLine = { fontSize: ts(A11Y.minBodyPx), color: C.textMuted, lineHeight: 1.6, margin: "0 0 8px" };

  return (
    <main style={{ minHeight: "100vh", background: C.bg, color: C.textMain, padding: "20px 16px 64px" }}>
      <style>{GROW_CSS}</style>
      <div style={{ maxWidth: 620, margin: "0 auto" }}>
        <h1 style={{ fontFamily: meta.fonts.heading, fontSize: ts(32), fontWeight: 700, color: C.green, margin: "4px 0 6px" }}>
          {t("grow.page.title")}
        </h1>
        <p style={{ fontSize: ts(A11Y.minBodyPx), color: C.textMuted, margin: "0 0 18px", lineHeight: 1.6 }}>
          {s.subtitle}
        </p>

        {error && (
          <p role="alert" style={{ fontSize: ts(A11Y.minBodyPx), color: C.error, fontWeight: 600, margin: "0 0 16px" }}>
            {error}
          </p>
        )}
        {loadFailed && (
          <p role="alert" style={{ fontSize: ts(A11Y.minBodyPx), color: C.error, fontWeight: 600, margin: "0 0 16px" }}>
            {t("grow.page.loadFailed")}{" "}
            <button
              type="button"
              onClick={load}
              style={{ minHeight: A11Y.minTapTargetPx, border: "none", background: "none", color: C.green, fontWeight: 700, textDecoration: "underline", fontSize: ts(A11Y.minBodyPx), fontFamily: "inherit", cursor: "pointer" }}
            >
              {t("grow.page.retry")}
            </button>
          </p>
        )}

        {/* 2 — one offered survey at a time; the next drops after this one goes. */}
        {survey && (
          <SurveyBar
            key={survey.id}
            survey={survey}
            onDismissed={() => {
              setGrow((g) => ({ ...g, surveys: g.surveys.filter((x) => x.id !== survey.id) }));
              load();
            }}
          />
        )}

        {grow === null ? (
          <p aria-busy="true" style={{ fontSize: ts(A11Y.minBodyPx), color: C.textMuted }}>···</p>
        ) : (
          <>
            {/* 3 */}
            <PendingDrawer
              items={grow.pending}
              s={s}
              interested={interested}
              busySkill={busy}
              onToggleInterest={toggle}
            />

            {/* 4 */}
            <section data-section="courses">
              <h2 style={{ fontFamily: meta.fonts.heading, fontSize: ts(26), fontWeight: 700, color: C.green, margin: "8px 0 4px" }}>
                {t("grow.page.courses")}
              </h2>

              <h3 style={subHeading} data-heading="new">{t("grow.page.newCourses")}</h3>
              {grow.new_courses.length === 0 ? (
                <p style={emptyLine}>{t("grow.page.newEmpty")}</p>
              ) : (
                grow.new_courses.map((c) => <CourseCard key={c.id} course={c} />)
              )}

              <h3 style={subHeading} data-heading="past">{t("grow.page.pastCourses")}</h3>
              {grow.past_courses.length === 0 ? (
                <p style={emptyLine}>{t("grow.page.pastEmpty")}</p>
              ) : (
                grow.past_courses.map((c) => <CourseCard key={c.id} course={c} past />)
              )}
            </section>
          </>
        )}

        {/* 5 */}
        <p style={sectionLabel}>{s.comingSoon}</p>
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
