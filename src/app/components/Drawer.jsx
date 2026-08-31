/* ════════════════════════════════════════════════
   The drawer — MOTION_SPEC §4, and there are only two of them.

   More and Notifications. Nothing else may be one; a lane that needs a
   third container asks rather than adds.

   ── OPEN STATE LIVES IN HISTORY, NOT IN A useState ──

   §4 asks for something that a boolean cannot give: "tapping any row
   inside opens that destination full screen, and BACK FROM THERE
   RETURNS TO THE DRAWER, STILL OPEN." A boolean in the bar is
   destroyed by that navigation and comes back false, so back would
   land on a closed drawer and the person would have to find More
   again.

   So opening pushes a history entry on the same path carrying
   `sbDrawer: <id>`, and the drawer is open exactly when the current
   entry says so. Tapping a row pushes the destination on top. Back
   from the destination pops to the entry that still says sbDrawer, and
   the drawer is open — for free, because the browser remembered rather
   than because we reconstructed it. Back again pops the drawer entry
   and it closes. That is MOTION_SPEC §1's corollary, "back always
   reverses the arrival", implemented rather than imitated.

   ── THE FIRST OUTSIDE TAP IS CONSUMED ──

   §4 is explicit and it matters more here than in most apps: the first
   tap anywhere outside closes the drawer AND DOES NOTHING ELSE. A
   second tap is needed to act on whatever is underneath. The dim layer
   covers everything including the bottom bar, so a thumb landing on
   Games while reaching for More cannot take you to Games. The bar
   stays visible through the dim — you can see where you are — and is
   simply not reachable until the drawer is gone.

   ── IT DOES NOT TOUCH THE EDGES ──

   A gap top and bottom so it reads as a card in front of the screen
   rather than a wall attached to it, rounded on its inner side, soft
   shadow, ~80% width, 42% dim behind. The bottom gap clears the bar,
   because a drawer that ends underneath the navigation looks like it
   was cut off by it.
   ════════════════════════════════════════════════ */

import { useCallback, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { APP_COLORS as C } from "../../shared/tokens.js";
import { useI18n } from "../lib/i18n.jsx";
import { DIM, TIMING, wantsLessMotion } from "./motion.jsx";
import { BAR_HEIGHT } from "./BottomBar.jsx";

/* Is a drawer with this id the current history entry? */
export function useDrawer(id) {
  const navigate = useNavigate();
  const location = useLocation();
  const open = location.state?.sbDrawer === id;

  const openDrawer = useCallback(() => {
    if (open) return;
    navigate(location.pathname + location.search, {
      state: { ...location.state, sbDrawer: id },
    });
  }, [navigate, location.pathname, location.search, location.state, id, open]);

  /* Closing is a POP, never a push of the same path without the state.
     A push would leave the drawer entry in history, so the hardware
     back button would reopen a drawer the person had just dismissed. */
  const closeDrawer = useCallback(() => {
    if (open) navigate(-1);
  }, [navigate, open]);

  return { open, openDrawer, closeDrawer };
}

export default function Drawer({ id, open, onClose, from = "bottom", labelledBy, children }) {
  const { meta } = useI18n();
  const panelRef = useRef(null);

  /* Escape closes it, like every other dismissible thing. Cheap, and
     it is the only way out for somebody on a keyboard. */
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  /* Focus moves into the panel so a screen reader is inside the thing
     that just opened rather than still on the button behind it. */
  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  if (!open) return null;

  /* Which corner it grows from: the corner of the button that opened
     it, mirrored for RTL because the bar and the header mirror too. */
  const rtl = meta.dir === "rtl";
  const growClass = wantsLessMotion()
    ? ""
    : from === "top"
    ? rtl
      ? "sb-drawer-tl"
      : "sb-drawer-tr"
    : rtl
    ? "sb-drawer-bl"
    : "sb-drawer-br";

  return (
    <>
      {/* The dim. Above the bar (z 60) on purpose — visible through,
          not tappable. Its click is the "first tap is consumed" rule. */}
      <div
        onClick={onClose}
        aria-hidden="true"
        className={wantsLessMotion() ? "" : "sb-drawer-dim"}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 70,
          background: `rgba(43,33,20,${DIM})`,
        }}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className={growClass}
        style={{
          position: "fixed",
          zIndex: 71,
          insetInlineEnd: 10,
          /* Gaps top and bottom (§4). Only the TOP depends on which
             button opened it — the bell sits below the header, the
             More tab does not.

             THE BOTTOM ALWAYS CLEARS THE BAR. §4 says the bottom bar
             stays visible behind the dim, and the notifications
             drawer was ending 28px from the viewport floor — which is
             on top of a 92px bar, so it covered two thirds of it and
             ran its own last row underneath the navigation. Whichever
             corner a drawer grows from, it is a card in front of the
             screen, and the bar is part of the screen. */
          top: from === "top" ? 64 : 28,
          bottom: BAR_HEIGHT + 14,
          width: "80%",
          maxWidth: 380,
          display: "flex",
          flexDirection: "column",
          overflowY: "auto",
          background: C.bg,
          /* Rounded on the inner side — the edge it grew from stays
             squarer, which is what makes it read as coming from there. */
          borderStartStartRadius: 22,
          borderEndStartRadius: 22,
          borderStartEndRadius: 10,
          borderEndEndRadius: 10,
          boxShadow: "0 10px 40px rgba(43,33,20,0.30)",
          outline: "none",
          padding: "10px 8px",
          transitionDuration: `${TIMING.drawerClose}ms`,
        }}
      >
        {children}
      </div>
    </>
  );
}
