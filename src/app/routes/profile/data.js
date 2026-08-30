/* ════════════════════════════════════════════════
   Profile — data layer (migration 0002, public.profiles).

   Only the person's own safe fields are read and written here. The
   "update own profile" RLS policy scopes writes to id = auth.uid(),
   and the protected-columns trigger blocks role / tier / admin flags
   at the database — so even a crafted request can only change what is
   listed below.

   PRODUCT_DECISIONS §8 added interests, about and about_prompt (0082).
   Languages and interests are arrays of stable IDS, not free text: a
   text box turns "Punjabi" into "punjabi", "Panjabi" and "پنجابی", and
   then nothing can match on it — which defeats the one field §8 calls
   the highest-value in the app.

   NOT HERE, AND NOT BY ACCIDENT: date_of_birth is never read or
   written by this screen. §2 asks for it once, warmly, at signup; a
   profile form that offers it back turns a celebration into a field.
   ════════════════════════════════════════════════ */

import supabase from "../../lib/supabase.js";

export async function fetchMyProfile(id) {
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, role, full_name, city, area, country, languages, interests, about, about_prompt, avatar_url, preferred_language, settings"
    )
    .eq("id", id)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

/* What a stranger sees of somebody else — safe_profiles, never
   profiles. §8 says the stranger view matters most and is least
   designed, so it gets a named function rather than being assembled
   ad hoc at each call site. */
export async function fetchPublicProfile(id) {
  const { data, error } = await supabase
    .from("safe_profiles")
    .select("id, role, full_name, avatar_url, city, area, languages, interests, about, about_prompt, is_org")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateMyProfile(id, fields) {
  const patch = {};
  if (fields.full_name != null) patch.full_name = fields.full_name.trim();
  if (fields.city != null) patch.city = fields.city.trim() || null;
  if (fields.area != null) patch.area = fields.area.trim() || null;
  if (fields.languages) patch.languages = fields.languages;
  if (fields.interests) patch.interests = fields.interests;
  if ("about" in fields) patch.about = fields.about;
  if ("about_prompt" in fields) patch.about_prompt = fields.about_prompt;

  const { error } = await supabase.from("profiles").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

/* The soft dot's dismissal (§8). It lives in settings rather than a
   column because it is a UI nicety, not a fact about a person — and
   because §8 wants the dot back in a week rather than gone for ever,
   so what is stored is a timestamp, never a boolean. */
export async function dismissProfileNudge(id, settings) {
  const { error } = await supabase
    .from("profiles")
    .update({ settings: { ...(settings || {}), profile_nudge_dismissed_at: new Date().toISOString() } })
    .eq("id", id);
  if (error) throw new Error(error.message);
}
