/* ════════════════════════════════════════════════
   The quiet line about the connection, on Home.

   Home paints from what this phone last saw (lib/offline.js) and the
   network replaces it when it answers. This line says which of those
   the person is looking at — once, calmly, in words:

     lastKnown  no network, or the requests are failing: this is how
                things were, and anything logged is kept and sent later
     slow       connected, but the fresh answer has not come after a
                few seconds: this is what we had, the rest is on its way
     back       it was saying one of the above and everything has now
                arrived — shown briefly, then gone

   NOT AN ERROR. No red, no warning glyph, no toast: nothing is wrong
   with the person's day, only with the phone's signal. The words carry
   the meaning, so colour is never the only signal.

   IT NEVER MOVES THE PAGE. The line is fixed above the bottom bar
   rather than inserted into the flow, so appearing and disappearing
   shifts nothing under a thumb. A spacer of the same height sits at the
   very end of the page while it shows, so the last thing on Home can
   always be scrolled clear of it — and a change at the end of a
   document moves nothing above it.
   ════════════════════════════════════════════════ */

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { APP_COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { useOnline } from "../../lib/offline.js";

const SLOW_AFTER_MS = 3500;
const BACK_FOR_MS = 4000;

/* fresh  — every network read this screen draws from has answered
   failed — one of them has failed outright (connected, but nothing
            answers: "lie-fi") */
export function useConnectionState({ fresh, failed }) {
  const online = useOnline();

  const [slowElapsed, setSlowElapsed] = useState(false);
  useEffect(() => {
    if (!online || fresh) {
      setSlowElapsed(false);
      return undefined;
    }
    const id = window.setTimeout(() => setSlowElapsed(true), SLOW_AFTER_MS);
    return () => window.clearTimeout(id);
  }, [online, fresh]);

  /* Once a line has been shown it stays until the fresh data is really
     here: coming back online is not the same as being up to date, and a
     line that vanished on the "online" event and came back three seconds
     later as "slow" would be exactly the flicker this avoids. */
  const [hadLine, setHadLine] = useState(false);
  let base = null;
  if (!online) base = "lastKnown";
  else if (!fresh) base = failed ? "lastKnown" : slowElapsed || hadLine ? "slow" : null;

  const [back, setBack] = useState(false);
  useEffect(() => {
    if (base) {
      if (!hadLine) setHadLine(true);
      return;
    }
    if (hadLine && fresh) {
      setHadLine(false);
      setBack(true);
    }
  }, [base, fresh, hadLine]);

  useEffect(() => {
    if (!back) return undefined;
    if (base) {
      setBack(false);
      return undefined;
    }
    const id = window.setTimeout(() => setBack(false), BACK_FOR_MS);
    return () => window.clearTimeout(id);
  }, [back, base]);

  return base || (back ? "back" : null);
}

export default function ConnectionLine({ fresh, failed }) {
  const { t, ts } = useI18n();
  const state = useConnectionState({ fresh, failed });

  const boxRef = useRef(null);
  const [height, setHeight] = useState(0);
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!state || !el) {
      setHeight(0);
      return undefined;
    }
    const measure = () => setHeight(el.offsetHeight || 0);
    measure();
    if (typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [state]);

  return (
    <>
      {/* Always mounted, so a screen reader hears the words arrive. */}
      <div
        role="status"
        aria-live="polite"
        style={{
          position: "fixed",
          insetInlineStart: 0,
          insetInlineEnd: 0,
          bottom: "calc(var(--sb-bar-h, 72px) + 10px)",
          zIndex: 60,
          display: "flex",
          justifyContent: "center",
          padding: "0 12px",
          pointerEvents: "none",
        }}
      >
        {state && (
          <p
            ref={boxRef}
            data-home-connection={state}
            style={{
              pointerEvents: "auto",
              margin: 0,
              width: "100%",
              maxWidth: 568,
              boxSizing: "border-box",
              minHeight: A11Y.minTapTargetPx,
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "10px 16px",
              background: C.white,
              color: C.textMain,
              border: `1.5px solid ${C.warmGray}`,
              borderRadius: 16,
              boxShadow: "0 4px 18px rgba(0,0,0,0.12)",
              fontSize: ts(A11Y.minBodyPx),
              lineHeight: 1.45,
              textAlign: "start",
            }}
          >
            <span aria-hidden="true" style={{ fontSize: ts(20), color: C.textMuted, flexShrink: 0 }}>
              {state === "back" ? "✓" : "☁︎"}
            </span>
            <span>{t(`home.offline.${state}`)}</span>
          </p>
        )}
      </div>
      <div aria-hidden="true" style={{ height: state ? height + 16 : 0 }} />
    </>
  );
}
