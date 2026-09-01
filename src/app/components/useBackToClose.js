/* ════════════════════════════════════════════════
   Anything that opens must close when you press back.

   The owner: "Join with a code opens and there is no way to get back
   out of it", and then the general form — "many other things in the app
   just remain open and don't return to their original configuration."

   He is describing one defect. Audited across the app: 23 overlay
   surfaces, and 22 of them held their open state in a plain useState.
   A sheet in local state has no history entry, so the Android back
   gesture does not close it — it navigates away from the screen
   UNDERNEATH, which is both halves of what he reports at once. You
   cannot get out of the thing, and when you finally do you are not
   where you were.

   Only components/Drawer.jsx answered back correctly, because it is the
   one surface that pushes a history entry.

   ─── WHY A HOOK RATHER THAN MOVING EVERYTHING TO Drawer ───

   Twenty-two surfaces across five lanes, each with its own open state,
   its own animation and its own owner. A hook that takes the state a
   component already has is one line per file and no refactor; asking
   every lane to restructure its sheets is a change none of them would
   finish today, and the ones left undone would be exactly the ones
   people get stuck in.

       useBackToClose(open, onClose);

   ─── WHAT IT DOES ───

   On open it pushes a history entry that carries a marker. Back pops
   that entry, which fires popstate, and the sheet closes instead of the
   page moving. If the sheet is closed any other way — its button, the
   scrim, Escape — the entry is removed so the person does not have to
   press back twice to leave a screen they have already returned to.

   Escape is included because a keyboard is a real input here: some
   Icons use the app on a tablet with one attached, and a surface that
   traps a keyboard user is worse than one that traps a thumb.
   ════════════════════════════════════════════════ */

import { useEffect, useRef } from "react";

export default function useBackToClose(open, onClose) {
  /* The callback is read through a ref so a component that re-creates
     its handler every render — most of them — does not tear the history
     entry down and build it again on every keystroke. */
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  /* Did WE push the entry? Only then may we remove it. Popping an entry
     somebody else owns would send the person back a screen. */
  const pushed = useRef(false);

  /* HOW DEEP THIS ONE SITS, and it is the difference between a hook that
     nests and one that does not.

     popstate is a WINDOW event: one back press runs every mounted
     handler, not just the innermost. Lane 3 found this — a sheet with a
     confirmation step inside it would close BOTH levels on one press and
     leave an orphaned entry on the stack for the next press to spend, so
     the press after that would appear to do nothing.

     Each instance now records the depth it pushed at, and acts only when
     history has come back PAST it. Two sheets open at depths 1 and 2:
     one back leaves history at 1, so the depth-2 sheet closes and the
     depth-1 sheet does not. The next back leaves 0 and closes the
     other. */
  const depth = useRef(0);

  useEffect(() => {
    if (!open) return undefined;

    const mine = (window.history.state?.sbSheet || 0) + 1;
    depth.current = mine;
    window.history.pushState({ ...window.history.state, sbSheet: mine }, "");
    pushed.current = true;

    const onPop = () => {
      /* Only if history has come back past MY entry. A deeper sheet
         closing leaves the stack at or above my depth, and that press
         was not for me. */
      const now = window.history.state?.sbSheet || 0;
      if (now >= depth.current) return;
      /* My entry is already gone by the time this fires — the browser
         popped it — so I must not pop again on the way out. */
      pushed.current = false;
      closeRef.current?.();
    };
    const onKey = (e) => {
      /* Escape belongs to the topmost sheet only, for the same reason. */
      if (e.key !== "Escape") return;
      if ((window.history.state?.sbSheet || 0) !== depth.current) return;
      closeRef.current?.();
    };

    window.addEventListener("popstate", onPop);
    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("keydown", onKey);
      /* Closed by a button, the scrim, or by unmounting: take our entry
         back out, or the next back press would be spent on a sheet that
         is no longer there. */
      if (pushed.current) {
        pushed.current = false;
        window.history.back();
      }
    };
  }, [open]);
}
