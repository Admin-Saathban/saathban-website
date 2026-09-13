/* ════════════════════════════════════════════════
   The app at width — tablet, laptop and desk.

   The app was built for a phone held in one hand, and that stays the
   primary case: EVERY RULE BELOW 768px WIDE IS EXACTLY WHAT IT WAS.
   Nothing in this file changes a phone. The layout rules live inside
   min-width media queries that cannot match under 768px; the only rules
   outside them are keyboard focus rings and a skip link that is parked
   off the screen, and neither paints anything for a finger.

   Breakpoints are widths, never devices. A phone turned sideways past
   768px gets the tablet form, and that is correct: it has the room.

   ── THE THREE FORMS ──

   phone    < 768    unchanged.
   tablet   768+     the bar becomes a DOCK: the same five tabs in a
                     centred bar of fixed maximum width, attached to the
                     bottom edge with its top corners rounded. A tablet
                     is still held, so the tabs stay where a thumb is.
                     Drawers line up under the buttons that opened them
                     and stop at their own height; toasts sit above the
                     dock instead of behind it.
   laptop   1024+    a modest step up in type (x1.10) and a column that
                     widens with it, so line length stays the same while
                     the words get bigger; sheets rise as centred
                     dialogs instead of from the bottom edge of a monitor;
                     and the bars stop hiding on scroll (see useShutter),
                     because there is no screen to win back and a bar
                     that slides away under a mouse wheel is only chrome
                     that moves.
   desk     1400+    the same, one step further (x1.15).

   WHY A DOCK AND NOT A SIDE RAIL. A labelled rail down the side is the
   usual desktop answer, and it would have meant moving every screen's
   content out of a rail's way: the Messages world, the thread composer,
   the sheets and several fixed layers all position against the full
   window, and each would have needed its own correction — none of which
   can be checked on a phone, where they would have to stay exactly as
   they are. The dock keeps the one contract every screen already honours
   (the shell reserves --sb-bar-h at the bottom), so nothing underneath
   it has to learn anything. The labels are still words, and a mouse
   reaches the bottom of a window as easily as the side.

   One file, so the numbers that must agree — the dock width, the header
   frame, the steps — are written once.
   ════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { APP_COLORS as C } from "../../shared/tokens.js";
import { useI18n } from "../lib/i18n.jsx";
import { revealBars } from "./useShutter.js";

export const WIDTH = { tablet: 768, laptop: 1024, desk: 1400 };

/* How much bigger the words get at each width. Multiplies the reader's
   own text size setting — it never replaces it, and it never goes below
   what they chose. */
export const TYPE_STEP = { laptop: 1.1, desk: 1.15 };

/* The dock's widest. Five tabs at 128px each at tablet widths. */
const DOCK_MAX = { tablet: 640, laptop: 720 };

/* AppHeader's inner row is capped at this width and centred. The drawers
   line their edge up with it, so a panel opens under the button that
   opened it rather than at the far edge of a wide window. */
const HEADER_FRAME = 960;

/* The Messages world's list column (MessagesWorld's inner maxWidth). Its
   own header and tab row line up with it, stepping with the type. */
const COLUMN_BASE = 640;

export function wideCss(scale = 1) {
  const s = Number(scale) || 1;
  return `
/* ── KEYBOARD, AT EVERY WIDTH ──
   Focus rings match only keyboard focus (:focus-visible), so a tap never
   draws one. On the dark chrome the ring is the accent that already marks
   the tab you are on; inside a drawer it is the app accent. */
nav[data-sb-bar] a:focus-visible {
  outline: 3px solid ${C.navActive};
  outline-offset: -3px;
  border-radius: 14px;
}
[data-sb-drawer] a:focus-visible,
[data-sb-drawer] button:focus-visible {
  outline: 3px solid ${C.green};
  outline-offset: -3px;
}

/* Parked above the top of the screen until it has keyboard focus. */
.sb-skip {
  position: fixed;
  z-index: 200;
  top: 8px;
  inset-inline-start: 8px;
  display: inline-flex;
  align-items: center;
  min-height: 48px;
  padding: 0 20px;
  border-radius: 50px;
  background: ${C.nav};
  color: ${C.navInk};
  border: 3px solid ${C.navActive};
  font-size: 18px;
  font-weight: 700;
  text-decoration: none;
  transform: translateY(-200%);
}
.sb-skip:focus { transform: none; outline: none; }

@keyframes sb-desk-sheet {
  from { opacity: 0; transform: translateY(18px) scale(0.985); }
  to   { opacity: 1; transform: none; }
}

/* ── TABLET AND UP ── */
@media (min-width: ${WIDTH.tablet}px) {
  /* THE DOCK. The bar is fixed with both inline insets at 0; a maximum
     width plus automatic inline margins centres it without a transform,
     so the shutter's translateY still owns the transform property. */
  nav[data-sb-bar] {
    /* border-box, so the dock is the width written here: measured
       content-box it came out 26px wider (its padding and border). */
    box-sizing: border-box;
    max-width: ${DOCK_MAX.tablet}px;
    margin-inline: auto;
    padding-inline: 12px !important;
    border: 1px solid ${C.navEdge} !important;
    border-bottom: 0 !important;
    border-start-start-radius: 22px;
    border-start-end-radius: 22px;
    box-shadow: 0 -4px 24px rgba(15, 17, 19, 0.14);
  }

  /* Drawers: under their own button, and only as tall as their rows. */
  [data-sb-drawer] {
    inset-inline-end: max(10px, calc((100% - ${HEADER_FRAME}px) / 2)) !important;
    bottom: auto !important;
    max-height: calc(100vh - var(--sb-hdr-h, 58px) - var(--sb-bar-h, 0px) - 28px);
  }
  [data-sb-drawer="top"] {
    top: calc(var(--sb-hdr-h, 58px) + 6px) !important;
  }

  /* Toasts above the dock, not painted behind it. */
  [data-sb-toasts],
  [data-sb-lift] {
    bottom: calc(var(--sb-bar-h, 0px) + 16px) !important;
  }

  /* THE MESSAGES WORLD'S OWN TWO ROWS — its header and its Chats /
     Requests / Menu tabs. Both ran the full window, so at 1400px the three
     tabs sat 470px apart over a 640px list. Padded in to the list's
     column instead; the chrome's ground and rule still reach both edges. */
  [data-sb-world-row] {
    padding-inline: max(10px, calc((100% - ${COLUMN_BASE}px) / 2)) !important;
  }
}

@media (hover: hover) and (min-width: ${WIDTH.tablet}px) {
  nav[data-sb-bar] a:hover {
    background-color: rgba(255, 255, 255, 0.07) !important;
    border-radius: 14px;
  }
}

/* ── LAPTOP AND UP ── */
@media (min-width: ${WIDTH.laptop}px) {
  nav[data-sb-bar] { max-width: ${DOCK_MAX.laptop}px; }
  nav[data-sb-bar] .sb-bar-label { font-size: 16px !important; }

  /* The type step. An !important custom property outranks the inline one
     the language provider writes, and every ts() size reads it. */
  .sb-appshell { --sb-text-scale: ${+(s * TYPE_STEP.laptop).toFixed(4)} !important; }
  /* The column widens by the same step, so a line holds as many words
     at desk width as it does on a tablet. --sb-col is each screen's own
     phone-and-tablet width. */
  .sb-col { max-width: calc(var(--sb-col, 640px) * ${TYPE_STEP.laptop}) !important; }
  [data-sb-world-row] {
    padding-inline: max(10px, calc((100% - ${COLUMN_BASE * TYPE_STEP.laptop}px) / 2)) !important;
  }

  /* SHEETS BECOME DIALOGS. A sheet rising from the bottom edge is where
     a thumb is on a phone; on a monitor it is the far corner of the
     screen from where the eye is. Same sheet, same content, centred.
     "safe" so a sheet taller than the window starts at the top instead of
     losing its first lines above it; the dim scrolls in that case. */
  .sb-dim:has(> .sb-sheet) {
    align-items: safe center !important;
    padding: 24px !important;
    box-sizing: border-box;
    overflow-y: auto;
  }
  .sb-dim > .sb-sheet {
    border-radius: 24px !important;
    box-shadow: 0 18px 60px rgba(15, 17, 19, 0.28);
  }
}

@media (min-width: ${WIDTH.laptop}px) and (prefers-reduced-motion: no-preference) {
  .sb-dim > .sb-sheet { animation-name: sb-desk-sheet !important; }
}

/* ── DESK ── */
@media (min-width: ${WIDTH.desk}px) {
  .sb-appshell { --sb-text-scale: ${+(s * TYPE_STEP.desk).toFixed(4)} !important; }
  .sb-col { max-width: calc(var(--sb-col, 640px) * ${TYPE_STEP.desk}) !important; }
  [data-sb-world-row] {
    padding-inline: max(10px, calc((100% - ${COLUMN_BASE * TYPE_STEP.desk}px) / 2)) !important;
  }
}
`;
}

/* Mounted once by AppShellBar, so it is present wherever the bar is and
   absent where the app furniture is (signed out, admin, a game world). */
export default function WideStyles() {
  const { scale } = useI18n();
  return <style>{wideCss(scale)}</style>;
}

/* ── THE KEYBOARD WAY TO THE TABS ──

   The bar is the last thing in the document, so without this a keyboard
   reaches it only after tabbing through every control on the screen. The
   first Tab press on any page lands here instead: "Go to the tabs", and
   Enter puts focus on the tab you are on. From there the arrow keys move
   between tabs (BottomBar).

   Rendered into a node at the very start of <body>, ahead of the app, so
   it is first in the tab order whatever the screen draws — including the
   Messages world, which hides the app header. It carries its own dir and
   language because <body> has neither. */
export function SkipToTabs() {
  const { t, meta, lang } = useI18n();
  const [host, setHost] = useState(null);

  useEffect(() => {
    const el = document.createElement("div");
    el.setAttribute("data-sb-skip-host", "");
    document.body.insertBefore(el, document.body.firstChild);
    setHost(el);
    return () => el.remove();
  }, []);

  if (!host) return null;

  const go = (e) => {
    e.preventDefault();
    revealBars();
    const bar = document.querySelector("nav[data-sb-bar]");
    const here = bar?.querySelector('a[aria-current="page"]') || bar?.querySelector("a[href]");
    here?.focus();
  };

  return createPortal(
    <a
      href="#sb-tabs"
      className="sb-skip"
      dir={meta.dir}
      lang={lang}
      onClick={go}
      style={{ fontFamily: meta.fonts.body }}
    >
      {t("layout.skipToTabs")}
    </a>,
    host
  );
}
