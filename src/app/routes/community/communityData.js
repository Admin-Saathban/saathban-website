/* ════════════════════════════════════════════════
   Community lane — every Supabase call, in one place.

   RLS (migration 0014) is the boundary for all of it: these helpers
   never filter for permission themselves — a row the caller shouldn't
   see simply never arrives, and a write they may not make fails.
   Author names come from safe_profiles (never the full profiles row).
   ════════════════════════════════════════════════ */

import supabase from "../../lib/supabase.js";

const BUCKET = "community-images";

/* ─── Access ─── */

export async function canUseCommunity() {
  const { data, error } = await supabase.rpc("can_use_community");
  if (error) throw error;
  return !!data;
}

export async function canPostCommunity() {
  const { data, error } = await supabase.rpc("can_post_community");
  if (error) throw error;
  return !!data;
}

/* ─── Author display: one safe_profiles fetch per id set ─── */

export async function fetchAuthors(ids) {
  const unique = [...new Set(ids)].filter(Boolean);
  if (unique.length === 0) return {};
  const { data, error } = await supabase
    .from("safe_profiles")
    .select("id, full_name, role, is_org, city, area")
    .in("id", unique);
  if (error) throw error;
  return Object.fromEntries((data || []).map((p) => [p.id, p]));
}

/* ─── Feed ─── */

export async function fetchFeed(limit = 50) {
  const { data, error } = await supabase
    .from("community_posts")
    /* POSTS_SPEC §2-§6 — the columns 0077 added have to be ASKED FOR.
       They were written correctly and simply never selected, so the
       colour, the tag and the whole help strip were invisible while
       the rows underneath them were perfect. A feature can be right in
       the database and absent on the screen, and only the screen
       counts. */
    .select(
      "id, author_id, body, image_path, post_type, ref_id, payload, created_at, " +
        "visibility, style_tag, colour, replies_off, pinned_at, edited_at, " +
        "help_state, help_wanted, help_note, audio_path, audio_seconds"
    )
    .is("hidden_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

/* §7 — NEIGHBOURHOOD FIRST, WIDENING ON ITS OWN.

   The feed shows your area; if there is not enough happening there it
   quietly takes in your city, and then the country, until it has
   something. The person never sees an empty screen and never changes a
   setting — as the app fills up, the radius shrinks again by itself.

   Two things always come through whatever the radius says: posts from
   people in your groups (§7 — 'regardless of where those people live'),
   and Saathban's own posts, which early on will be much of the feed.

   Widening is computed here rather than in SQL because it depends on
   how much came back, which is not a thing a WHERE clause knows.
   ENOUGH is deliberately small, and THREE is the number because the
   question §7 asks is whether the feed has something in it — not whether
   it has a full page. At four, a person with one neighbour's post and two
   from across their city was shown the whole country, which is exactly the
   over-widening the rule exists to avoid: they had a neighbourhood, and we
   went national anyway. (Found by a unit test whose expectation disagreed
   with the constant; the constant was the arbitrary half.) */
export const ENOUGH = 3;

export function widenFeed(posts, authors, me, alwaysIds = new Set()) {
  const norm = (v) => (v || "").trim().toLowerCase();
  const myArea = norm(me?.area);
  const myCity = norm(me?.city);

  const bandOf = (p) => {
    const a = authors[p.author_id];
    if (!a) return "far";
    if (a.is_org) return "always";
    if (alwaysIds.has(p.author_id)) return "always";
    if (myArea && norm(a.area) === myArea) return "area";
    if (myCity && norm(a.city) === myCity) return "city";
    return "far";
  };

  const tagged = posts.map((p) => ({ ...p, band: bandOf(p) }));
  const always = tagged.filter((p) => p.band === "always");
  const area = tagged.filter((p) => p.band === "area");
  const city = tagged.filter((p) => p.band === "city");
  const far = tagged.filter((p) => p.band === "far");

  let shown = [...always, ...area];
  let radius = "area";
  if (shown.length < ENOUGH) { shown = [...shown, ...city]; radius = "city"; }
  if (shown.length < ENOUGH) { shown = [...shown, ...far]; radius = "country"; }

  // newest first, whatever band each came from
  shown.sort((x, y) => new Date(y.created_at) - new Date(x.created_at));
  return { posts: shown, radius };
}

/* Everyone who shares a group with me — their posts ignore the radius. */
export async function fetchGroupNeighbourIds(userId) {
  const { data: mine } = await supabase
    .from("group_members").select("group_id").eq("member_id", userId);
  const ids = (mine || []).map((r) => r.group_id);
  if (!ids.length) return new Set();
  const { data: others } = await supabase
    .from("group_members").select("member_id").in("group_id", ids);
  return new Set((others || []).map((r) => r.member_id));
}

export function imageUrl(path) {
  if (!path) return null;
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

/* ONE way to make a post, extended rather than forked (POSTS_SPEC
   §1-§6). A second create function would be a second set of defaults
   for visibility, and visibility is the thing that must never differ
   between two doors into the same act.

   Returns the new row, because §11 lands you ON the post and the
   caller needs its id to highlight it. */
export async function createPost(userId, body, file, opts = {}) {
  const {
    visibility = "public",
    colour = null,
    styleTag = null,
    helpWanted = 1,
    tagged = [],
    audio = null,          // { blob, seconds, mime } — POSTS_SPEC §7
  } = opts;

  let image_path = null;
  if (file) {
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    image_path = `${userId}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(image_path, file, { contentType: file.type });
    if (upErr) throw upErr;
  }

  /* §7 — a voice post. One minute, capped in the recorder and again
     by the bucket's size limit (0078). It goes under the author's own
     folder because the post row does not exist yet at upload time,
     and the read policy lets an author read their own recording for
     exactly that gap. */
  let audio_path = null;
  let audio_seconds = null;
  if (audio?.blob) {
    const aext = audio.mime && audio.mime.includes("mp4") ? "m4a" : audio.mime && audio.mime.includes("ogg") ? "ogg" : "webm";
    audio_path = `${userId}/${crypto.randomUUID()}.${aext}`;
    const { error: aErr } = await supabase.storage
      .from("post-audio")
      .upload(audio_path, audio.blob, { contentType: audio.mime || "audio/webm" });
    if (aErr) throw aErr;
    audio_seconds = Math.max(1, Math.min(60, Math.round(audio.seconds || 0)));
  }

  /* §3 — colour applies to SHORT TEXT ONLY. Once a post runs long or
     carries a photo it renders plain, so a long post never becomes
     unreadable on yellow. Enforced HERE as well as in the renderer:
     a colour that survives into the row would come back coloured on
     every future read, whatever the renderer then believed. */
  const text = (body || "").trim();
  /* A voice post may carry no words at all, which is the point of it.
     Colour still needs short text to sit on. */
  const keepsColour = colour != null && !image_path && !audio_path && text.length <= 180;

  /* If the insert is refused, the recording that was already uploaded
     must not be left behind. Audio goes up BEFORE the row exists (the
     row needs its path), so every refusal used to leak a file into
     post-audio — storage growing while nothing appeared on screen. */
  const { data, error } = await supabase
    .from("community_posts")
    .insert({
      author_id: userId,
      body: text,
      image_path,
      audio_path,
      audio_seconds,
      visibility,
      colour: keepsColour ? colour : null,
      style_tag: styleTag,
      /* A help post starts in "asked"; anything else has no state at
         all rather than a state that means nothing. */
      help_state: styleTag === "help" ? "asked" : null,
      help_wanted: styleTag === "help" ? Math.max(1, Math.min(20, helpWanted)) : 1,
    })
    .select("id")
    .single();
  if (error) {
    /* AWAIT, THEN THROW — and the order is load-bearing, not incidental.

       A refused insert has already uploaded its recording, so without this
       every refusal leaves an orphan file nobody can reach and nobody is
       billed to notice. It is deleted first, and only then does the throw
       leave: the throw is what PostComposer catches to dispatch
       saath:post-failed, which is what withdraws the optimistic row from
       the feed. So the file is gone BEFORE the row the person can see
       disappears.

       If this remove is ever moved into a finally, or stops being awaited,
       that ordering inverts — the row vanishes while the upload is still
       being deleted, and a failure in between strands the file with no
       error path left to catch it. The navigation lane raised exactly this
       hazard about their event; it is written here because the cleanup is
       this file's, not theirs. */
    if (audio_path) {
      await supabase.storage.from("post-audio").remove([audio_path]).catch(() => {});
    }
    throw error;
  }

  /* §5 — the tagged person is asked, never assumed. accepted stays
     false until they say so, and an event only appears under both
     names after they accept. */
  /* A REFUSED TAG MUST NOT LOSE THE POST — but it must not be silent
     either. This swallowed its error with `.then(()=>{}, ()=>{})`, and
     that is how a policy bug hid: 0077's insert check read profiles
     directly, RLS refused every tag of anybody but yourself, and the
     post appeared anyway so nothing looked wrong (fixed in 0100).

     Now the post is kept and the failure is RETURNED, so the caller can
     say the names did not go on rather than pretending they did. */
  let tagsFailed = false;
  if (tagged.length) {
    const { error: tagErr } = await supabase
      .from("post_tags")
      .insert(tagged.map((pid) => ({ post_id: data.id, person_id: pid })));
    tagsFailed = !!tagErr;
  }
  return { ...data, tagsFailed };
}

export async function deleteOwnPost(postId) {
  const { error } = await supabase.from("community_posts").delete().eq("id", postId);
  if (error) throw error;
}

/* ─── Reactions: one per person per post ─── */

export async function fetchReactions(postIds) {
  if (postIds.length === 0) return [];
  const { data, error } = await supabase
    .from("post_reactions")
    .select("post_id, profile_id, emoji")
    .in("post_id", postIds);
  if (error) throw error;
  return data || [];
}

export async function setReaction(postId, userId, emoji) {
  const { error } = await supabase
    .from("post_reactions")
    .upsert(
      { post_id: postId, profile_id: userId, emoji },
      { onConflict: "post_id,profile_id" }
    );
  if (error) throw error;
}

export async function clearReaction(postId, userId) {
  const { error } = await supabase
    .from("post_reactions")
    .delete()
    .eq("post_id", postId)
    .eq("profile_id", userId);
  if (error) throw error;
}

/* ─── Comments ─── */

export async function fetchComments(postId) {
  const { data, error } = await supabase
    .from("post_comments")
    .select("id, author_id, body, created_at")
    .eq("post_id", postId)
    .is("hidden_at", null)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function addComment(postId, userId, body) {
  const { error } = await supabase
    .from("post_comments")
    .insert({ post_id: postId, author_id: userId, body: body.trim() });
  if (error) throw error;
}

/* ─── Report / block / mute ─── */

/* A report, with whatever the moderator will need in order to judge it.

    is {bucket, path, kind}. For a voice POST that is post-audio,
   which admins may read. For a DM it must be report-evidence — a COPY,
   because admins have no read path into DM threads and this is not the
   thing that is going to quietly create one (QUESTIONS.md C5). Use
   copyToEvidence() to make that copy before calling. */
export async function fileReport(userId, kind, targetId, targetAuthorId, excerpt, reason, media = null) {
  const { error } = await supabase.from("community_reports").insert({
    reporter_id: userId,
    target_kind: kind,
    target_id: targetId,
    target_author_id: targetAuthorId,
    target_excerpt: (excerpt || "").slice(0, 500) || null,
    reason: (reason || "").slice(0, 500) || null,
    target_media_bucket: media?.bucket || null,
    target_media_path: media?.path || null,
    target_media_kind: media?.kind || null,
  });
  if (error) throw error;
}

/* Hand a copy of the reported file to the moderators, and only to them.
   The reporter can read the original (it is in their own thread); the
   moderator cannot, so the reporter is the one who has to pass it over.
   A failure here must NOT lose the report — the caller reports anyway,
   with the text it has, rather than refusing to accept a complaint
   because an upload failed. */
export async function copyToEvidence(fromBucket, path) {
  try {
    const { data: blob, error } = await supabase.storage.from(fromBucket).download(path);
    if (error || !blob) return null;
    const ext = (path.split(".").pop() || "webm").toLowerCase();
    const to = `${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("report-evidence")
      .upload(to, blob, { contentType: blob.type || "audio/webm", upsert: false });
    if (upErr) return null;
    return to;
  } catch {
    return null;
  }
}

export async function blockOrMute(userId, targetId, kind) {
  const { error } = await supabase
    .from("user_blocks")
    .upsert(
      { blocker_id: userId, blocked_id: targetId, kind },
      { onConflict: "blocker_id,blocked_id,kind", ignoreDuplicates: true }
    );
  if (error) throw error;
}

export async function unblock(userId, targetId, kind) {
  const { error } = await supabase
    .from("user_blocks")
    .delete()
    .eq("blocker_id", userId)
    .eq("blocked_id", targetId)
    .eq("kind", kind);
  if (error) throw error;
}

/* ─── Shares (migration 0018) ───
   A share is a post with a type and a payload SNAPSHOT taken at share
   time — the card renders from the snapshot (localized at view time),
   so it stays visible even when the referenced row isn't. */

export async function createShare(userId, type, refId, payload, body = "") {
  const { data, error } = await supabase
    .from("community_posts")
    .insert({
      author_id: userId,
      body,
      post_type: type,
      ref_id: refId,
      payload,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function fetchPlacesLite() {
  const { data, error } = await supabase
    .from("outdoor_places")
    .select("id, name, city")
    .order("city")
    .order("name");
  if (error) throw error;
  return data || [];
}

/* "Who's up for a walk?": one action creates BOTH the planned outing
   (announced to the park board — a walk you're inviting neighbours to
   is public by intent) and the community post that points at it. */
export async function shareWalk(userId, place, startsAtIso, note) {
  const { data, error } = await supabase
    .from("outdoor_outings")
    .insert({
      place_id: place.id,
      creator_id: userId,
      starts_at: startsAtIso,
      note: (note || "").trim() || null,
      visibility: "board",
    })
    .select("id")
    .single();
  if (error) throw error;
  await createShare(userId, "walk", data.id, {
    place_id: place.id,
    place_name: place.name,
    starts_at: startsAtIso,
    note: (note || "").trim() || null,
  });
}

/* Join = the viewer's OWN outing row for the same place and time,
   through the ordinary 0016 policies (Icons only — RLS refuses the
   rest, so the button is only shown to Icons). Kept for old 'walk'
   posts; new activity posts join via join_activity below. */
export async function joinWalk(userId, post) {
  const { error } = await supabase.from("outdoor_outings").insert({
    place_id: post.payload.place_id,
    creator_id: userId,
    starts_at: post.payload.starts_at,
    visibility: "board",
  });
  if (error) throw error;
}

/* ─── "Who's up for…?" activities (migrations 0027/0028) ───
   Free-text activity; place, time, people limit, and the RSVP choice
   all optional and frozen into the payload snapshot at creation.
   The place is FREE TEXT — placeId is set only when the host tapped a
   known outdoor place from the suggestions, and only then (plus a
   time) does the host's outing also land on the park board (the 0016
   behaviour walks always had). After posting, announce_activity()
   tells the author's connections (best-effort — the post stands
   either way). */

export async function shareActivity(
  userId,
  { activity, placeText, placeId, startsAtIso, note, limit, rsvp }
) {
  let refId = null;
  if (placeId && startsAtIso) {
    const { data, error } = await supabase
      .from("outdoor_outings")
      .insert({
        place_id: placeId,
        creator_id: userId,
        starts_at: startsAtIso,
        note: (note || "").trim() || null,
        visibility: "board",
      })
      .select("id")
      .single();
    if (!error) refId = data.id;
  }
  const postId = await createShare(userId, "activity", refId, {
    activity: activity.trim(),
    place_id: placeId || null,
    place_name: (placeText || "").trim() || null,
    starts_at: startsAtIso || null,
    note: (note || "").trim() || null,
    limit: limit || null,
    rsvp: !!rsvp,
  });
  try {
    await supabase.rpc("announce_activity", { p_post: postId });
  } catch {
    /* best-effort — the post stands even if the announcement fails */
  }
  return postId;
}

/* Server-enforced join: idempotent, limit-aware, closes gracefully.
   Returns {joined, count, full}. */
export async function joinActivity(postId) {
  const { data, error } = await supabase.rpc("join_activity", { p_post: postId });
  if (error) throw error;
  return data;
}

/* Join rows for a set of posts → { postId: {count, mine} }. */
export async function fetchJoins(postIds, userId) {
  if (postIds.length === 0) return {};
  const { data, error } = await supabase
    .from("post_joins")
    .select("post_id, profile_id")
    .in("post_id", postIds);
  if (error) throw error;
  const out = {};
  for (const r of data || []) {
    out[r.post_id] = out[r.post_id] || { count: 0, mine: false };
    out[r.post_id].count++;
    if (r.profile_id === userId) out[r.post_id].mine = true;
  }
  return out;
}

/* ─── Friend connections (migration 0027) ─── */

export async function searchIcons(q) {
  const term = q.trim();
  if (!term) return [];
  const { data, error } = await supabase
    .from("safe_profiles")
    .select("id, full_name, city, role")
    .eq("role", "saath_icon")
    .or(`full_name.ilike.%${term}%,city.ilike.%${term}%`)
    .limit(12);
  if (error) throw error;
  return data || [];
}

export async function sendFriendRequest(recipientId) {
  const { data, error } = await supabase.rpc("send_friend_request", {
    p_recipient: recipientId,
  });
  if (error) throw error;
  return data;
}

export async function respondFriendRequest(requestId, accept) {
  const { error } = await supabase.rpc("respond_friend_request", {
    p_request: requestId,
    p_accept: accept,
  });
  if (error) throw error;
}

export async function fetchFriendOverview(userId) {
  const { data, error } = await supabase
    .from("friend_requests")
    .select("id, requester_id, recipient_id, status, created_at")
    .or(`requester_id.eq.${userId},recipient_id.eq.${userId}`)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = data || [];
  return {
    incoming: rows.filter((r) => r.recipient_id === userId && r.status === "pending"),
    outgoing: rows.filter((r) => r.requester_id === userId && r.status === "pending"),
    friends: rows.filter((r) => r.status === "accepted"),
  };
}

/* The ids the caller has blocked (kind 'block') — the connect search
   filters these out client-side; the RPC is block-silent anyway. */
export async function fetchMyBlockedIds(userId) {
  const { data, error } = await supabase
    .from("user_blocks")
    .select("blocked_id")
    .eq("blocker_id", userId)
    .eq("kind", "block");
  if (error) throw error;
  return new Set((data || []).map((r) => r.blocked_id));
}

/* The viewer's connections, both directions — the Friends tab filter.
   Since 0027 this is circle membership PLUS accepted friendships
   (mirroring game_connected() on the server). RLS scopes both tables
   to rows the caller is part of. */
export async function fetchConnections(userId) {
  const [{ data: circle, error: e1 }, { data: friends, error: e2 }] = await Promise.all([
    supabase
      .from("circle_members")
      .select("icon_id, member_id")
      .or(`icon_id.eq.${userId},member_id.eq.${userId}`),
    supabase
      .from("friend_requests")
      .select("requester_id, recipient_id")
      .eq("status", "accepted")
      .or(`requester_id.eq.${userId},recipient_id.eq.${userId}`),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;
  return new Set([
    ...(circle || []).map((r) => (r.icon_id === userId ? r.member_id : r.icon_id)),
    ...(friends || []).map((r) => (r.requester_id === userId ? r.recipient_id : r.requester_id)),
  ]);
}

/* ─── DMs ─── */

export async function sendDmRequest(recipientId) {
  const { data, error } = await supabase.rpc("send_dm_request", {
    p_recipient: recipientId,
  });
  if (error) throw error;
  return data;
}

export async function fetchDmOverview(userId) {
  const { data, error } = await supabase
    .from("dm_requests")
    .select("id, requester_id, recipient_id, status, created_at")
    .or(`requester_id.eq.${userId},recipient_id.eq.${userId}`)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = data || [];
  return {
    incoming: rows.filter((r) => r.recipient_id === userId && r.status === "pending"),
    outgoing: rows.filter((r) => r.requester_id === userId && r.status === "pending"),
    threads: rows.filter((r) => r.status === "accepted"),
  };
}

/* One row per accepted thread, ordered by the LAST MESSAGE rather than
   by when the request was made (§6: newest first). A thread nobody has
   written in since it opened sorts by the request itself, so a brand new
   acceptance still appears at the top rather than vanishing to the
   bottom of the list.

   Deleted messages still count for ordering: a thread whose last message
   was withdrawn has still had activity, and dropping it down the list
   would quietly tell the other person something about what you deleted. */
export async function fetchThreadSummaries(userId) {
  const { threads } = await fetchDmOverview(userId);
  if (!threads.length) return [];
  const ids = threads.map((t) => t.id);
  const { data, error } = await supabase
    .from("dm_messages")
    .select("request_id, sender_id, body, image_path, game_session_id, deleted_at, created_at, read_at")
    .in("request_id", ids)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const last = new Map();
  const unread = new Map();
  for (const m of data || []) {
    if (!last.has(m.request_id)) last.set(m.request_id, m);
    // unread = written by the OTHER person and not yet read
    if (m.sender_id !== userId && !m.read_at) {
      unread.set(m.request_id, (unread.get(m.request_id) || 0) + 1);
    }
  }
  return threads
    .map((t) => ({
      requestId: t.id,
      otherId: t.requester_id === userId ? t.recipient_id : t.requester_id,
      last: last.get(t.id) || null,
      unread: unread.get(t.id) || 0,
      at: last.get(t.id)?.created_at || t.created_at,
    }))
    .sort((a2, b2) => new Date(b2.at) - new Date(a2.at));
}

/* ─── §6 message requests: everything the guarded screen needs, in one
   round of queries. The first message is read from the REQUEST, not
   from dm_messages — 0073 keeps the thread shut until acceptance, so
   there is exactly one message and exactly one place it can be.

   how_we_met and profile_is_complete are definer functions: the
   stranger's groups, events and board posts are not readable to the
   recipient, and asking the database the narrow question is the only
   lawful way to answer §6's "how they found you". ─── */
export async function fetchMessageRequests(userId) {
  const { data, error } = await supabase
    .from("dm_requests")
    .select("id, requester_id, first_message, created_at")
    .eq("recipient_id", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = data || [];
  if (!rows.length) return [];

  const ids = [...new Set(rows.map((r) => r.requester_id))];
  const { data: people } = await supabase
    .from("safe_profiles")
    .select("id, full_name, city")
    .in("id", ids);
  const byId = new Map((people || []).map((p) => [p.id, p]));

  return Promise.all(
    rows.map(async (r) => {
      const [met, complete] = await Promise.all([
        supabase.rpc("how_we_met", { p_other: r.requester_id })
          .then(({ data: d }) => d || [])
          .catch(() => []),
        supabase.rpc("profile_is_complete", { p: r.requester_id })
          .then(({ data: d }) => d !== false)
          .catch(() => true),
      ]);
      const p = byId.get(r.requester_id) || {};
      return {
        id: r.id,
        senderId: r.requester_id,
        name: p.full_name || "",
        city: p.city || "",
        firstMessage: r.first_message || "",
        met,
        senderProfileComplete: complete,
        at: r.created_at,
      };
    })
  );
}

/* Accept or decline. Both go through the RPC so that acceptance moves
   the first message into the thread — a bare UPDATE would open a room
   and leave the sentence that opened it behind (0073). */
export async function decideDmRequest(requestId, accept) {
  const { data, error } = await supabase.rpc("decide_dm_request", {
    p_request: requestId,
    p_accept: accept,
  });
  if (error) throw new Error(error.message);
  return data;
}

/* The requester's one shot. The server refuses a second (0073). */
export async function setDmFirstMessage(requestId, body) {
  const { error } = await supabase.rpc("set_dm_first_message", {
    p_request: requestId,
    p_body: body,
  });
  if (error) throw new Error(error.message);
}
export async function respondToRequest(requestId, status) {
  const { error } = await supabase
    .from("dm_requests")
    .update({ status })
    .eq("id", requestId);
  if (error) throw error;
}

export async function fetchThread(requestId) {
  const [{ data: req, error: reqErr }, { data: msgs, error: msgErr }] = await Promise.all([
    supabase
      .from("dm_requests")
      .select("id, requester_id, recipient_id, status")
      .eq("id", requestId)
      .maybeSingle(),
    supabase
      .from("dm_messages")
      .select("id, sender_id, body, game_session_id, created_at, read_at")
      .eq("request_id", requestId)
      .order("created_at", { ascending: true }),
  ]);
  if (reqErr) throw reqErr;
  if (msgErr) throw msgErr;
  return { request: req, messages: msgs || [] };
}

/* A message is words, a game, or both (0027). Attaching a game the
   sender isn't part of is refused by the insert policy. */
export async function sendMessage(requestId, userId, body, gameSessionId = null) {
  const { error } = await supabase.from("dm_messages").insert({
    request_id: requestId,
    sender_id: userId,
    body: (body || "").trim() || null,
    game_session_id: gameSessionId,
  });
  if (error) throw error;
}

/* Thread ids holding messages I haven't read — powers the inbox's
   "new" badges. RLS already scopes dm_messages to my threads. */
export async function fetchUnreadThreadIds(userId) {
  const { data, error } = await supabase
    .from("dm_messages")
    .select("request_id")
    .is("read_at", null)
    .neq("sender_id", userId);
  if (error) return new Set();
  return new Set((data || []).map((r) => r.request_id));
}

export async function markThreadRead(requestId, userId) {
  // Best-effort; unread state is a nicety, not a guarantee.
  await supabase
    .from("dm_messages")
    .update({ read_at: new Date().toISOString() })
    .eq("request_id", requestId)
    .neq("sender_id", userId)
    .is("read_at", null);
}
