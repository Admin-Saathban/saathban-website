/* ════════════════════════════════════════════════
   /app/home — Home. NAVIGATION_SPEC §4.

   Top to bottom: header, composer, today's log as ONE ROW, and then
   the feed. Nothing else.

   WHAT LEFT, AND WHY IT IS NOT A REGRESSION

   The three tiles (Out & about, Friend groups, Grow) are gone. They
   were added on 29 August with the reasoning that two ways into one
   room is not a defect, which was true — but with them present the
   feed began below the fold, and Home is the feed. Two of the three
   are bottom-bar tabs now and Grow is in More, so nothing became
   unreachable; it stopped costing the first screenful.

   The greeting no longer owns a heading. It moved INSIDE the log row,
   which is the §4 change that buys the most vertical space: a row
   that says "Good morning, Ayesha" and "Today's log — 1 of 2" does
   the work the h1 and the bordered card did between them.

   THE LOG ROW HAS NO BORDER, and that is §4.1's rule rather than a
   style preference: an outline means you can tap it. Everything on
   Home that is not a control loses its outline, so the ones that keep
   theirs mean something again. The row is still tappable — the whole
   row is the target, and the chevron says so.

   "Your move — Ludo" is gone. Owner's ruling: a game is entered
   deliberately and left deliberately, and a nudge back into a
   half-finished board turns it into a chore.

   The composer is the posts lane's ComposerRow and arrives with the
   Feed, which is why none is built here.
   ════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { APP_COLORS as C } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { useSession } from "../../lib/session.jsx";
import { useIconPrefs } from "../../lib/iconPrefs.js";
import { useDailyLogs } from "./logStore.js";
import { dayEntries, isEntryDone } from "./DailyLogCard.jsx";
import { greetingKeyForHour, isoDate } from "./homeMock.js";
import AppHeader from "../../components/AppHeader.jsx";
import Icon from "../../components/Icon.jsx";
import { awardMyBadges } from "../../lib/points.js";
import TodayReminders from "./TodayReminders.jsx";
import Feed from "../community/Feed.jsx";
import { PostComposer } from "../community/Composer.jsx";

/* Notifications, Settings, and My profile live in the AppHeader —
   the hub keeps cards for the places, not the chrome. My Circle is
   always here: an empty circle is a door to open, never a gap
   (SPEC.md, "The empty circle" — the page itself renders the door). */

export default function IconHub() {
  const { t, ts, meta } = useI18n();
  const { profile } = useSession();
  const iconId = profile?.id ?? null;
  const firstName = (profile?.full_name || "").split(" ")[0];

  const prefs = useIconPrefs(profile?.id);
  const { logsByDate } = useDailyLogs(iconId);
  const todayLog = logsByDate[isoDate(new Date())] || {};
  const entries = dayEntries(prefs, new Date());
  const done = entries.filter((e) => isEntryDone(e, todayLog)).length;
  /* "All done" only means anything when there was something to do —
     an Icon with every module switched off has done == entries == 0,
     and telling them the day is complete is a receipt for nothing. */
  const allDone = entries.length > 0 && done >= entries.length;

  /* Catch-up award on arriving home. The unseen COUNT is gone with the
     Milestones card that announced it — badges, streaks and
     celebrations are all My Journey's now — but the award itself still
     belongs here, because this is the screen a person opens. */
  useEffect(() => {
    if (!iconId) return undefined;
    awardMyBadges().catch(() => {
      /* the hub never blocks on a celebration */
    });
    return undefined;
  }, [iconId]);




  return (
    <>
      <AppHeader />
      <main
        style={{
          minHeight: "100vh",
          background: C.bg,
          color: C.textMain,
          fontFamily: meta.fonts.body,
          padding: "20px 16px 56px",
        }}
      >
        <div style={{ maxWidth: 600, margin: "0 auto" }}>
          {/* ── §4 item 2: THE COMPOSER, ABOVE THE LOG ──

              Content first, which is the point of the redesign. It sat
              below the log row until now for a structural reason rather
              than a chosen one: the composer lived inside Feed, and Feed
              renders after the log.

              Lane 38 owns that file and designed this seam —
              <PostComposer /> needs no props and announces a landed post
              on the window, so the feed below still does §11's
              reload-and-highlight without owning the thing that was
              typed into.

              Not sticky, and no floating button (MOTION §5): it scrolls
              away with the feed like any other content. */}
          <PostComposer />

          {/* ── §4 item 3: TODAY'S LOG, AS ONE ROW ──

              The greeting lives inside it. Previously this was an h1
              saying "Good morning, Ayesha" followed by an 84px card
              with a 2.5px green outline — two blocks and about 150px
              to say one thing. Now it is a row: the sun, the greeting,
              the count beneath it, a chevron.

              NO BORDER (§4.1). An outline means you can tap it, and
              the whole row is already tappable, so the outline was
              spending contrast on a boundary nobody needed. The fill
              and the chevron do that work.

              The done state is not a separate component any more. It
              is the same row with a tick where the sun was and a
              different line under the greeting, because a row that
              turns into a pill when you finish moves the feed up and
              down under a person's thumb. */}
          <Link
            to="/app/home/log"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              minHeight: 64,
              padding: "10px 6px",
              marginBottom: 6,
              textDecoration: "none",
              color: C.textMain,
            }}
          >
            <Icon
              name={allDone ? "check" : "log"}
              size={26}
              style={{ color: C.green }}
            />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span
                style={{
                  display: "block",
                  fontFamily: meta.fonts.heading,
                  fontSize: ts(20),
                  fontWeight: 700,
                  color: C.green,
                  lineHeight: 1.25,
                }}
              >
                {t(greetingKeyForHour(new Date().getHours()))}
                {firstName ? (meta.dir === "rtl" ? "، " : ", ") + firstName : ""}
              </span>
              <span style={{ display: "block", fontSize: ts(15), color: C.textMuted, marginTop: 1 }}>
                {allDone
                  ? t("hub.logLineDone")
                  : t("hub.logLine", { done, total: entries.length })}
              </span>
            </span>
            <Icon
              name={meta.dir === "rtl" ? "chevronBack" : "chevron"}
              size={20}
              style={{ color: C.textMuted }}
            />
          </Link>

          {/* Reminders stay. §4 lists what Home holds and what was
             deleted, and this is in neither list — an omission, not a
             ruling. One of the things it carries is the medication
             tick-off, and dropping a medicines surface off Home on a
             reading of "nothing else" is not a call to make quietly.
             Flagged for the owner instead. */}

          {/* ── And then the people ──
              THE REAL FEED, not a reader of it. TONIGHT.md §1: home
              and community were two places where the user expected
              one, so everything Community offered moves here —
              composer, Everyone/Friends filter, Connect, origin
              labels, automatic widening. A thinner second copy is what
              made them two screens in the first place. */}
          <Feed composer={false} embedded />
        </div>
      </main>
    </>
  );
}
