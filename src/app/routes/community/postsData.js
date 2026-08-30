/* ════════════════════════════════════════════════
   Everything a post can be asked to do after it exists —
   POSTS_SPEC.md §5, §6, §10.

   Creating one lives in communityData.createPost, deliberately: two
   create functions would mean two sets of defaults for visibility,
   and visibility is the thing that must never differ between two
   doors into the same act.
   ════════════════════════════════════════════════ */

import supabase from "../../lib/supabase.js";

/* §3 — six warm swatches. Index into this, never a stored hex: the
   palette has changed once already and a #FFF3D6 in the database
   would pin tonight's yellow into every post for ever. */
export const SWATCHES = ["#FBF0DC", "#F3E7DF", "#E9F0E2", "#E4EDF2", "#F5E4E8", "#EFEAF6"];

export const STYLE_TAGS = ["milestone", "good", "memory", "help"];
export const VISIBILITIES = ["public", "friends", "private"];

/* Colour applies to short text only (§3), and the renderer has to
   agree with the writer — createPost drops the colour on the way in,
   this drops it on the way out, and a row that slipped through from
   anywhere else still renders plain. */
export function colourOf(post) {
  if (post.colour == null) return null;
  if (post.image_path) return null;
  if (post.audio_path) return null;   // §7 — a voice post is a card, not a swatch
  if ((post.body || "").length > 180) return null;
  return SWATCHES[post.colour] ?? null;
}

/* ─── §10 the menus' verbs ─── */

/* §7 — post-audio is private, so a voice post needs a short-lived
   signed URL. Cached per path for under its lifetime: a feed that
   re-signs on every render would spend a request per scroll. */
const audioUrls = new Map();
export async function postAudioUrl(path) {
  if (!path) return null;
  const hit = audioUrls.get(path);
  if (hit && hit.exp > Date.now()) return hit.url;
  const { data, error } = await supabase.storage.from("post-audio").createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) return null;
  audioUrls.set(path, { url: data.signedUrl, exp: Date.now() + 50 * 60 * 1000 });
  return data.signedUrl;
}

export async function updatePost(postId, patch) {
  const { error } = await supabase.from("community_posts").update(patch).eq("id", postId);
  if (error) throw new Error(error.message);
}

export const setVisibility = (postId, visibility) => updatePost(postId, { visibility });
export const setRepliesOff = (postId, off) => updatePost(postId, { replies_off: off });
export const setPinned = (postId, on) => updatePost(postId, { pinned_at: on ? new Date().toISOString() : null });
export const editBody = (postId, body) =>
  updatePost(postId, { body: body.trim(), edited_at: new Date().toISOString() });

export async function toggleSave(postId, myId, saved) {
  if (saved) {
    const { error } = await supabase.from("post_saves").delete().eq("post_id", postId).eq("profile_id", myId);
    if (error) throw new Error(error.message);
    return false;
  }
  const { error } = await supabase.from("post_saves").insert({ post_id: postId, profile_id: myId });
  if (error && !/duplicate key/i.test(error.message)) throw new Error(error.message);
  return true;
}

export async function toggleFollow(postId, myId, following) {
  if (following) {
    const { error } = await supabase.from("post_follows").delete().eq("post_id", postId).eq("profile_id", myId);
    if (error) throw new Error(error.message);
    return false;
  }
  const { error } = await supabase.from("post_follows").insert({ post_id: postId, profile_id: myId });
  if (error && !/duplicate key/i.test(error.message)) throw new Error(error.message);
  return true;
}

/* §10.2 "Show less from {name}" — a mute, and the sub-line says "He
   won't know", which is true: user_blocks with kind 'mute' hides
   their rows from MY feed and tells them nothing. Reversible from
   Settings, which is what makes it safe to offer. */
export async function showLessFrom(myId, authorId) {
  const { error } = await supabase
    .from("user_blocks")
    .insert({ blocker_id: myId, blocked_id: authorId, kind: "mute" });
  if (error && !/duplicate key/i.test(error.message)) throw new Error(error.message);
}

/* A link to the post. §6.5: for a HELP post this link shows the text
   and nothing else — no profile, no location, no way to reach the
   person except through the app. The link carries somebody's
   difficulty; it must not carry their address. */
export function postLink(postId) {
  const origin = typeof window !== "undefined" && window.location ? window.location.origin : "";
  return `${origin}/app/community?post=${postId}`;
}

export async function copyLink(postId) {
  try {
    await navigator.clipboard.writeText(postLink(postId));
    return true;
  } catch {
    return false;
  }
}

/* §5 — the tagged person can take their own name off. 0077's policy
   lets either of them do it; this is the tagged person's door, and
   it is deliberately silent: somebody removing their name from a
   post does not owe the author a notification about it. */
export async function removeTag(postId, personId) {
  const { error } = await supabase.from("post_tags").delete()
    .eq("post_id", postId).eq("person_id", personId);
  if (error) throw new Error(error.message);
}

/* ─── §6 Help posts ─── */

export async function fetchHelpExtras(postIds) {
  if (!postIds.length) return { offers: [], saves: [], follows: [], tags: [] };
  const [{ data: offers }, { data: saves }, { data: follows }, { data: tags }] = await Promise.all([
    supabase.from("post_help_offers").select("post_id, helper_id, created_at, note").in("post_id", postIds),
    supabase.from("post_saves").select("post_id, profile_id").in("post_id", postIds),
    supabase.from("post_follows").select("post_id, profile_id").in("post_id", postIds),
    supabase.from("post_tags").select("post_id, person_id, accepted").in("post_id", postIds),
  ]);
  return { offers: offers || [], saves: saves || [], follows: follows || [], tags: tags || [] };
}

export async function offerHelp(postId, myId) {
  const { error } = await supabase
    .from("post_help_offers")
    .insert({ post_id: postId, helper_id: myId });
  if (error && !/duplicate key/i.test(error.message)) throw new Error(error.message);
}

export async function withdrawOffer(postId, myId) {
  const { error } = await supabase
    .from("post_help_offers")
    .delete()
    .eq("post_id", postId)
    .eq("helper_id", myId);
  if (error) throw new Error(error.message);
}

/* §6.3 — closing without a named helper. Off-app helpers cannot be
   credited (no strangers enter the system), but Fatima's nephew will
   often be the one who does it. Without this she either credits a
   member who did nothing or leaves it open and keeps being offered
   help she no longer needs. */
export const closeHelp = (postId, note) =>
  updatePost(postId, { help_state: "closed", help_note: (note || "").trim() || null });

export const markHelpDone = (postId) => updatePost(postId, { help_state: "done" });

/* §6.1 — "Someone's coming" is DERIVED from the offers, never stored,
   so it can never disagree with who has actually offered. */
export function helpStatusOf(post, offers) {
  const state = post.help_state || "asked";
  const mine = offers.filter((o) => o.post_id === post.id);
  if (state === "done" || state === "closed") return { state, helpers: mine };
  return { state: mine.length > 0 ? "coming" : "asked", helpers: mine };
}
