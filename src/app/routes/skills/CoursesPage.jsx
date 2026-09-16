/* ════════════════════════════════════════════════
   Courses and training — /app/skills/courses.

   Owner, 2026-09-13: "Courses and training" is ONE section. Grow shows a
   single entry for it; opening it shows the section's two halves on this
   screen:
     · New courses  — offered to this person and not yet finished
     · Past courses — finished, with the badge that was earned
   There is no separate entry for new or past courses anywhere else.

   It is OPEN. The Saathban course sits under New courses; finishing it and
   earning its badge moves it to Past courses. The move is the database's
   (grow_page, 0164): one completion state, read here, in Pending and on
   the Grow entry alike.
   ════════════════════════════════════════════════ */

import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { APP_COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { fetchGrowPage, pick } from "./growData.js";

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

export function CourseCard({ course, past }) {
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

export default function CoursesPage() {
  const { t, ts, meta } = useI18n();
  const [grow, setGrow] = useState(null); // null = loading
  const [loadFailed, setLoadFailed] = useState(false);
  const alive = useRef(true);

  const load = useCallback(async () => {
    try {
      const data = await fetchGrowPage();
      if (!alive.current) return;
      setGrow({ new_courses: [], past_courses: [], ...(data || {}) });
      setLoadFailed(false);
    } catch {
      if (!alive.current) return;
      setGrow((g) => g || { new_courses: [], past_courses: [] });
      setLoadFailed(true);
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    load();
    return () => {
      alive.current = false;
    };
  }, [load]);

  const grouping = {
    fontFamily: meta.fonts.heading,
    fontSize: ts(22),
    fontWeight: 700,
    color: C.textMain,
    margin: "22px 0 10px",
  };
  const emptyLine = { fontSize: ts(A11Y.minBodyPx), color: C.textMuted, lineHeight: 1.6, margin: "0 0 8px" };

  return (
    <main style={{ minHeight: "100vh", background: C.bg, color: C.textMain, padding: "20px 16px 64px" }}>
      <div className="sb-col" style={{ maxWidth: 620, margin: "0 auto", "--sb-col": "620px" }}>
        <Link
          to="/app/skills"
          data-action="back-to-grow"
          /* position:relative: in Urdu the h1 below starts 3px inside this
             link, and a tap on that strip landed on the heading. */
          style={{ display: "inline-flex", alignItems: "center", minHeight: A11Y.minTapTargetPx, color: C.green, fontWeight: 700, fontSize: ts(A11Y.minBodyPx), textDecoration: "none", position: "relative" }}
        >
          {t("grow.page.backToGrow")}
        </Link>
        <h1 style={{ fontFamily: meta.fonts.heading, fontSize: ts(32), fontWeight: 700, color: C.green, margin: "4px 0 6px" }}>
          {t("grow.page.courses")}
        </h1>
        <p style={{ fontSize: ts(A11Y.minBodyPx), color: C.textMuted, margin: "0 0 8px", lineHeight: 1.6 }}>
          {t("grow.page.coursesDesc")}
        </p>

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

        {grow === null ? (
          <p aria-busy="true" style={{ fontSize: ts(A11Y.minBodyPx), color: C.textMuted }}>···</p>
        ) : (
          <>
            <section data-grouping="new">
              <h2 style={grouping}>{t("grow.page.newCourses")}</h2>
              {grow.new_courses.length === 0 ? (
                <p style={emptyLine}>{t("grow.page.newEmpty")}</p>
              ) : (
                grow.new_courses.map((c) => <CourseCard key={c.id} course={c} />)
              )}
            </section>

            <section data-grouping="past">
              <h2 style={grouping}>{t("grow.page.pastCourses")}</h2>
              {grow.past_courses.length === 0 ? (
                <p style={emptyLine}>{t("grow.page.pastEmpty")}</p>
              ) : (
                grow.past_courses.map((c) => <CourseCard key={c.id} course={c} past />)
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
