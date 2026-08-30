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

export default function BottomBar({ role, buddyActive = true, drawerOpen, onOpenDrawer }) {
  const { t, ts } = useI18n();
  const items = barItems(role, { buddyActive });
  if (items.length < 2) return null; // §0.6: nothing to navigate, no bar

  /* Every item is shaped the same whether it navigates or opens a
     drawer — the pill, the icon, the label and the tap target must
     not depend on which. Sharing the style between a NavLink and a
     button is what stops More drifting into looking like a different
     kind of control from the four beside it. */
  const itemStyle = (isActive) => ({
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
    border: "none",
    textDecoration: "none",
    fontFamily: "inherit",
    cursor: "pointer",
    /* THE FILLED PILL. */
    background: isActive ? C.green : "transparent",
    color: isActive ? C.cream : C.textMain,
    fontWeight: isActive ? 800 : 600,
  });

  const Inside = ({ item }) => (
    <>
      <span aria-hidden="true" style={{ fontSize: 21, lineHeight: 1 }}>
        {item.emoji}
      </span>
      <span
        style={{
          /* THE BAR LABEL STOPS GROWING AT 1.2x, AND ONLY HERE.

             §8 says every screen is tested at every text size, and
             this is the screen that fails it. Five labels share 390px
             of fixed-height bar; at the largest setting 15px becomes
             22.5 and every one of them ellipses — in Urdu at largest
             the bar read "لھ…", "دوستوں کے گ…", "باہر کی…", "…مہ".
             That is icon-only navigation arrived at by accident,
             which §3 forbids outright, and it is a worse outcome for
             the person who chose the largest text than a slightly
             smaller label they can actually read.

             Capped rather than frozen: it still grows from 15 to 18px
             across the four settings, which is the range that fits.
             Everything the bar leads TO obeys the setting in full,
             and the icon plus the accessible name carry the meaning
             either way — this is the one place §3 already allowed to
             sit under the body floor for exactly this reason. */
          fontSize: "calc(15px * min(var(--sb-text-scale, 1), 1.2))",
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
  );

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
      {items.map((item) =>
        /* MORE IS A BUTTON, NOT A LINK (§6). It opens the drawer over
           where you already are. Going to a whole screen to choose a
           screen is exactly what §6 deletes — and a NavLink would also
           mark itself active and steal the pill from the tab you are
           actually on, which is a small lie about where you are.

           SIZED TO THE WORD, NOT TO AN EQUAL SHARE. Five equal shares
           of 390px is 74px each, and "Community" needed 85 — it was
           ellipsed to "Comm…" while Home used 43 of its 74. Content
           sizing fits all five with room over, and shrinks rather than
           clips if a language needs more than there is. */
        item.drawer ? (
          <button
            key={item.to}
            type="button"
            onClick={onOpenDrawer}
            aria-haspopup="dialog"
            aria-expanded={Boolean(drawerOpen)}
            /* NOT itemStyle(drawerOpen) — THE PILL STAYS WHERE YOU ARE.

               §3 gives the filled pill to the active item, singular.
               Lighting More while its drawer is open put two filled
               pills in the bar at once, Home and More, which says you
               are in two places. The drawer is an 80%-wide card over a
               dimmed screen — nobody needs a pill to know it is open,
               and aria-expanded above says so for anyone who cannot
               see it. The pill is for where you will be when the
               drawer closes, which is where you already are. */
            style={itemStyle(false)}
          >
            <Inside item={item} />
          </button>
        ) : (
          <NavLink key={item.to} to={item.to} end={item.end} style={({ isActive }) => itemStyle(isActive)}>
            <Inside item={item} />
          </NavLink>
        )
      )}
    </nav>
  );
}
