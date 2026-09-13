/* ════════════════════════════════════════════════
   Opening with no network — the small helpers Home paints from.

   The audience is on patchy mobile data. Somebody who opens the app to
   nothing sees a broken app, not a slow one, so the screens a person
   lands on keep a copy of the last thing they showed and draw from it
   first; the network replaces it when it answers.

   THREE RULES, kept here so no screen has to remember them:

   1. EVERY COPY IS KEYED BY THE SIGNED-IN PERSON'S ID, and a copy whose
      stamp names somebody else is never read. A phone two people share
      must never show one of them the other's day.

   2. A COPY IS ONLY WRITTEN FOR WHOEVER IS SIGNED IN NOW. The session on
      the device is read synchronously at write time; an answer that
      arrives after a sign-out (or after somebody else signed in) is
      dropped instead of re-creating what sign-out just removed.

   3. SIGN-OUT TAKES EVERY COPY WITH IT. The prefixes below are listed in
      SIGNED_IN_CACHE_PREFIXES (lib/supabase.js); a new prefix that is
      not listed there would survive sign-out.

   All storage is wrapped: private browsing, a full disk or a blocked
   storage simply means the next open waits for the network, as it did
   before any of this existed.
   ════════════════════════════════════════════════ */

import { useSyncExternalStore } from "react";

export const PROFILE_CACHE_PREFIX = "saathban.app.profile.";
export const STREAKS_CACHE_PREFIX = "saathban.app.streaks.";
export const COMPANY_CACHE_PREFIX = "saathban.app.company.";

const CACHE_VERSION = 1;

/* ── The session Supabase keeps on the device ──

   supabase-js stores it under sb-<project ref>-auth-token. Reading it
   directly is what lets Home paint before the client has finished
   deciding anything: with an expired access token and no network,
   getSession() spends up to thirty seconds retrying a refresh and then
   answers null — while the refresh token it could not use is still
   sitting in storage, untouched, because the client has NOT given up
   on it. Only a refusal from the server removes it (and fires
   SIGNED_OUT). So "is there a stored session" is the honest answer to
   "is this person still signed in on this phone". */
function authStorageKey() {
  try {
    const url = import.meta.env.VITE_SUPABASE_URL;
    return url ? `sb-${new URL(url).hostname.split(".")[0]}-auth-token` : null;
  } catch {
    return null;
  }
}

export function readStoredSession() {
  const key = authStorageKey();
  if (!key) return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || typeof s !== "object" || !s.refresh_token || !s.user || !s.user.id) return null;
    return s;
  } catch {
    return null;
  }
}

export function storedUserId() {
  return readStoredSession()?.user?.id ?? null;
}

/* ── Per-person copies ── */

/* { data, at } or null. maxAgeMs: an older copy is ignored rather than
   shown as though it were recent. */
export function readUserCache(prefix, uid, { maxAgeMs } = {}) {
  if (!uid) return null;
  try {
    const raw = window.localStorage.getItem(prefix + uid);
    if (!raw) return null;
    const c = JSON.parse(raw);
    if (!c || c.v !== CACHE_VERSION || c.uid !== uid) return null;
    if (maxAgeMs && !(Date.now() - c.at < maxAgeMs)) return null;
    return { data: c.data, at: c.at };
  } catch {
    return null;
  }
}

export function writeUserCache(prefix, uid, data) {
  if (!uid || storedUserId() !== uid) return;
  try {
    window.localStorage.setItem(
      prefix + uid,
      JSON.stringify({ v: CACHE_VERSION, uid, at: Date.now(), data })
    );
  } catch {
    /* storage full or unavailable — the next open waits for the network */
  }
}

export function removeUserCache(prefix, uid) {
  if (!uid) return;
  try {
    window.localStorage.removeItem(prefix + uid);
  } catch {
    /* nothing stored either */
  }
}

/* ── Is the phone connected at all ──

   navigator.onLine is only trustworthy in one direction: false means
   there is certainly no network. true means there is an interface, not
   that anything answers — which is why screens also treat a failed
   fetch as "no connection" and a late one as "slow". */
export function isOnline() {
  return typeof navigator === "undefined" || navigator.onLine !== false;
}

function subscribeOnline(fn) {
  window.addEventListener("online", fn);
  window.addEventListener("offline", fn);
  return () => {
    window.removeEventListener("online", fn);
    window.removeEventListener("offline", fn);
  };
}

export function useOnline() {
  return useSyncExternalStore(subscribeOnline, isOnline, () => true);
}
