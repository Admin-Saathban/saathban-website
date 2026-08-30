/* ════════════════════════════════════════════════
   A profile photo — TONIGHT.md LANE 2 §6, PRODUCT_DECISIONS §8.

   §8 calls the photo "the biggest factor in whether someone connects",
   and until tonight there was no way to add one at all.

   STORED PRIVATELY (0085). The obvious place was community-images,
   which is already public — and that is exactly why it is the wrong
   one: a face is not a post. The bucket is private, reads are granted
   to signed-in members, and writes are scoped at the database to a
   folder named after the owner's own uuid, so a crafted request cannot
   put a photo on somebody else's profile.

   THE COST OF PRIVATE IS SIGNED URLS, and they expire. So the URL is
   cached per path for slightly less than its lifetime: an avatar is
   rendered many times per screen and re-signing on every render would
   turn a face into a network request. The cache is per page load and
   holds no photo — only a string that stops working on its own.

   `avatar_url` on profiles stores the PATH, never the signed URL. A
   signed URL in a database column is a credential with an expiry date
   sitting in a row that outlives it.
   ════════════════════════════════════════════════ */

import supabase from "../../lib/supabase.js";

export const AVATAR_BUCKET = "avatars";
const SIGNED_FOR = 60 * 60; // an hour
const CACHE_MS = 55 * 60 * 1000; // re-sign before it lapses, not after

const cache = new Map(); // path -> { url, at }

/* Accepts what a phone's camera or gallery gives, and nothing that
   would be a surprise on somebody else's screen. */
export const ACCEPTED = "image/png,image/jpeg,image/webp,image/heic,image/heif";
export const MAX_BYTES = 8 * 1024 * 1024;

export async function signedAvatarUrl(path) {
  if (!path) return null;
  /* Older rows may already hold a full url from before this existed —
     leave them alone rather than trying to sign an http string. */
  if (/^https?:\/\//i.test(path)) return path;

  const hit = cache.get(path);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.url;

  const { data, error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .createSignedUrl(path, SIGNED_FOR);
  if (error || !data?.signedUrl) return null;

  cache.set(path, { url: data.signedUrl, at: Date.now() });
  return data.signedUrl;
}

/* Upload and point the profile at it. Returns the stored PATH.

   The filename is a fresh uuid every time rather than a fixed
   "avatar.jpg": overwriting one path means every cached and signed URL
   in every open tab keeps showing the old face until it expires.
   A new path is instantly correct everywhere. */
export async function uploadAvatar(profileId, file) {
  if (!file) throw new Error("no file");
  if (file.size > MAX_BYTES) throw new Error("too large");

  const ext = (file.name?.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${profileId}/${crypto.randomUUID()}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, file, { contentType: file.type || "image/jpeg", upsert: false });
  if (upErr) throw upErr;

  const { error: rowErr } = await supabase
    .from("profiles")
    .update({ avatar_url: path })
    .eq("id", profileId);
  if (rowErr) throw rowErr;

  return path;
}
