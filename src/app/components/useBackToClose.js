/* ════════════════════════════════════════════════
   Anything that opens must close when you press back.

   The owner: "Join with a code opens and there is no way to get back
   out of it", and then the general form — "many other things in the app
   just remain open and don't return to their original configuration."

   A sheet held in a plain useState has no history entry, so the Android
   back gesture does not close it — it navigates away from the screen
   UNDERNEATH, which is both halves of what he reports at once. You
   cannot get out of the thing, and when you finally do you are not
   where you were.

   ─── ONE ENTRY FOR THE WHOLE STACK ───

   The first version of this pushed an entry per open surface and popped
   it on close, and that was wrong three separate times, each found by a
   different lane:

     · two sheets open at once — popstate is a WINDOW event, so one
       press ran every mounted handler and closed both (Lane 3)
     · a parent registering for a child that registers for itself —
       two entries for one panel, so it took two presses to leave (Lane 1)
     · ONE SHEET CLOSING AS ANOTHER OPENS — and this is the one that
       shipped a regression. history.back() is asynchronous. Choosing
       Edit from a post's menu closes the menu and opens the editor in
       the same tick, so the menu's queued pop landed AFTER the editor
       had pushed, and took the editor's entry with it. The editor
       opened and vanished.

   Every one of those is history churn: entries appearing and
   disappearing in an order no single component can see. So there is now
   exactly ONE entry no matter how many surfaces are open, and a module
   stack decides who it belongs to.

     open   → join the stack; the entry is created if it is the first
     back   → the innermost surface closes, and the entry is re-created
              if anything is still open behind it
     close  → leave the stack; the entry is released only if the stack
              is empty AFTER a microtask

   That last deferral is what fixes the editor. A surface that opens
   another as it closes hands the entry over rather than destroying one
   the replacement has already claimed — the stack is briefly empty and
   is full again before the microtask runs, so nothing touches history
   at all.

       useBackToClose(open, onClose);

   Escape is included because a keyboard is a real input here: some
   Icons use the app on a tablet with one attached, and a surface that
   traps a keyboard user is worse than one that traps a thumb. It goes
   to the innermost surface only, for the same reason back does.
   ════════════════════════════════════════════════ */

import { useEffect, useRef } from "react";

const KEY = "sbSheet";

/* Innermost last. Entries are plain objects so a surface can be found
   and removed by identity even after re-renders. */
const stack = [];
let marker = false;      /* is our single entry on the history stack? */
let unwinding = false;   /* a pop WE asked for is in flight */
let listening = false;

function ours() {
  return !!(typeof window !== "undefined" && window.history.state && window.history.state[KEY]);
}

function ensureMarker() {
  if (marker) return;
  window.history.pushState({ ...window.history.state, [KEY]: 1 }, "");
  marker = true;
}

function releaseMarker() {
  /* DEFERRED ON PURPOSE — see the note above. If a replacement surface
     opens in this same tick it inherits the entry and we never fire. */
  queueMicrotask(() => {
    if (stack.length || !marker) return;
    /* If a real navigation happened while the sheet was up, the entry
       on top is the router's and popping it would send the person back
       a screen they meant to be on. */
    if (!ours()) { marker = false; return; }
    marker = false;
    unwinding = true;
    window.history.back();
  });
}

function onPop() {
  if (unwinding) { unwinding = false; return; }
  if (!stack.length) { marker = false; return; }
  marker = false;
  const top = stack.pop();
  top.gone = true;
  /* Anything still open behind it needs an entry of its own again, or
     the next press would leave the screen with a sheet still up. */
  if (stack.length) ensureMarker();
  top.close();
}

function onKey(e) {
  if (e.key !== "Escape" || !stack.length) return;
  const top = stack[stack.length - 1];
  top.gone = true;
  stack.pop();
  if (!stack.length) releaseMarker();
  top.close();
}

function listen() {
  if (listening || typeof window === "undefined") return;
  listening = true;
  window.addEventListener("popstate", onPop);
  window.addEventListener("keydown", onKey);
}

export default function useBackToClose(open, onClose) {
  /* The callback is read through a ref so a component that re-creates
     its handler every render — most of them — does not tear its place
     in the stack down and build it again on every keystroke. */
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    listen();

    const me = { gone: false, close: () => closeRef.current?.() };
    stack.push(me);
    ensureMarker();

    return () => {
      if (!me.gone) {
        const i = stack.indexOf(me);
        if (i >= 0) stack.splice(i, 1);
      }
      if (!stack.length) releaseMarker();
    };
  }, [open]);
}
