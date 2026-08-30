/* ════════════════════════════════════════════════
   Join-by-link — the link IS the code.

   A table's 6-digit join code, wrapped in a URL so it can travel
   through WhatsApp. /app/join/<code> calls exactly the same
   `join_by_code` RPC the typed-code box calls: same rate limit (12
   tries per 5 minutes), same eligibility gates (can_use_community,
   so a pending or suspended Buddy is refused), same lobby-only
   lookup. There is no second join mechanism and nothing is relaxed
   for people arriving by link — a link that leaked is worth exactly
   as much as a code read aloud, which is the property the code
   already had.

   The stash exists for one journey: a person who has never opened
   Saathban taps a link in WhatsApp, installs, signs up, and should
   land AT THE TABLE rather than on a generic home screen. That trip
   crosses a login, and often a new tab when the sign-in email is
   opened — so the code goes in localStorage, not sessionStorage,
   which is per-tab and would be empty exactly when it mattered.
   ════════════════════════════════════════════════ */

const PENDING_KEY = "saathban.join.pending";
const PENDING_TTL_MS = 24 * 60 * 60 * 1000;

export const digitsOnly = (code) => String(code || "").replace(/\D/g, "");

/* The shareable URL for a table. Absolute, because it is going into
   somebody else's messaging app. */
export function joinUrl(code) {
  const clean = digitsOnly(code);
  const origin =
    typeof window !== "undefined" && window.location ? window.location.origin : "";
  return `${origin}/app/join/${clean}`;
}

/* Remember a code across sign-in/sign-up. Best-effort: if storage is
   unavailable the person still lands signed in, just on their home. */
export function stashPendingJoin(code) {
  const clean = digitsOnly(code);
  if (clean.length < 6) return;
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify({ code: clean, at: Date.now() }));
  } catch {
    /* private mode or storage off — the journey degrades, never breaks */
  }
}

export function readPendingJoin() {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const { code, at } = JSON.parse(raw);
    if (!code || !at || Date.now() - at > PENDING_TTL_MS) {
      clearPendingJoin();
      return null;
    }
    return code;
  } catch {
    return null;
  }
}

export function clearPendingJoin() {
  try {
    localStorage.removeItem(PENDING_KEY);
  } catch {
    /* nothing to do */
  }
}

/* Hand the link to the phone's own share sheet — that is what puts it
   one tap from WhatsApp. navigator.share needs a user gesture and a
   secure context, and is absent on most desktop browsers, so the
   clipboard is the fallback and a visible URL is the fallback's
   fallback. Returns how it went so the caller can say the right thing:
   "shared" | "copied" | "cancelled" | "unavailable". */
export async function shareJoinLink({ code, title, text }) {
  const url = joinUrl(code);
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return "shared";
    } catch (err) {
      // A person dismissing the sheet is not a failure — say nothing.
      if (err && err.name === "AbortError") return "cancelled";
      /* fall through to the clipboard */
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    return "copied";
  } catch {
    return "unavailable";
  }
}
