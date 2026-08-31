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

import { useEffect, useRef, useState } from "react";
import { NavLink } from "react-router-dom";
import { APP_COLORS as C, A11Y } from "../../shared/tokens.js";
import { useI18n } from "../lib/i18n.jsx";
import { barItems } from "./navItems.js";
import { IconChip } from "./Icon.jsx";

/* NASTALIQ NEEDS THE ROOM AND ENGLISH DOES NOT MIND HAVING IT.

   The first build was 72px with a 1.15 line box, which is fine for
   "Community" and clips "برادری" — Nastaliq's descenders swing well
   below the baseline, and a script that hangs its letters off a
   diagonal cannot be measured by the height of a Latin x-height. The
   screenshot showed the tails sheared off and the labels crowding
   their icons, which is exactly the failure §0.1 exists to catch:
   asserting the key was present would have called this shipped. */
export const BAR_HEIGHT = 92;

export default function BottomBar({ role, buddyActive = true, shuttered = false }) {
  /* THE SHUTTER TRAVELS THE BAR'S REAL HEIGHT, NOT THE CONSTANT.

     BAR_HEIGHT is 92 and the bar is not 92 tall: it is 92 plus whatever
     the safe-area inset adds, plus whatever the label line becomes at
     the reader's text size. Measured at 390px it was 105 — so sliding
     it by 92 left THIRTEEN PIXELS OF JET along the bottom of the glass
     after it had supposedly gone, and on a phone with a home indicator
     it would leave the whole inset behind. That black strip is what the
     owner has been reporting.

     BAR_HEIGHT stays exported: it is what the shell RESERVES, which is a
     different question from what the bar OCCUPIES, and the reserve is
     released on shutter anyway. */
  const barRef = useRef(null);
  const [barH, setBarH] = useState(BAR_HEIGHT);
  useEffect(() => {
    const n = barRef.current;
    if (!n) return undefined;
    /* offsetHeight, and the observer watches the BORDER box.

       A ResizeObserver defaults to the content box, and everything
       that changes this height changes PADDING instead — the
       safe-area inset, the reader's text size. The content box never
       moves, so the observer never fired: measured against a
       simulated notch the bar grew to 139 and went on shuttering by
       the 105 it had at mount, leaving 34px of jet across the bottom
       of the glass. The same black strip, arrived at a second way.

       offsetHeight rather than a rect because a rect is affected by
       transforms, and this element is mid-transform exactly when the
       number matters. */
    const read = () => setBarH(n.offsetHeight || BAR_HEIGHT);
    read();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(read) : null;
    ro?.observe(n, { box: "border-box" });
    return () => ro?.disconnect();
  }, []);
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
    /* 5, not 9. The chip is wider than the bare icon it replaced,
       and at 9 the five items came to 374px which, with the 8px of
       gaps and the 8px of bar padding, is exactly 390 — so flex shrank
       every item by a pixel and ALL FIVE LABELS ELLIPSED. Measured
       scrollWidth against clientWidth: each needed 1-2px more than it
       had, which is enough to read "Gam…" and "Out & abo…".

       That is icon-only navigation arrived at by accident, which §3
       forbids outright, and it is the exact failure the note on the
       label below was written about. The chip made the bar tighter and
       I did not re-measure it after. */
    paddingInline: 5,
    minHeight: A11Y.minTapTargetPx,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingBlock: "8px 6px",
    border: "none",
    textDecoration: "none",
    fontFamily: "inherit",
    cursor: "pointer",
    /* THE PILL IS GONE; THE CHIP CARRIES THE STATE NOW.

       A filled pill behind icon AND label made the active tab a block
       of solid colour about a third of the bar wide, which on dark
       chrome would read as a hole. The chip is a smaller, rounder
       target for the eye: it fills with the accent, the icon goes
       white, and the label brightens under it. */
    background: "transparent",
    color: isActive ? C.navActive : C.navInk,
    fontWeight: isActive ? 800 : 600,
  });

  const Inside = ({ item, active = false }) => (
    <>
      {/* A drawn glyph in a chip, not an emoji. aria-hidden by
          default — the label below says it, and a reader announcing
          both says it twice.

          `tone` comes from the item: Messages is blue wherever it
          appears, so the thing people hunt for looks the same in the
          bar as it does anywhere else. When the tab is ACTIVE the
          accent wins over the tone — where-you-are outranks
          what-this-is. */}
      <IconChip
        name={item.icon}
        size={22}
        tone={item.tone || "ink"}
        active={active}
        onDark
      />
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

             I capped it at 1.2x first and that was still wrong: 18px
             ellipsed "Out & about" and took the other four with it.
             Five labels in a 390px strip fit at 15px and at no size
             above it, so the bar label does not scale at all. Measured
             with scrollWidth against clientWidth rather than eyeballed,
             because overflow:hidden means a clipped label never
             reports as overflowing the viewport and every edge
             assertion stayed green through all of it.
             Everything the bar leads TO obeys the setting in full,
             and the icon plus the accessible name carry the meaning
             either way — this is the one place §3 already allowed to
             sit under the body floor for exactly this reason. */
          fontSize: 15,
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
      ref={barRef}
      data-sb-bar=""
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
        /* THE BAR OWNS THE BOTTOM INSET, and through the named property
           so it can be inspected and overridden in a check. Inside the
           element, so it travels with the shutter. */
        padding: "6px 4px calc(6px + var(--sb-safe-bottom, 0px))",
        /* The bar was C.white — the same surface as the posts it sits
           under, so on a feed that reaches both edges the bar and the
           bottom card were one continuous white. Its own tone and a
           hairline; the shadow goes, because a shadow was doing the
           separating that a tone should do, and it was warm-tinted
           from the cream era besides. */
        background: C.nav,
        borderTop: `1px solid ${C.navEdge}`,
        /* MOTION §5 — the shutter. It travels its own height rather
           than fading, so the screen underneath genuinely gains the
           space instead of hiding text behind a transparent bar. */
        transform: shuttered ? `translateY(${barH}px)` : "none",
        transition: "transform 180ms ease-out",
      }}
    >
      {/* SIZED TO THE WORD, NOT TO AN EQUAL SHARE. Five equal shares
          of 390px is 74px each, and "Community" needed 85 — it was
          ellipsed to "Comm…" while Home used 43 of its 74. Content
          sizing fits all five with room over, and shrinks rather than
          clips if a language needs more than there is.

          NO MORE BUTTON AMONG THE TABS. More has moved to the
          header's top-right, so every item here is a DESTINATION and
          the branch that drew a menu button among four links is gone
          with it. The bar no longer has to explain why one of its
          five children behaves unlike the other four. */}
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={(ev) => {
            /* THE TAB YOU ARE ALREADY ON SCROLLS TO THE TOP.

               Every phone app this audience already uses does this,
               and without it the Home tab is the one control on the
               screen that does nothing when pressed — which reads as
               broken rather than as already-here. It is also the way
               back to the composer, since MOTION §5 keeps that at the
               top of the feed rather than floating over it.

               preventDefault so the router does not also re-navigate
               and remount the screen underneath the scroll. */
            if (window.location.pathname === item.to) {
              ev.preventDefault();
              const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
              window.scrollTo({ top: 0, behavior: still ? "auto" : "smooth" });
            }
          }}
          style={({ isActive }) => itemStyle(isActive)}
        >
          {/* Children as a FUNCTION, not an element: the chip has to
              know whether this is the tab you are on, and `isActive`
              exists only inside NavLink's render prop. Passing the
              item alone gave every chip the resting treatment, so the
              active tab looked like the other four. */}
          {({ isActive }) => <Inside item={item} active={isActive} />}
        </NavLink>
      ))}
    </nav>
  );
}
