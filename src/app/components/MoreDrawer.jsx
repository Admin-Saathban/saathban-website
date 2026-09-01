/* ════════════════════════════════════════════════
   More — NAVIGATION_SPEC §6. A drawer, not a page.

   Seven rows, NO GROUP HEADERS. "Every so often" and "Now and then"
   were synonyms: a person could not predict which one held what, so
   the labels cost a glance and returned nothing. Seven rows do not
   need chapters.

   The rows come from navItems.js, which the bottom bar reads too, so
   the bar and this drawer can never disagree about what exists.

   THE CALENDAR ROW CARRIES A LIVE COUNT (§6, row 1). It is the one row
   whose contents change hour to hour, and "2 things today" is the
   difference between a menu entry and a reason to tap. It is computed
   from the same recurrence rule the calendar screen draws with — see
   moreCount.js for why counting rows would have been wrong. A count of
   zero shows nothing at all rather than "0 things today": §0.6, and
   also because a nought beside a person's day is a small unkindness
   for no information.

   Every row opens FULL SCREEN and back returns here with the drawer
   still open — the history mechanism is in Drawer.jsx.
   ════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { APP_COLORS as C, A11Y } from "../../shared/tokens.js";
import { buildStamp } from "../../shared/build.js";
import { useI18n } from "../lib/i18n.jsx";
import { useSession } from "../lib/session.jsx";
import Drawer from "./Drawer.jsx";
import { moreGroups } from "./navItems.js";
import { openFullScreen } from "./motion.jsx";
import { countToday } from "./moreCount.js";
import Icon from "./Icon.jsx";

export const MORE_DRAWER_ID = "more";

/* Computed once at module load: it cannot change while the app is
   running, and recomputing it per render would be a date object per
   open of the drawer for a string that is frozen at build time. */
const BUILD_STAMP = buildStamp();

export default function MoreDrawer({ open, onClose, role, buddyActive }) {
  const { t, ts, meta } = useI18n();
  const { profile } = useSession();
  const navigate = useNavigate();
  const [today, setToday] = useState(null);

  /* Counted when the drawer opens, not on every render of the bar.
     This is two queries, and the bar is mounted on every screen in the
     app — running them behind a closed drawer would be a background
     poll nobody asked for. */
  useEffect(() => {
    if (!open || !profile?.id) return undefined;
    let alive = true;
    countToday()
      .then((n) => alive && setToday(n))
      .catch(() => {
        /* No count is fine; a wrong count is not. Leave the row plain. */
      });
    return () => {
      alive = false;
    };
  }, [open, profile?.id]);

  const rows = moreGroups(role, { buddyActive }).flatMap((g) => g.items);

  const go = (to) => {
    /* The destination arrives from the side the drawer is on, which is
       the side the More button is on. The drawer stays in history
       underneath, so back comes home to it. */
    openFullScreen(navigate, to, "end");
  };

  /* FROM THE TOP, because More lives in the header's top-right corner
     now rather than in the bar. MOTION §4 says a panel grows from the
     button that opened it; the button moved, so the origin moves with it.
     Drawer already mirrors this for RTL. Nothing else about §4 changes —
     same timing, same dim, same first-tap-is-consumed.

     (Plain comment: this sits in the return's expression position,
     where a brace opens an object literal rather than a child slot.
     Fourth time tonight across two lanes — it is not a typo, it is that
     the correct form changes with position.) */
  return (
    <Drawer id={MORE_DRAWER_ID} open={open} onClose={onClose} from="top" labelledBy="sb-more-title">
      <h2
        id="sb-more-title"
        style={{
          fontFamily: meta.fonts.heading,
          fontSize: ts(19),
          fontWeight: 700,
          color: C.green,
          margin: "6px 10px 10px",
        }}
      >
        {t("hub.more")}
      </h2>

      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {rows.map((item) => {
          const isCalendar = item.to === "/app/calendar";
          const count = isCalendar && today > 0 ? today : null;
          return (
            <li key={item.to}>
              <button
                type="button"
                onClick={() => go(item.to)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  /* §8's floor outside games. The row is the target,
                     not the emoji and not the word. */
                  minHeight: A11Y.minTapTargetPx + 8,
                  padding: "10px 12px",
                  borderRadius: 14,
                  /* §4.1 — no outline. The fill and the chevron say
                     it is tappable; seven outlined boxes in an 80%
                     wide panel is a cage. */
                  border: "none",
                  background: "transparent",
                  color: C.textMain,
                  fontFamily: "inherit",
                  fontSize: ts(A11Y.minBodyPx),
                  fontWeight: 600,
                  textAlign: "start",
                  cursor: "pointer",
                }}
              >
                <Icon name={item.icon} size={22} style={{ color: C.green }} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  {/* THE LINE BOX IS THE LANGUAGE'S, NOT A CONSTANT.

                     1.3 is fine for Latin and wrong for Nastaliq,
                     whose letters hang off a descending diagonal —
                     at the largest text size "سیکھیں ساتھ بن کے ساتھ"
                     wraps to two lines and the tails of the first
                     collide with the heads of the second. meta
                     carries 1.6 for English and 2.1 for Urdu for
                     exactly this. This is the overlap the tokens file
                     warns about, found by looking at the Urdu
                     screenshot at the largest size. */}
                  <span style={{ display: "block", lineHeight: meta.lineHeight }}>
                    {t(item.key)}
                  </span>
                  {count !== null && (
                    <span
                      style={{
                        display: "block",
                        fontSize: ts(14),
                        fontWeight: 600,
                        color: C.green,
                        marginTop: 1,
                      }}
                    >
                      {t("calendar.thingsToday", { n: count })}
                    </span>
                  )}
                </span>
                {/* The chevron mirrors with the script, like the drawer. */}
                <Icon
                  name={meta.dir === "rtl" ? "chevronBack" : "chevron"}
                  size={20}
                  style={{ color: C.textMuted }}
                />
              </button>
            </li>
          );
        })}
      </ul>

      {/* WHAT IS ACTUALLY RUNNING ON THIS PHONE.

          Not decoration and not a version number for its own sake:
          it exists so a report saying "fixed in 6a90de9" can be
          checked against the device in two seconds by looking,
          instead of argued about. It sits at the foot of More
          because that is the one screen reachable from anywhere
          that nobody is ever mid-task in.

          dir="ltr" and a fixed digit order: this is the one string
          in the app that must read identically in both languages,
          because its whole job is to be compared with another copy
          of itself. Muted and small — it is for the rare moment
          somebody goes looking, not a thing to notice daily. */}
      <p
        dir="ltr"
        data-sb-build={BUILD_STAMP}
        style={{
          margin: "14px 12px 4px",
          fontSize: ts(13),
          color: C.textMuted,
          textAlign: meta.dir === "rtl" ? "left" : "start",
          userSelect: "text",
          WebkitUserSelect: "text",
        }}
      >
        {BUILD_STAMP}
      </p>
    </Drawer>
  );
}
