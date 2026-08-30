/* ════════════════════════════════════════════════
   Personal invite links (PRODUCT_DECISIONS §7, "Inviting people from
   outside") — the client half of 0071.

   A link plus a ready message for WhatsApp. The link carries no power:
   it names who invited you and takes you to their profile. Connecting
   is a tap the arriving person makes there, never something the link
   did on their behalf.

   Two kinds, and the difference is evidence:
     personal — minted for one person, bound to whoever opens it first;
       their tap connects, because the invitation was the inviter's half.
     group    — one stable link for a WhatsApp group; a tap only ASKS,
       and the inviter answers in the ordinary requests inbox.

   Every refusal is the server's. This file translates answers into
   screens and never decides one.
   ════════════════════════════════════════════════ */

import supabase from "./supabase.js";

const PENDING_KEY = "saathban.invite.pending";
const PENDING_TTL_MS = 24 * 60 * 60 * 1000;

/* Codes are lower-case letters and digits from an unambiguous alphabet
   (0071). Anything else in the URL is not a code, and saying so early
   saves a pointless round trip. */
export const cleanCode = (code) =>
  String(code || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");

/* Absolute, because it is going into somebody else's messaging app. */
export function inviteUrl(code) {
  const origin =
    typeof window !== "undefined" && window.location ? window.location.origin : "";
  return `${origin}/app/hello/${cleanCode(code)}`;
}

export async function createInviteLink(kind = "personal") {
  const { data, error } = await supabase.rpc("create_personal_invite", { p_kind: kind });
  if (error) throw new Error(error.message);
  return data;
}

/* Resolves a link to the person who sent it. BINDS a personal link to
   this reader; connects nothing. */
export async function openInvite(code) {
  const { data, error } = await supabase.rpc("open_personal_invite", {
    p_code: cleanCode(code),
  });
  if (error) throw new Error(error.message);
  return data || { result: "gone" };
}

/* The tap. Returns "connected" | "requested" | "gone" | "own" | "blocked". */
export async function acceptInvite(code) {
  const { data, error } = await supabase.rpc("accept_personal_invite", {
    p_code: cleanCode(code),
  });
  if (error) throw new Error(error.message);
  return data;
}

/* ─── Surviving the sign-up ───────────────────────────────────────
   The whole point of an invite link is that it is tapped by somebody
   who has never opened Saathban. That journey crosses a sign-up, and
   the magic-link email usually opens a NEW TAB where sessionStorage
   and router state are both gone — so the code waits in localStorage.

   This does NOT reuse the games stash: stashPendingJoin() runs its
   argument through digitsOnly(), which is right for a six-digit table
   code and would erase a letters-and-digits invite entirely.
   ───────────────────────────────────────────────────────────────── */

export function stashPendingInvite(code) {
  const clean = cleanCode(code);
  if (clean.length < 6) return;
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify({ code: clean, at: Date.now() }));
  } catch {
    /* private mode or storage off — the journey degrades, never breaks */
  }
}

export function readPendingInvite() {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const { code, at } = JSON.parse(raw);
    if (!code || !at || Date.now() - at > PENDING_TTL_MS) {
      clearPendingInvite();
      return null;
    }
    return code;
  } catch {
    return null;
  }
}

export function clearPendingInvite() {
  try {
    localStorage.removeItem(PENDING_KEY);
  } catch {
    /* nothing to do */
  }
}

/* Hand the link to the phone's own share sheet — that is what puts it
   one tap from WhatsApp. navigator.share needs a gesture and a secure
   context and is absent on most desktops, so the clipboard is the
   fallback and the visible URL is the fallback's fallback.
   Returns "shared" | "copied" | "cancelled" | "unavailable". */
export async function shareInvite({ code, title, text }) {
  const url = inviteUrl(code);
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({ title, text: `${text}\n${url}`, url });
      return "shared";
    } catch (err) {
      if (err && err.name === "AbortError") return "cancelled";
      /* fall through to the clipboard */
    }
  }
  try {
    await navigator.clipboard.writeText(`${text}\n${url}`);
    return "copied";
  } catch {
    return "unavailable";
  }
}

/* WhatsApp's own share URL, for the desktop and for phones without a
   share sheet. wa.me opens the app with the message already typed. */
export function whatsappHref(text, code) {
  return `https://wa.me/?text=${encodeURIComponent(`${text}\n${inviteUrl(code)}`)}`;
}
