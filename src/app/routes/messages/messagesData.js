/* ════════════════════════════════════════════════
   The Messages world's data layer — MESSAGES_SPEC.md §3, §4, §5, §6.

   Separate from communityData.js on purpose: Messages is a world now,
   an app inside the app, and a world that reads its rows through the
   feed's module would drag the feed's assumptions along with it.

   What this file does NOT do: anything inside a thread. Sending,
   bubbles, photos, delete-for-everyone and the money banner are
   PRODUCT_DECISIONS §6 and belong to the people lane's ThreadPage.
   The only reach inside is the heart (§6), because the heart also has
   to show up in the chat list preview and so it is the world's
   business as much as the thread's.
   ════════════════════════════════════════════════ */

import { useSyncExternalStore } from "react";
import supabase from "../../lib/supabase.js";

/* Presence is "was she about in the last few minutes", not a channel.
   Three minutes is long enough to survive a screen locking briefly and
   short enough that "about" means it. */
/* THE WORLD'S ADDRESS, said once.

   The Messages world is mounted on a splat route, which means a
   RELATIVE <Link to="..."> inside it resolves against wherever the
   reader is standing, not against the world root. Every relative link
   in here was therefore correct only on the one screen it was written
   on and wrong on every other. Nothing threw; the links simply pointed
   at addresses that do not exist. */
export const WORLD = "/app/community/messages";

export const PRESENT_MS = 3 * 60 * 1000;

export function isAbout(person, now = Date.now()) {
  if (!person?.show_presence || !person?.last_seen_at) return false;
  return now - new Date(person.last_seen_at).getTime() < PRESENT_MS;
}

export async function touchPresence() {
  try {
    await supabase.rpc("touch_presence");
  } catch {
    /* presence is a courtesy; it must never be why something fails */
  }
}

/* ─── §3 Chats ───────────────────────────────────────────────────
   One row per open conversation, newest first, with everything the
   row needs to render: who, what kind of thing was last said, whether
   it is unread, and whether it is archived away.

   The preview says WHAT KIND (§3): "Voice note · 0:12", "Photo",
   "Liked your message". Never a blank line — a row that says nothing
   is the one a person taps to find out, which is the tap the preview
   existed to save.
   ─────────────────────────────────────────────────────────────── */
/* ── THE LIST IS HELD, NOT REFETCHED ──────────────────────────

   Owner, on tapping a message notification and backing out again:
   "I just get lost."

   He was not lost in the thread. He was lost on the way back. The
   chats list mounted with chats = null, drew a "···" placeholder,
   fetched over the network, then redrew — so the screen he returned
   to was not the screen he had left. It was blank first, then a
   different arrangement of the same rows, scrolled to the top.

   Backing out of a conversation is not a fresh visit. It is a return
   to a screen that never really went away, so what it showed is kept
   here at module scope, outliving the component: the rows are drawn
   again on the first frame, from memory, with no spinner and no
   network wait. The refresh still happens, quietly, behind the rows
   that are already there — so the list is current without ever being
   empty.

   Module scope and not React state because the component UNMOUNTS on
   the way into the thread; anything held inside it is gone by the
   time he comes back, which is exactly the bug. ── */

let chatsCache = null;      // last successful fetchChats result
let chatsCacheFor = null;   // whose — so a different account never inherits it
let chatsScrollY = 0;       // where the list was standing

export function cachedChats(myId) {
  return chatsCacheFor && myId && chatsCacheFor === myId ? chatsCache : null;
}
export function rememberChatsScroll(y) { chatsScrollY = y; }
export function rememberedChatsScroll() { return chatsScrollY; }
/* Signing out must not leave one person's conversations in memory for
   whoever signs in next on the same phone. */
export function forgetChatsCache() { chatsCache = null; chatsCacheFor = null; chatsScrollY = 0; streakMailCache = null; streakMailFor = null; }

export async function fetchChats(myId) {
  const rows = await buildChats(myId);
  /* Written only on success. A failed refresh must leave the rows he is
     looking at exactly where they are, not blank the screen. */
  chatsCache = rows;
  chatsCacheFor = myId;
  return rows;
}

async function buildChats(myId) {
  const { data: reqs, error } = await supabase
    .from("dm_requests")
    .select("id, requester_id, recipient_id, status, created_at")
    .or(`requester_id.eq.${myId},recipient_id.eq.${myId}`)
    .eq("status", "accepted");
  if (error) throw new Error(error.message);
  const threads = reqs || [];
  if (!threads.length) return [];

  const ids = threads.map((t) => t.id);
  const otherIds = [...new Set(threads.map((t) => (t.requester_id === myId ? t.recipient_id : t.requester_id)))];

  const [{ data: msgs }, { data: people }, { data: archived }, { data: blocks }] = await Promise.all([
    supabase
      .from("dm_messages")
      .select("id, request_id, sender_id, body, image_path, audio_path, audio_seconds, game_session_id, deleted_at, created_at, read_at")
      .in("request_id", ids)
      .order("created_at", { ascending: false }),
    supabase
      .from("safe_profiles")
      .select("id, full_name, avatar_url, city, show_presence, last_seen_at, read_receipts")
      .in("id", otherIds),
    supabase.from("dm_archived").select("request_id").eq("profile_id", myId),
    /* Both kinds in one read (0145 — Mute is one setting, for a person).
       A muted person's chat stays in the list, marked in words. Somebody
       I blocked is not in Chats: blocking means we do not see each other,
       and their row lives in Menu → Blocked and muted, where it can be
       undone. */
    supabase.from("user_blocks").select("blocked_id, kind").eq("blocker_id", myId),
  ]);

  const byId = new Map((people || []).map((p) => [p.id, p]));
  const archivedSet = new Set((archived || []).map((a) => a.request_id));
  const mutedSet = new Set((blocks || []).filter((b) => b.kind === "mute").map((b) => b.blocked_id));
  const blockedSet = new Set((blocks || []).filter((b) => b.kind === "block").map((b) => b.blocked_id));

  /* The newest message per thread, and whether anything in it is
     unread. Unread is a BOOLEAN here and stays one all the way to the
     screen (§3): a count creates a small debt, a dot says someone is
     there. There is deliberately no number to render. */
  const last = new Map();
  const unread = new Set();
  for (const m of msgs || []) {
    if (!last.has(m.request_id)) last.set(m.request_id, m);
    if (m.sender_id !== myId && !m.read_at) unread.add(m.request_id);
  }

  /* Hearts on the newest messages, so the preview can say "Liked your
     message" rather than repeating the message that was liked. */
  const newestIds = [...last.values()].map((m) => m.id);
  let likedNewest = new Map();
  if (newestIds.length) {
    const { data: likes } = await supabase
      .from("dm_message_likes")
      .select("message_id, profile_id")
      .in("message_id", newestIds);
    for (const l of likes || []) {
      if (l.profile_id !== myId) likedNewest.set(l.message_id, true);
    }
  }

  return threads
    .filter((t) => !blockedSet.has(t.requester_id === myId ? t.recipient_id : t.requester_id))
    .map((t) => {
      const otherId = t.requester_id === myId ? t.recipient_id : t.requester_id;
      const m = last.get(t.id) || null;
      return {
        requestId: t.id,
        otherId,
        person: byId.get(otherId) || null,
        last: m,
        likedByThem: m ? likedNewest.has(m.id) : false,
        unread: unread.has(t.id),
        archived: archivedSet.has(t.id),
        muted: mutedSet.has(otherId),
        at: m?.created_at || t.created_at,
      };
    })
    .sort((a, b) => new Date(b.at) - new Date(a.at));
}

/* ─── Received streaks (0140) ─────────────────────────────────────
   A streak that arrives is a row among the conversations, not a
   notification that scrolls away. One row per person per item — the
   newest — so fourteen days of Mona's water are one row that says where
   she is now. Beside them, the person's own shared streaks as groups.

   Held at module scope for the same reason the chats are: coming back
   from the focused window must not blank the list first. */
let streakMailCache = null;
let streakMailFor = null;

export function cachedStreakMail(myId) {
  return streakMailFor && myId && streakMailFor === myId ? streakMailCache : null;
}

export async function fetchStreakMail(myId) {
  const [{ data: received, error: rErr }, { data: mine, error: mErr }] = await Promise.all([
    supabase.rpc("received_streaks", { p_days: 14 }),
    supabase.rpc("my_streaks"),
  ]);
  if (rErr && mErr) throw new Error(rErr.message);
  const seen = new Set();
  const rows = [];
  for (const r of received || []) {
    const k = r.sender_id + "|" + r.item_key;
    if (seen.has(k)) continue;
    seen.add(k);
    rows.push(r);
  }
  const shared = (mine || []).filter((s) => s.people_count > 0);
  const groups = (
    await Promise.all(
      shared.map((s) =>
        supabase
          .rpc("streak_group", { p_streak: s.id })
          .then(({ data }) => data)
          .catch(() => null)
      )
    )
  ).filter(Boolean);
  const mail = { received: rows, groups };
  streakMailCache = mail;
  streakMailFor = myId;
  return mail;
}

/* What kind of thing the last message was, as a locale key plus its
   values. A key rather than a sentence because the world is bilingual
   and a sentence built here could only ever be one of the two. */
export function previewOf(chat, myId) {
  const m = chat.last;
  if (!m) return { key: "msg.preview.new", values: {} };
  if (chat.likedByThem && m.sender_id === myId) return { key: "msg.preview.liked", values: {} };
  if (m.deleted_at) return { key: "msg.preview.withdrawn", values: {} };
  if (m.audio_path) {
    const s = Math.max(1, Math.round(m.audio_seconds || 0));
    return { key: "msg.preview.voice", values: { len: `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}` } };
  }
  if (m.image_path) return { key: "msg.preview.photo", values: {} };
  if (m.game_session_id && !(m.body || "").trim()) return { key: "msg.preview.game", values: {} };
  const body = (m.body || "").trim();
  if (!body) return { key: "msg.preview.new", values: {} };
  return { key: "msg.preview.text", values: { text: body.length > 48 ? `${body.slice(0, 48)}…` : body } };
}

export async function archiveChat(myId, requestId, on) {
  if (on) {
    const { error } = await supabase.from("dm_archived").insert({ profile_id: myId, request_id: requestId });
    if (error && !/duplicate key/i.test(error.message)) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from("dm_archived")
      .delete()
      .eq("profile_id", myId)
      .eq("request_id", requestId);
    if (error) throw new Error(error.message);
  }
}

/* ─── The thread's own menu: archive, mute, block, report ─────────
   One read for everything the menu needs to say about itself, so each
   row can offer the action or its undo — never both, never a guess. */
export async function fetchThreadState(myId, otherId, requestId) {
  const [{ data: blocks }, archived] = await Promise.all([
    supabase.from("user_blocks").select("kind").eq("blocker_id", myId).eq("blocked_id", otherId),
    requestId
      ? supabase.from("dm_archived").select("request_id").eq("profile_id", myId).eq("request_id", requestId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const kinds = new Set((blocks || []).map((b) => b.kind));
  return {
    blocked: kinds.has("block"),
    archived: !!archived?.data,
    /* The person's Mute (0145). The chat stays open and writable. */
    muted: kinds.has("mute"),
  };
}

/* ONE MUTE, FOR A PERSON (0143–0145). Whatever the door it is set from —
   this thread's menu, a post's menu, the bell — Mute is the same
   user_blocks row with kind 'mute':
     · nothing they do notifies me (0144 drops the row at the database);
     · their posts leave my feed (caller_hides, as "see less" always did);
     · the chat stays open, readable and writable, marked "Muted";
     · they are never told.
   The conversation's dm_muted row is kept in step by the database, so the
   badge and the chat list agree without a second write here. */
export async function mutePerson(myId, otherId, on) {
  if (!myId || !otherId) return;
  if (on) {
    const { error } = await supabase
      .from("user_blocks")
      .upsert(
        { blocker_id: myId, blocked_id: otherId, kind: "mute" },
        { onConflict: "blocker_id,blocked_id,kind", ignoreDuplicates: true }
      );
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from("user_blocks")
      .delete()
      .eq("blocker_id", myId)
      .eq("blocked_id", otherId)
      .eq("kind", "mute");
    if (error) throw new Error(error.message);
  }
}

/* The people I have muted — whether or not we have ever talked. */
export async function fetchMutedPeople(myId) {
  const { data } = await supabase
    .from("user_blocks")
    .select("blocked_id, created_at")
    .eq("blocker_id", myId)
    .eq("kind", "mute");
  const rows = data || [];
  if (!rows.length) return [];
  const { data: people } = await supabase
    .from("safe_profiles")
    .select("id, full_name, city")
    .in("id", rows.map((r) => r.blocked_id));
  const byId = new Map((people || []).map((p) => [p.id, p]));
  return rows.map((r) => ({ id: r.blocked_id, person: byId.get(r.blocked_id) || null, at: r.created_at }));
}

/* Reporting a whole conversation. Moderators have no read path into DM
   threads (QUESTIONS.md C5), so the reporter hands over the other
   person's last few written messages as the excerpt — the confirmation
   screen says so in plain words before anything is sent. */
export async function reportConversation(myId, requestId, otherId, messages) {
  const theirs = (messages || [])
    .filter((m) => m.sender_id === otherId && !m.deleted_at && (m.body || "").trim())
    .slice(-5)
    .map((m) => m.body.trim());
  const { error } = await supabase.from("community_reports").insert({
    reporter_id: myId,
    target_kind: "dm_conversation",
    target_id: requestId,
    target_author_id: otherId,
    target_excerpt: theirs.join(" / ").slice(0, 500) || null,
    reason: "conversation reported from the chat menu",
  });
  if (error) throw new Error(error.message);
}

/* ─── §6 Reactions: one heart, one tap ─────────────────────────── */

export async function fetchLikes(messageIds) {
  if (!messageIds.length) return [];
  const { data, error } = await supabase
    .from("dm_message_likes")
    .select("message_id, profile_id")
    .in("message_id", messageIds);
  if (error) throw new Error(error.message);
  return data || [];
}

/* Tap toggles. Returns the state it left behind so the caller can
   settle its optimistic guess without a refetch. */
export async function toggleLike(messageId, myId, liked) {
  if (liked) {
    const { error } = await supabase
      .from("dm_message_likes")
      .delete()
      .eq("message_id", messageId)
      .eq("profile_id", myId);
    if (error) throw new Error(error.message);
    return false;
  }
  const { error } = await supabase
    .from("dm_message_likes")
    .insert({ message_id: messageId, profile_id: myId });
  if (error && !/duplicate key/i.test(error.message)) throw new Error(error.message);
  return true;
}

/* ─── §4 Requests ──────────────────────────────────────────────── */

/* Friends in common — "the neighbourhood logic already in the app,
   doing visible work" (§4). Computed from my accepted friendships
   against theirs; both sides are readable, so no new RPC is needed. */
export async function friendsInCommon(myId, otherId) {
  const { data } = await supabase
    .from("friend_requests")
    .select("requester_id, recipient_id, status")
    .eq("status", "accepted")
    .or(
      `requester_id.eq.${myId},recipient_id.eq.${myId},requester_id.eq.${otherId},recipient_id.eq.${otherId}`
    );
  const mine = new Set();
  const theirs = new Set();
  for (const r of data || []) {
    if (r.requester_id === myId) mine.add(r.recipient_id);
    else if (r.recipient_id === myId) mine.add(r.requester_id);
    if (r.requester_id === otherId) theirs.add(r.recipient_id);
    else if (r.recipient_id === otherId) theirs.add(r.requester_id);
  }
  let n = 0;
  for (const id of mine) if (theirs.has(id) && id !== myId && id !== otherId) n += 1;
  return n;
}

/* ─── §5 Menu settings ─────────────────────────────────────────── */

/* read_receipts is no longer read here: the switch was removed until the
   thread draws read ticks. The column is left alone. */
/* THROWS ON A FAILED READ. It used to answer the defaults ("met", online
   shown) when the read failed, which is indistinguishable from a person
   who chose them — and the Menu now holds what this returns, so a failure
   would have been remembered as a choice. */
export async function fetchMessageSettings(myId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("who_can_message, show_presence")
    .eq("id", myId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return {
    whoCanMessage: data?.who_can_message || "met",
    showPresence: data?.show_presence !== false,
  };
}

export async function saveMessageSetting(myId, patch) {
  const { error } = await supabase.from("profiles").update(patch).eq("id", myId);
  if (error) throw new Error(error.message);
}

export async function fetchBlockedPeople(myId) {
  const { data } = await supabase
    .from("user_blocks")
    .select("blocked_id, kind, created_at")
    .eq("blocker_id", myId);
  const rows = (data || []).filter((b) => b.kind === "block");
  if (!rows.length) return [];
  const { data: people } = await supabase
    .from("safe_profiles")
    .select("id, full_name, city")
    .in("id", rows.map((r) => r.blocked_id));
  const byId = new Map((people || []).map((p) => [p.id, p]));
  return rows.map((r) => ({ id: r.blocked_id, person: byId.get(r.blocked_id) || null, at: r.created_at }));
}

/* ─── §9 "Not heard from" ──────────────────────────────────────
   People you have talked to before and exchanged nothing with in two
   to three weeks. Derived, never stored, and it NEVER says how long it
   has been or that either person went quiet (§9, PRODUCT_DECISIONS §5:
   the app does not say a named person hasn't done something).
   ─────────────────────────────────────────────────────────────── */
export const DRIFTED_MS = 18 * 24 * 60 * 60 * 1000;

export function driftedFrom(chats, now = Date.now()) {
  return chats
    .filter((c) => c.last && !c.archived && now - new Date(c.at).getTime() > DRIFTED_MS)
    .sort((a, b) => new Date(b.at) - new Date(a.at))
    .slice(0, 8);
}

/* Shown at most once a day, and a dismissal rests it for some days
   (§9). Both live in localStorage: this is a per-person courtesy, not
   a fact about them, and a row that quietly stops appearing is exactly
   the kind of thing that should not survive into the database. */
const SEEN_KEY = "saathban.msg.drifted.seen";
const HUSH_KEY = "saathban.msg.drifted.hushed";
const DAY = 86400000;

export function driftedRowAllowed(now = Date.now()) {
  try {
    const hushed = Number(localStorage.getItem(HUSH_KEY) || 0);
    if (hushed && now - hushed < 5 * DAY) return false;
    const seen = Number(localStorage.getItem(SEEN_KEY) || 0);
    return !seen || now - seen > DAY;
  } catch {
    return true;   // storage off: showing it is the kinder failure
  }
}

/* New chat shows the faces whenever there are some, because a person
   who opened it came to start a conversation — the once-a-day rest was
   for Chats, where nobody asked. A dismissal still rests them. */
export function driftedHushed(now = Date.now()) {
  try {
    const hushed = Number(localStorage.getItem(HUSH_KEY) || 0);
    return !!hushed && now - hushed < 5 * DAY;
  } catch {
    return false;
  }
}

export function markDriftedSeen(now = Date.now()) {
  try { localStorage.setItem(SEEN_KEY, String(now)); } catch { /* fine */ }
}

export function hushDriftedRow(now = Date.now()) {
  try { localStorage.setItem(HUSH_KEY, String(now)); } catch { /* fine */ }
}

/* ════════════════════════════════════════════════
   The unread count behind the Messages tab badge.

   CHATS, NOT MESSAGES, and that is the semantic choice rather than the
   cheap one. A badge answers "how many conversations want me" — which
   is what a person is deciding about when they glance at a tab. Counting
   messages says 47 because one person wrote a lot, which is a number
   about somebody else's evening rather than about the reader's day.

   It is also the number Chats already shows: unread is a boolean per
   thread there (line ~110), so the badge and the list cannot disagree.

   ONE STORE, MANY SUBSCRIBERS. The bar is mounted app-wide and renders
   constantly, so the hook does no work per render: useSyncExternalStore
   hands back a cached integer and only the store ever fetches.

   It refreshes on a slow interval, on focus, and on saath:chats-read —
   which ChatsList and the thread can dispatch when they mark something
   read, so the badge clears at the moment a person reads rather than up
   to a minute later.
   ════════════════════════════════════════════════ */

let unreadCount = 0;
let unreadTimer = null;
const unreadSubs = new Set();

async function readUnreadChats() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 0;
    const { data: reqs } = await supabase
      .from("dm_requests")
      .select("id, requester_id, recipient_id")
      .or(`requester_id.eq.${user.id},recipient_id.eq.${user.id}`)
      .eq("status", "accepted");
    /* A muted person's chat does not raise the tab badge — the badge is
       an alert, and muting is asking not to be alerted. Its dot on Chats
       stays. */
    const { data: muted } = await supabase
      .from("user_blocks").select("blocked_id").eq("blocker_id", user.id).eq("kind", "mute");
    const quiet = new Set((muted || []).map((m) => m.blocked_id));
    const ids = (reqs || [])
      .filter((r) => !quiet.has(r.requester_id === user.id ? r.recipient_id : r.requester_id))
      .map((r) => r.id);
    if (!ids.length) return 0;
    /* Distinct threads, not rows: the count is conversations. */
    const { data: msgs } = await supabase
      .from("dm_messages")
      .select("request_id")
      .in("request_id", ids)
      .neq("sender_id", user.id)
      .is("read_at", null);
    return new Set((msgs || []).map((m) => m.request_id)).size;
  } catch {
    /* A badge is not worth breaking a bar over. Keep the last number. */
    return unreadCount;
  }
}

async function refreshUnread() {
  const next = await readUnreadChats();
  if (next === unreadCount) return;          /* no needless re-render */
  unreadCount = next;
  for (const fn of unreadSubs) fn();
}

export function refreshUnreadChats() { refreshUnread(); }

function subscribeUnread(cb) {
  unreadSubs.add(cb);
  if (unreadSubs.size === 1) {
    refreshUnread();
    unreadTimer = setInterval(refreshUnread, 60_000);
    window.addEventListener("focus", refreshUnread);
    window.addEventListener("saath:chats-read", refreshUnread);
  }
  return () => {
    unreadSubs.delete(cb);
    if (unreadSubs.size === 0) {
      clearInterval(unreadTimer);
      unreadTimer = null;
      window.removeEventListener("focus", refreshUnread);
      window.removeEventListener("saath:chats-read", refreshUnread);
    }
  };
}

export function useUnreadChats() {
  return useSyncExternalStore(subscribeUnread, () => unreadCount, () => 0);
}
