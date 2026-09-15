/* ════════════════════════════════════════════════
   Signing out — the ONE routine, used by every way out.

   The owner: "There is no SIGN OUT anywhere in the app… For an audience
   who may share a phone with family, an app that cannot be left is a
   privacy problem, not an inconvenience." (There was one, at the foot of
   a long Settings page, below the password and privacy sections — which
   is where nobody looks for a way out.)

   Used by the More drawer, Account settings, the admin panel's
   navigation and "this isn't me" during sign-up. Nothing else may call
   supabase.auth.signOut() directly: a way out that forgets part of the
   person is a way out that leaves them behind on the phone.

   ─── IN ORDER ───

   1. SEND WHAT IS WAITING. Daily log entries and log settings made
      offline sit in a queue on the phone. If the phone is online they are
      sent first, and the routine waits for the answer (with a deadline —
      a hung request must not hold the door shut).

   2. ASK ONCE. Always one question, never two. Nothing waiting: "Sign
      out of Saathban on this phone?", because for an Icon who signs in
      by email link a mistaken tap costs a trip to their inbox — possibly
      a family member's help — and one question is cheap against that.
      Something still unsent: the same question says, in words, how many
      entries could not be sent, why, and that signing out now loses them
      from this phone. "Stay signed in" is first, filled and focused.

   3. END THE SESSION ON THIS PHONE (scope "local": other devices stay
      signed in). If the server cannot be reached the session on the
      phone is removed anyway — leaving must never depend on a signal.

   4. FORGET THE PERSON. Every key in localStorage and sessionStorage
      goes, except the few that belong to the phone rather than to
      whoever was holding it (KEEP_ON_DEVICE, below). An allow-list and
      not a deny-list, so a copy some future screen adds is forgotten by
      default instead of surviving until somebody remembers to list it.
      IndexedDB (the app keeps none; a library might) goes too. The
      service worker's caches hold the app's own files only — the shell
      and hashed bundles, never anything fetched from Supabase, which is
      cross-origin and never intercepted — so those are kept, and any
      cache that is not the app's is removed.

   5. LEAVE BY REPLACING THE PAGE, not by routing. A fresh document is the
      only way to be sure nothing held in memory survives — held message
      data, the signed avatar URLs, the log-prefs store, the kept tab
      panes and whatever the next screen adds. location.replace, so the
      signed-in page is not the entry Back returns to; older entries that
      Back can still reach load signed out, and their guard sends them to
      the login screen once.
   ════════════════════════════════════════════════ */

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { APP_COLORS as C, A11Y } from "../../shared/tokens.js";
import supabase from "./supabase.js";
import { useI18n } from "./i18n.jsx";
import { isOnline, readStoredSession, storedUserId } from "./offline.js";
import { LANG_STORAGE_KEY } from "../locales/index.js";
import { sendUnsentPrefs, unsentPrefsCount } from "./iconPrefs.js";
import { allQueuedLogCount, flushLogQueue } from "../routes/home/logStore.js";
import useBackToClose from "../components/useBackToClose.js";

export const LOGIN_PATH = "/app/auth/login";

/* What stays on the phone after a sign-out. The language and the text
   size are how this phone is read — the login screen needs them, and the
   next person to pick it up is most often the same household reading
   the same script at the same size. The sound level is the phone's
   volume, not a secret. The chunk-reload stamp is a guard against a
   reload loop after a deploy. None of them says anything about anybody. */
const KEEP_ON_DEVICE = new Set([
  LANG_STORAGE_KEY, // saathban.app.lang
  "saathban.app.textSize",
  "saathban.app.sound",
]);
const KEEP_IN_SESSION = new Set(["saathban.chunkReloadAt"]);

const SEND_DEADLINE_MS = 15000;
const SIGN_OUT_DEADLINE_MS = 6000;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/* ── What is waiting to be sent ── */
export function unsentOnDevice() {
  return { logs: allQueuedLogCount(), prefs: unsentPrefsCount() };
}

/* Send what is waiting, if the phone is online. Resolves to what is
   STILL waiting afterwards, with why: "offline" (never tried) or
   "failed" (tried, and something did not go). */
export async function sendBeforeSignOut() {
  const before = unsentOnDevice();
  if (!before.logs && !before.prefs) return { ...before, sent: 0, reason: null };
  if (!isOnline()) return { ...before, sent: 0, reason: "offline" };
  const uid = storedUserId();
  const attempt = (async () => {
    if (uid) await flushLogQueue(uid).catch(() => {});
    await sendUnsentPrefs().catch(() => {});
  })();
  await Promise.race([attempt, wait(SEND_DEADLINE_MS)]);
  const after = unsentOnDevice();
  return {
    ...after,
    sent: Math.max(0, before.logs - after.logs),
    reason: after.logs || after.prefs ? (isOnline() ? "failed" : "offline") : null,
  };
}

/* ── Forgetting the person ── */
function clearStorages(removed = []) {
  try {
    const ls = window.localStorage;
    const doomed = [];
    /* Collected first, removed after: key(i) has no stable order once the
       store is mutated (lib/supabase.js found this in Edge). */
    for (let i = 0; i < ls.length; i += 1) {
      const k = ls.key(i);
      if (k && !KEEP_ON_DEVICE.has(k)) doomed.push(k);
    }
    doomed.forEach((k) => ls.removeItem(k));
    removed.push(...doomed);
  } catch {
    /* storage unavailable — then nothing was kept either */
  }
  try {
    const ss = window.sessionStorage;
    const doomed = [];
    for (let i = 0; i < ss.length; i += 1) {
      const k = ss.key(i);
      if (k && !KEEP_IN_SESSION.has(k)) doomed.push(k);
    }
    doomed.forEach((k) => ss.removeItem(k));
  } catch {
    /* ditto */
  }
  return removed;
}

export async function forgetPersonOnDevice() {
  const removed = clearStorages();
  try {
    if (window.indexedDB && typeof window.indexedDB.databases === "function") {
      const dbs = await window.indexedDB.databases();
      await Promise.all(
        (dbs || []).filter((d) => d && d.name).map(
          (d) =>
            new Promise((resolve) => {
              const req = window.indexedDB.deleteDatabase(d.name);
              req.onsuccess = req.onerror = req.onblocked = () => resolve();
            })
        )
      );
    }
  } catch {
    /* no IndexedDB here */
  }
  try {
    if (window.caches) {
      const names = await window.caches.keys();
      /* saathban-app-<build> is the app shell and its hashed files
         (src/sw-template.js); nothing personal is ever put in it. */
      await Promise.all(names.filter((n) => !n.startsWith("saathban-app-")).map((n) => window.caches.delete(n)));
    }
  } catch {
    /* no Cache Storage here */
  }
  return removed;
}

/* ── The routine ── */
export async function signOutOfThisDevice({ to = LOGIN_PATH } = {}) {
  try {
    supabase.auth.stopAutoRefresh();
  } catch {
    /* not running */
  }
  try {
    /* scope "local": this phone only. auth-js removes the stored session
       even when the request fails; the deadline covers a request that
       neither succeeds nor fails (an expired token with no network makes
       getSession retry for up to thirty seconds). */
    await Promise.race([supabase.auth.signOut({ scope: "local" }), wait(SIGN_OUT_DEADLINE_MS)]);
  } catch {
    /* the local clear below still happens */
  }
  await forgetPersonOnDevice();
  /* AGAIN, ON THE WAY OUT — AND ONCE MORE AS THE PAGE GOES. The session
     ending re-renders the page: the guard on screen redirects to the login
     screen, which stashes the page the person was on (saathban.auth.from).
     location.replace does not stop this page's code — it keeps running
     until the next page arrives — so a clear here alone was measured
     losing to that stash. pagehide runs as this document is unloaded,
     after anything it could still write and before the next page starts. */
  clearStorages();
  window.addEventListener("pagehide", () => clearStorages(), { once: true });
  /* AND THE HISTORY ENTRY'S STATE. The guard's redirect leaves
     { from: <the page they were on> } on the entry; replacing to the same
     address carried that state into the fresh page (measured in Edge),
     and the login screen stashed it again — so the next person to sign in
     would have been sent to the previous person's page. */
  try {
    window.history.replaceState(null, "", to);
  } catch {
    /* the navigation below still happens */
  }
  window.location.replace(to);
}

/* ── A page from before a sign-out must not come back to life ──
   A page restored from the back-forward cache, or another tab of the app,
   still holds whoever was signed in, in memory. When the stored session
   has gone, such a page reloads onto the login screen. */
function onSignedInPath() {
  const p = window.location.pathname;
  return p.startsWith("/app") && !p.startsWith("/app/auth");
}
if (typeof window !== "undefined") {
  window.addEventListener("pageshow", (e) => {
    if (e.persisted && onSignedInPath() && !readStoredSession()) window.location.replace(LOGIN_PATH);
  });
  window.addEventListener("storage", (e) => {
    if (e.key && /^sb-.*-auth-token$/.test(e.key) && e.oldValue && e.newValue === null && onSignedInPath()) {
      window.location.replace(LOGIN_PATH);
    }
  });
}

/* ── The question, and the hook every button uses ──

   const signOut = useSignOut();
   <button onClick={signOut.begin}>…</button>
   {signOut.element} */
export function useSignOut() {
  /* phase: null (closed) | "sending" | "ask" | "leaving" */
  const [phase, setPhase] = useState(null);
  const [result, setResult] = useState(null);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  const begin = useCallback(async () => {
    const waiting = unsentOnDevice();
    if ((waiting.logs || waiting.prefs) && isOnline()) {
      setResult(null);
      setPhase("sending");
      const r = await sendBeforeSignOut();
      if (!alive.current) return;
      setResult(r);
      setPhase((p) => (p === "sending" ? "ask" : p));
      return;
    }
    setResult({ ...waiting, sent: 0, reason: waiting.logs || waiting.prefs ? "offline" : null });
    setPhase("ask");
  }, []);

  const cancel = useCallback(() => setPhase(null), []);
  const confirm = useCallback(() => {
    setPhase("leaving");
    signOutOfThisDevice();
  }, []);

  const element = phase ? (
    <SignOutDialog phase={phase} result={result} onCancel={cancel} onConfirm={confirm} />
  ) : null;
  return { begin, element, open: Boolean(phase) };
}

function SignOutDialog({ phase, result, onCancel, onConfirm }) {
  const { t, ts, meta, lang, scale } = useI18n();
  const stayRef = useRef(null);
  const leaving = phase === "leaving";
  /* Back resolves to the reversible answer — but not once leaving. */
  useBackToClose(phase !== "leaving", onCancel);

  useEffect(() => {
    if (phase === "ask") stayRef.current?.focus();
  }, [phase]);

  const logs = result?.logs || 0;
  const prefs = result?.prefs || 0;
  const unsent = logs > 0 || prefs > 0;

  let title;
  const lines = [];
  if (phase === "sending") {
    title = t("layout.signOut.sendingTitle");
    lines.push(t("layout.signOut.sendingBody"));
  } else if (unsent) {
    title = t("layout.signOut.unsentTitle");
    if (logs) lines.push(t(logs === 1 ? "layout.signOut.unsentLogsOne" : "layout.signOut.unsentLogsMany", { n: logs }));
    if (prefs) lines.push(t("layout.signOut.unsentPrefs"));
    lines.push(t(result.reason === "failed" ? "layout.signOut.whyFailed" : "layout.signOut.whyOffline"));
    lines.push(t(logs > 1 || (logs && prefs) ? "layout.signOut.lostMany" : "layout.signOut.lostOne"));
  } else {
    title = t("layout.signOut.title");
    if (result?.sent) {
      lines.push(t(result.sent === 1 ? "layout.signOut.sentOne" : "layout.signOut.sentMany", { n: result.sent }));
    }
    lines.push(t("layout.signOut.body"));
  }

  const btn = {
    width: "100%",
    minHeight: Math.max(52, A11Y.minTapTargetPx),
    borderRadius: 50,
    fontFamily: "inherit",
    fontSize: ts(A11Y.minBodyPx),
    fontWeight: 700,
    lineHeight: meta.lineHeight,
    padding: "8px 18px",
    cursor: leaving ? "default" : "pointer",
  };

  const dialog = (
    <div
      onClick={leaving ? undefined : onCancel}
      data-sb-signout-dim
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 130,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="sb-signout-title"
        aria-describedby="sb-signout-body"
        aria-busy={phase !== "ask"}
        data-sb-signout={phase}
        dir={meta.dir}
        lang={lang}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          /* Escape answers THIS question only — without the stop, the
             drawer underneath would close on the same key. */
          if (e.key === "Escape") {
            e.stopPropagation();
            if (!leaving) onCancel();
          }
        }}
        style={{
          "--sb-text-scale": scale,
          width: "100%",
          maxWidth: 460,
          boxSizing: "border-box",
          background: C.surface || C.white,
          color: C.textMain,
          fontFamily: meta.fonts.body,
          lineHeight: meta.lineHeight,
          borderRadius: 20,
          padding: "22px 20px 20px",
          maxHeight: "90dvh",
          overflowY: "auto",
          textAlign: "start",
        }}
      >
        <h2
          id="sb-signout-title"
          style={{ margin: "0 0 10px", fontSize: ts(22), fontWeight: 800, lineHeight: meta.lineHeight, color: C.textMain }}
        >
          {title}
        </h2>
        <div id="sb-signout-body" role={phase === "sending" ? "status" : undefined}>
          {lines.map((line, i) => (
            <p key={i} style={{ margin: "0 0 12px", fontSize: ts(A11Y.minBodyPx), color: C.textMain }}>
              {line}
            </p>
          ))}
        </div>
        {phase !== "sending" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
            <button
              ref={stayRef}
              type="button"
              data-sb-signout-stay
              disabled={leaving}
              onClick={onCancel}
              style={{ ...btn, border: "none", background: C.green, color: C.white, opacity: leaving ? 0.6 : 1 }}
            >
              {t("layout.signOut.stay")}
            </button>
            <button
              type="button"
              data-sb-signout-confirm
              aria-busy={leaving}
              onClick={leaving ? undefined : onConfirm}
              style={{ ...btn, border: `2px solid ${C.brown}`, background: "transparent", color: C.brown }}
            >
              {leaving ? t("layout.signOut.leaving") : t(unsent ? "layout.signOut.confirmAnyway" : "layout.signOut.confirm")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
  return createPortal(dialog, document.body);
}
