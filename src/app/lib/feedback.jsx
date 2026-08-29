/* ════════════════════════════════════════════════
   The feedback layer — one pattern so every action in the app feels
   completed.

   Four pieces, all from this file:

     useToast()   → toast(text, opts)   a warm line at the bottom of
                    the screen, auto-dismissing, stacking, bilingual
                    (callers pass already-translated text through t()).
     useAction()  → [run, pending]      wraps an async handler: guards
                    double-submit, reports the outcome as a toast, and
                    hands back a pending flag for the button.
     useFresh()   → { mark, props }     the thing you just made glows
                    briefly and the view scrolls to it.
     <FeedbackProvider> mounts the host once, app-wide (AppRoot).

   House rules encoded here:
   - State is never colour alone: every toast carries a glyph and
     words (✓ / ⚠ / ·).
   - Errors are kind and actionable — they say what happened and offer
     Retry, never a raw server string unless it is already a locale
     key the caller translated.
   - ≥18px text through ts(), ≥48px dismiss target, RTL-safe insets.
   - Reduced motion: the glow and the scroll both stand down.
   ════════════════════════════════════════════════ */

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useNavigate } from "react-router-dom";
import { COLORS as C, A11Y } from "../../shared/tokens.js";
import { useI18n } from "./i18n.jsx";

/* ─── Toast store (module level: any component can raise one) ─── */

const MAX_VISIBLE = 3;
const LIFETIME_MS = 4200;
const LIFETIME_WITH_ACTION_MS = 7000;

let toasts = [];
let seq = 0;
const listeners = new Set();

function emit() {
  toasts = [...toasts];
  listeners.forEach((l) => l());
}
function subscribe(l) {
  listeners.add(l);
  return () => listeners.delete(l);
}
const getSnapshot = () => toasts;

export function dismissToast(id) {
  const t = toasts.find((x) => x.id === id);
  if (t?.timer) clearTimeout(t.timer);
  toasts = toasts.filter((x) => x.id !== id);
  emit();
}

/* Raise a toast. `text` is already translated by the caller (t()).
   opts: { tone: "success"|"info"|"error", actionLabel, onAction, key }
   A repeated `key` replaces its predecessor rather than stacking —
   for rapid taps on the same control. */
export function pushToast(text, opts = {}) {
  if (!text) return null;
  const { tone = "success", actionLabel, onAction, key } = opts;
  if (key) {
    const prior = toasts.find((x) => x.key === key);
    if (prior) dismissToast(prior.id);
  }
  const id = ++seq;
  const life = actionLabel ? LIFETIME_WITH_ACTION_MS : LIFETIME_MS;
  const timer = setTimeout(() => dismissToast(id), life);
  toasts = [...toasts, { id, text, tone, actionLabel, onAction, key, timer }];
  // Oldest falls away when the stack is full — the newest news wins.
  while (toasts.length > MAX_VISIBLE) {
    const oldest = toasts[0];
    if (oldest.timer) clearTimeout(oldest.timer);
    toasts = toasts.slice(1);
  }
  emit();
  return id;
}

export function useToasts() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/* The hook components use. Stable identity so it can sit in deps. */
export function useToast() {
  const toast = useCallback((text, opts) => pushToast(text, opts), []);
  const success = useCallback((text, opts) => pushToast(text, { ...opts, tone: "success" }), []);
  const info = useCallback((text, opts) => pushToast(text, { ...opts, tone: "info" }), []);
  const error = useCallback((text, opts) => pushToast(text, { ...opts, tone: "error" }), []);
  return useMemo(() => ({ toast, success, info, error, dismiss: dismissToast }), [toast, success, info, error]);
}

/* ─── useAction: one guarded run of an async handler ───

   const [save, saving] = useAction(async () => { … }, {
     success: () => t("feedback.reminderSaved"),
     error:   () => t("feedback.somethingWrong"),
     retry:   true,            // offer Retry on the error toast
   });

   - a second call while the first is in flight is ignored (no
     double-submit, no double-post);
   - the handler's own thrown Error message is used when `error`
     isn't given AND the message looks like human copy (a locale
     string the caller already translated), never a raw PostgREST blob.
*/
const RAW_ERROR = /(duplicate key|violates|permission denied|jwt|syntax error|relation|null value|constraint)/i;

export function useAction(handler, opts = {}) {
  const [pending, setPending] = useState(false);
  const alive = useRef(true);
  const running = useRef(false);
  const { toast } = useToast();
  const { t } = useI18n();
  useEffect(() => () => { alive.current = false; }, []);

  const optsRef = useRef(opts);
  optsRef.current = opts;
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  const run = useCallback(
    async (...args) => {
      if (running.current) return undefined; // double-submit guard
      running.current = true;
      setPending(true);
      const o = optsRef.current;
      try {
        const result = await handlerRef.current(...args);
        if (o.success) {
          const line = typeof o.success === "function" ? o.success(result) : o.success;
          if (line) toast(line, { tone: "success", key: o.key });
        }
        return result;
      } catch (e) {
        const custom = typeof o.error === "function" ? o.error(e) : o.error;
        const own = e?.message && !RAW_ERROR.test(e.message) ? e.message : null;
        const line = custom || own || t("feedback.somethingWrong");
        toast(line, {
          tone: "error",
          key: o.key,
          actionLabel: o.retry ? t("feedback.retry") : undefined,
          onAction: o.retry ? () => run(...args) : undefined,
        });
        if (o.rethrow) throw e;
        return undefined;
      } finally {
        running.current = false;
        if (alive.current) setPending(false);
      }
    },
    [toast, t]
  );

  return [run, pending];
}

/* Say it, then go. The host is app-wide, so the line survives the
   navigation and stays readable on the next screen — no racing a
   timer against an unmount (games lane's decline flow). */
export function useToastThenGo() {
  const navigate = useNavigate();
  return useCallback(
    (text, to, opts = {}) => {
      const { delay = 1200, replace = false, ...toastOpts } = opts;
      pushToast(text, toastOpts);
      setTimeout(() => navigate(to, { replace }), delay);
    },
    [navigate]
  );
}

/* ─── useFresh: the thing you just made glows and is scrolled to ─── */

export function useFresh({ ms = 2600 } = {}) {
  const [freshId, setFreshId] = useState(null);
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  const mark = useCallback(
    (id) => {
      if (id == null) return;
      setFreshId(id);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setFreshId(null), ms);
    },
    [ms]
  );

  /* Scroll when the node actually exists. Marking re-renders the list,
     which re-registers every ref (null, then the node) — a single
     rAF can land in that gap and silently scroll nothing, so this
     retries briefly instead. */
  useEffect(() => {
    if (freshId == null) return undefined;
    let tries = 0;
    let handle = null;
    const tick = () => {
      // NB: CSS.escape is unavailable here — this module declares its
      // own `CSS` stylesheet constant, which shadows the global.
      const node = document.querySelector(`[data-fresh=${JSON.stringify(String(freshId))}]`);
      if (node?.scrollIntoView) {
        const still = !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
        try {
          node.scrollIntoView({ behavior: still ? "smooth" : "auto", block: "center" });
        } catch {
          node.scrollIntoView();
        }
        return;
      }
      if (++tries < 12) handle = setTimeout(tick, 100);
    };
    tick();
    return () => clearTimeout(handle);
  }, [freshId]);

  /* A data attribute, deliberately — not a ref. These props are
     spread through lane Card components, and React drops a ref passed
     to a function component, so the highlight would silently do
     nothing (found in testing). An attribute survives any number of
     component boundaries, as long as the component spreads its extra
     props onto a DOM node. */
  const props = useCallback(
    (id) => ({
      "data-fresh": String(id),
      className: freshId === id ? "sb-fresh" : undefined,
    }),
    [freshId]
  );

  return useMemo(() => ({ mark, props, freshId }), [mark, props, freshId]);
}

/* ─── The host ─── */

const TONES = {
  success: { glyph: "✓", bg: C.brown, fg: C.cream, role: "status" },
  info: { glyph: "·", bg: C.brown, fg: C.cream, role: "status" },
  error: { glyph: "⚠", bg: "#6d2b20", fg: C.cream, role: "alert" },
};

const CSS = `
  @keyframes sbToastIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
  @keyframes sbFreshGlow {
    0%   { box-shadow: 0 0 0 3px rgba(122,155,102,0.65); background-color: rgba(238,243,234,0.85); }
    100% { box-shadow: 0 0 0 3px rgba(122,155,102,0); background-color: transparent; }
  }
  .sb-toast { animation: sbToastIn 0.22s ease both; }
  .sb-fresh { animation: sbFreshGlow 2.4s ease-out both; border-radius: 16px; }
  @media (prefers-reduced-motion: reduce) {
    .sb-toast, .sb-fresh { animation: none !important; }
    .sb-fresh { box-shadow: 0 0 0 3px rgba(122,155,102,0.65); }
  }
`;

export function ToastHost() {
  const { ts } = useI18n();
  const items = useToasts();
  const { t } = useI18n();
  if (items.length === 0) return null;
  return (
    <>
      <div
        aria-live="polite"
        style={{
          position: "fixed",
          insetInlineStart: 0,
          insetInlineEnd: 0,
          bottom: 20,
          zIndex: 90,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
          pointerEvents: "none",
          padding: "0 12px",
        }}
      >
        {items.map((item) => {
          const tone = TONES[item.tone] || TONES.info;
          return (
            <div
              key={item.id}
              className="sb-toast"
              role={tone.role}
              style={{
                pointerEvents: "auto",
                maxWidth: "min(92vw, 560px)",
                width: "fit-content",
                background: tone.bg,
                color: tone.fg,
                fontSize: ts(A11Y.minBodyPx),
                lineHeight: 1.5,
                padding: "12px 16px 12px 18px",
                borderRadius: 16,
                boxShadow: "0 6px 24px rgba(45, 36, 24, 0.35)",
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <span aria-hidden="true" style={{ fontSize: ts(20), fontWeight: 700 }}>
                {tone.glyph}
              </span>
              <span style={{ flex: 1 }}>{item.text}</span>
              {item.actionLabel && (
                <button
                  type="button"
                  onClick={() => {
                    dismissToast(item.id);
                    item.onAction?.();
                  }}
                  style={{
                    minHeight: A11Y.minTapTargetPx,
                    background: "none",
                    border: "none",
                    color: tone.fg,
                    fontSize: ts(A11Y.minBodyPx),
                    fontWeight: 700,
                    fontFamily: "inherit",
                    textDecoration: "underline",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  {item.actionLabel}
                </button>
              )}
              <button
                type="button"
                onClick={() => dismissToast(item.id)}
                aria-label={t("feedback.dismiss")}
                style={{
                  minHeight: A11Y.minTapTargetPx,
                  minWidth: A11Y.minTapTargetPx,
                  background: "none",
                  border: "none",
                  color: tone.fg,
                  fontSize: ts(20),
                  fontFamily: "inherit",
                  cursor: "pointer",
                  opacity: 0.8,
                }}
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}

/* Mounted once in AppRoot (FEEDBACK_WIRING.md). Children render
   untouched; the host sits above them. */
export default function FeedbackProvider({ children }) {
  return (
    <>
      {/* Always mounted: the .sb-fresh keyframes are needed whenever a
          created thing glows, which happens with no toast on screen
          (found in testing — the highlight silently did nothing). */}
      <style>{CSS}</style>
      {children}
      <ToastHost />
    </>
  );
}
