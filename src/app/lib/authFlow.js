/* ════════════════════════════════════════════════
   Auth flows — the Supabase calls behind /app/auth.

   Two ways in (SPEC.md, Auth):
   - Magic link for Saath-Icons and Saath-Fam. The link IS the
     frictionless path; a web app cannot read the inbox, so there is
     no OTP autofill to design for.
   - Email + password for Saath-Buddies.

   Account creation is two-phase: the signup form stashes its fields
   in auth user_metadata (pending_*), and the profile row is created
   AFTER the first real session exists — either automatically in
   ensureProfile() (Complete screen) or from the finish-mode forms
   via finishProfile() when there is a session but no stashed data
   (assisted signup: staff created the auth account at an event).
   ════════════════════════════════════════════════ */

import supabase from "./supabase.js";
import { SIGNUP_ROLES } from "../constants/roles.js";

const completeUrl = () => `${window.location.origin}/app/auth/complete`;

export const isValidEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((v || "").trim());

export function sendMagicLink(email, metadata = {}, { createUser = true } = {}) {
  return supabase.auth.signInWithOtp({
    email: email.trim(),
    options: {
      emailRedirectTo: completeUrl(),
      shouldCreateUser: createUser,
      data: metadata,
    },
  });
}

export function signUpWithPassword(email, password, metadata = {}) {
  return supabase.auth.signUp({
    email: email.trim(),
    password,
    options: { emailRedirectTo: completeUrl(), data: metadata },
  });
}

// Accepts both Latin and Urdu commas.
const splitLanguages = (s) =>
  (s || "")
    .split(/[,،]/)
    .map((x) => x.trim())
    .filter(Boolean);

const deviceTimezone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
};

const clean = (v) => ((v || "").trim() ? v.trim() : null);

function profileRow(userId, src) {
  return {
    id: userId,
    role: src.role,
    full_name: (src.full_name || "").trim(),
    phone: clean(src.phone),
    city: clean(src.city),
    country: clean(src.country),
    relationship: clean(src.relationship),
    languages: Array.isArray(src.languages)
      ? src.languages
      : splitLanguages(src.languages),
    timezone: deviceTimezone(),
  };
}

// 23505 = unique violation: the profile already exists (double-tap,
// two tabs) — that is success, not failure.
const isDuplicate = (error) => error && error.code === "23505";

/* Read the profile row with retries. A transient failure here must
   never bounce an existing account into the finish-mode forms (it
   happened once on the first preview deploy): errors are retried with
   a short backoff, and even a clean empty is re-read once or twice —
   the only cost is ~1s of extra patience for genuinely-new assisted
   signups, which beats greeting an old friend like a stranger. */
async function readProfileWithRetry(userId) {
  const delaysMs = [0, 300, 900];
  let lastError = null;
  for (const delay of delaysMs) {
    if (delay) await new Promise((r) => setTimeout(r, delay));
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, role")
        .eq("id", userId)
        .maybeSingle();
      if (error) throw error;
      lastError = null;
      if (data) return data;
    } catch (e) {
      lastError = e;
    }
  }
  if (lastError) throw lastError;
  return null;
}

/* Called by the Complete screen once a session exists.
   Returns { status, role }: status "ok" (profile present or created,
   role set so the caller can route by it), "needs-details" (no
   profile and nothing stashed — send them to the finish-mode forms),
   or "no-session". */
export async function ensureProfile(session) {
  const user = session?.user;
  if (!user) return { status: "no-session" };

  const existing = await readProfileWithRetry(user.id);
  if (existing) return { status: "ok", role: existing.role };

  const m = user.user_metadata || {};
  const role = SIGNUP_ROLES.includes(m.pending_role) ? m.pending_role : null;
  const fullName = (m.full_name || "").trim();
  if (!role || !fullName) return { status: "needs-details" };

  const { error: insErr } = await supabase
    .from("profiles")
    .insert(profileRow(user.id, { ...m, role, full_name: fullName }));
  if (insErr && !isDuplicate(insErr)) throw insErr;
  return { status: "ok", role };
}

/* Finish mode: a session exists but no profile row and no stashed
   fields — create the profile straight from the form. */
export async function finishProfile(role, fields) {
  if (!SIGNUP_ROLES.includes(role)) throw new Error(`invalid role: ${role}`);
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return { status: "no-session" };

  const { error } = await supabase
    .from("profiles")
    .insert(profileRow(session.user.id, { ...fields, role }));
  if (error && !isDuplicate(error)) throw error;
  return { status: "ok", role };
}
