/* ════════════════════════════════════════════════
   The overlay. On with ?swipedebug=1, invisible otherwise.

   Its whole purpose is to be screenshotted: one swipe with this on
   produces the event trace from the real phone, which is the thing
   three rounds of synthetic verification could not produce.

   Deliberately ugly — monospace on black, no theming, no animation. It
   is an instrument, and it should never be mistaken for part of the
   app. It also ignores pointer events entirely, so it cannot itself
   interfere with the gesture it is measuring.
   ════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { swipeDebugOn, swipeLines, onSwipeLog, swipeFacts } from "./swipeDebug.js";

export default function SwipeDebug() {
  const [, bump] = useState(0);
  useEffect(() => onSwipeLog(() => bump((n) => n + 1)), []);

  if (!swipeDebugOn()) return null;

  const lines = swipeLines();
  return (
    <div
      /* Above everything, and untouchable: pointer-events none means a
         finger passes straight through to the app underneath. */
      style={{
        position: "fixed",
        insetInlineStart: 0,
        insetInlineEnd: 0,
        top: 0,
        zIndex: 2147483647,
        pointerEvents: "none",
        background: "rgba(0,0,0,0.86)",
        color: "#7FD99A",
        font: "11px/1.35 ui-monospace, Menlo, Consolas, monospace",
        padding: "6px 8px",
        maxHeight: "58vh",
        overflow: "hidden",
        whiteSpace: "pre",
        direction: "ltr",
        textAlign: "left",
      }}
    >
      <div style={{ color: "#FFE9A8" }}>
        {"swipe trace — " + (window.__SB_BUILD ? window.__SB_BUILD.stamp : "no stamp")}
      </div>
      <div style={{ color: "#8FA6BC" }}>{swipeFacts().join("  ")}</div>
      <div style={{ color: "#8FA6BC" }}>
        {"DOWN=touch  ENGAGE=drag started  VERTICAL=treated as scroll"}
      </div>
      <div style={{ color: "#8FA6BC" }}>
        {"CANCEL=browser took it  UP=released  going=did it commit"}
      </div>
      {lines.length === 0 ? (
        <div style={{ color: "#F2F3F5" }}>{"swipe once, then screenshot this"}</div>
      ) : (
        lines.map((l, i) => (
          <div key={i} style={{ color: /CANCEL|NOT-CANCELABLE/.test(l) ? "#FF9A9A" : /VERTICAL/.test(l) ? "#FFE9A8" : "#7FD99A" }}>
            {l}
          </div>
        ))
      )}
    </div>
  );
}
