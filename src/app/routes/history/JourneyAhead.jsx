/* ════════════════════════════════════════════════
   The top of My Journey — PRODUCT_DECISIONS §14.

   Three pieces, in this order, above everything the page already had:

     1. A SHORT HEADER — "47 days with Saathban · since 14 July ·
        3 badges". A sentence about a life, not a scoreboard. There is
        deliberately no points total here: §14 says never a points
        total shouting, and the surest way to keep that promise is not
        to render the number at all.

     2. JUST AHEAD — only things genuinely close (justAhead.js holds
        the rule and its reasoning). If nothing is close, this whole
        section is ABSENT rather than an empty box, because a heading
        over nothing is the scoreboard §14 is trying to avoid.

     3. MONTHS AS CHAPTERS — newest first, each with what happened in
        it. July reads "the first days", never "11/31 logged".

   PER-SECTION SHARING (§14): every chapter carries its own share,
   and so does the journey as a whole. Never one ambiguous Share
   button where nobody knows what it will send — that ambiguity is
   exactly what makes a person not press it.
   ════════════════════════════════════════════════ */

import { useState } from "react";
import { COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { Card, BodyText, SectionLabel } from "./ui.jsx";
import { justAhead, chapters } from "./justAhead.js";

const AHEAD_ICON = { badge: "🌿", event: "🎪", birthday: "🎂", course: "🌱" };

function monthName(key, lang) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(lang === "ur" ? "ur-PK" : "en-GB", {
    month: "long",
    year: "numeric",
  });
}

/* One share control per thing, each saying WHAT it will send. */
function ShareBit({ what, onShare }) {
  const { t, ts } = useI18n();
  return (
    <button
      type="button"
      data-share={what}
      onClick={() => onShare(what)}
      style={{
        minHeight: A11Y.minTapTargetPx,
        padding: "0 16px",
        borderRadius: 50,
        border: `1.5px solid ${C.warmGray}`,
        background: C.white,
        color: C.greenMuted,
        fontFamily: "inherit",
        fontSize: ts(A11Y.minBodyPx),
        fontWeight: 600,
        cursor: "pointer",
      }}
    >
      {t(`history.share.${what}`)}
    </button>
  );
}

export default function JourneyAhead({ progress, badges = [], logRows = [], events = [], birthdays = [], course = null, onShare }) {
  const { t, ts, lang, meta } = useI18n();
  const [openChapter, setOpenChapter] = useState(null);

  const ahead = justAhead({ badges, events, birthdays, course });
  const chapterList = chapters(logRows, badges);
  const earnedCount = badges.filter((b) => b.earned_at).length;

  const since = progress?.first_day
    ? new Date(progress.first_day).toLocaleDateString(lang === "ur" ? "ur-PK" : "en-GB", {
        day: "numeric",
        month: "long",
      })
    : null;

  return (
    <>
      {/* ── 1. The header: a sentence about a life ── */}
      <Card style={{ marginBottom: 16 }}>
        <BodyText style={{ margin: 0, fontSize: ts(20), fontWeight: 700, color: C.textMain }}>
          {[
            progress?.presence_days ? t("history.header.days", { n: progress.presence_days }) : null,
            since ? t("history.header.since", { date: since }) : null,
            earnedCount ? t("history.header.badges", { n: earnedCount }) : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </BodyText>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
          <ShareBit what="whole" onShare={onShare} />
        </div>
      </Card>

      {/* ── 2. Just ahead — absent when nothing is close ── */}
      {ahead.length > 0 && (
        <>
          <SectionLabel>{t("history.ahead.title")}</SectionLabel>
          <Card style={{ marginBottom: 16 }}>
            {ahead.map((a) => (
              <div
                key={`${a.kind}:${a.key}`}
                data-ahead={a.kind}
                style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 44 }}
              >
                <span aria-hidden="true" style={{ fontSize: 22 }}>{AHEAD_ICON[a.kind] || "·"}</span>
                <BodyText style={{ margin: 0 }}>
                  {a.kind === "badge" && Number.isFinite(a.remaining)
                    ? t("history.ahead.badgeNear", { name: a.label, n: a.remaining })
                    : a.label}
                </BodyText>
              </div>
            ))}
          </Card>
        </>
      )}

      {/* ── 3. Months as chapters ── */}
      {chapterList.length > 0 && (
        <>
          <SectionLabel>{t("history.chapters.title")}</SectionLabel>
          {chapterList.map((c) => {
            const open = openChapter === c.key;
            return (
              /* The hook goes on a wrapper, not on Card: this folder's
                 Card takes only {children, style} and silently drops
                 anything else, so data-chapter never reached the DOM
                 and the chapters looked absent while rendering
                 perfectly. Adding a rest-spread to a shared primitive
                 to satisfy a test would be the wrong direction. */
              <div key={c.key} data-chapter={c.key}>
              <Card style={{ marginBottom: 10 }}>
                <button
                  type="button"
                  onClick={() => setOpenChapter(open ? null : c.key)}
                  aria-expanded={open}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    width: "100%",
                    minHeight: A11Y.minTapTargetPx,
                    background: "none",
                    border: "none",
                    padding: 0,
                    fontFamily: "inherit",
                    textAlign: "start",
                    cursor: "pointer",
                  }}
                >
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: ts(20), fontWeight: 700, color: C.textMain }}>
                      {monthName(c.key, lang)}
                    </span>
                    {/* "22 days here" — never "22/31", which is a mark
                        out of a possible score. */}
                    <span style={{ display: "block", fontSize: ts(A11Y.minBodyPx), color: C.textMuted }}>
                      {c.days === 1 ? t("history.chapters.dayOne") : t("history.chapters.days", { n: c.days })}
                      {c.badges.length > 0 && ` · ${t("history.chapters.badges", { n: c.badges.length })}`}
                    </span>
                  </span>
                  <span aria-hidden="true" style={{ color: C.green, fontWeight: 700, fontSize: ts(20) }}>
                    {open ? "▾" : meta.dir === "rtl" ? "‹" : "›"}
                  </span>
                </button>

                {open && (
                  <div style={{ marginTop: 10 }}>
                    {c.badges.map((b) => (
                      <BodyText key={b.key} style={{ margin: "0 0 6px" }}>
                        🌿 {b.name || b.key}
                      </BodyText>
                    ))}
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                      <ShareBit what="chapter" onShare={() => onShare("chapter", c.key)} />
                    </div>
                  </div>
                )}
              </Card>
              </div>
            );
          })}
        </>
      )}
    </>
  );
}
