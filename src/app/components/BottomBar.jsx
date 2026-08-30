/* ════════════════════════════════════════════════
   The bottom bar — PRODUCT_DECISIONS §3.

   Replaces the card grid that sat on every role's home. A grid of
   cards is a place you go BACK to in order to go somewhere else; a bar
   is a thing you are always standing on. It is at the bottom because
   that is where a thumb is on a phone held one-handed, which for our
   users is how a phone is held.

   LABELS UNDER EVERY ICON, NEVER ICON-ALONE. An emoji is a rebus, and
   a person who has to solve it every time is being asked to do work
   the label would have done for them. The icons here are decoration
   with an accessible name on the row; the words are the navigation.

   THE ACTIVE ITEM IS A FILLED PILL — not an underline, not a colour
   change on the text. §3 is specific about this and it is right: a
   colour change is invisible to anyone who does not know what the
   other colour meant, and a 2px underline is invisible to most eyes
   at arm's length. A filled shape is a different KIND of thing, which
   is the only difference that reads without being taught.

   Not rendered for admins, on the auth screens, or over a game — see
   AppShellBar below for exactly where it appears and why.
   ════════════════════════════════════════════════ */

import { NavLink } from "react-router-dom";
import { COLORS as C, A11Y } from "../../shared/tokens.js";
import { useI18n } from "../lib/i18n.jsx";
import { barItems } from "./navItems.js";

/* NASTALIQ NEEDS THE ROOM AND ENGLISH DOES NOT MIND HAVING IT.

   The first build was 72px with a 1.15 line box, which is fine for
   "Community" and clips "برادری" — Nastaliq's descenders swing well
   below the baseline, and a script that hangs its letters off a
   diagonal cannot be measured by the height of a Latin x-height. The
   screenshot showed the tails sheared off and the labels crowding
   their icons, which is exactly the failure §0.1 exists to catch:
   asserting the key was present would have called this shipped. */
export const BAR_HEIGHT = 92;

export default function BottomBar({ role, buddyActive = true }) {
  const { t, ts } = useI18n();
  const items = barItems(role, { buddyActive });
  if (items.length < 2) return null; // §0.6: nothing to navigate, no bar

  return (
    <nav
      aria-label={t("hub.navLabel")}
      style={{
        position: "fixed",
        insetInlineStart: 0,
        insetInlineEnd: 0,
        bottom: 0,
        zIndex: 60,
        display: "flex",
        alignItems: "stretch",
        justifyContent: "space-evenly",
        gap: 2,
        padding: "6px 4px calc(6px + env(safe-area-inset-bottom, 0px))",
        background: C.white,
        borderTop: `1px solid ${C.warmGray}`,
        boxShadow: "0 -2px 12px rgba(74,58,34,0.08)",
      }}
    >
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          style={({ isActive }) => ({
            /* SIZED TO THE WORD, NOT TO AN EQUAL SHARE.

               Five equal shares of 390px is 74px each, and "Community"
               needs 85 — so it was ellipsed to "Comm…" while Home sat
               in 74px using 43 and More used 37. Four labels had
               between 20 and 37px of slack each and the fifth was
               being cut, because the layout had decided in advance
               that all words are the same length.

               Content-sized items with the spare distributed between
               them fit all five with room over: 265px of words in a
               390px bar. It shrinks rather than clips if a future
               language needs more than there is. */
            flex: "0 1 auto",
            minWidth: 0,
            paddingInline: 9,
            minHeight: A11Y.minTapTargetPx,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 3,
            paddingBlock: "8px 6px",
            borderRadius: 16,
            textDecoration: "none",
            /* THE FILLED PILL. */
            background: isActive ? C.green : "transparent",
            color: isActive ? C.cream : C.textMain,
            fontWeight: isActive ? 800 : 600,
          })}
        >
          {({ isActive }) => (
            <>
              <span aria-hidden="true" style={{ fontSize: 21, lineHeight: 1 }}>
                {item.emoji}
              </span>
              {/* 18px is the floor everywhere else in the app, and a
                  five-item bar at 390px gives each label 74px. The
                  label is allowed to be 16px HERE and only here,
                  because it sits under an icon that repeats it and is
                  never the only thing carrying the meaning — and
                  because shrinking it is what keeps the words rather
                  than replacing them with icons alone, which §3
                  forbids outright. */}
              <span
                style={{
                  fontSize: ts(15),
                  /* MEASURED, NOT EYEBALLED. At 15px the Urdu
                     labels need a 30px line box and 1.5 gave them
                     22.5, so overflow:hidden was shearing 7px off
                     every one of them — the tails of گھر and کھیل
                     specifically. 2.1 clears the descender with a
                     little to spare; the Latin labels are unaffected,
                     since they never came near the ceiling. */
                  lineHeight: 2.45,
                  maxWidth: "100%",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  fontWeight: "inherit",
                  color: "inherit",
                }}
              >
                {t(item.key)}
              </span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
