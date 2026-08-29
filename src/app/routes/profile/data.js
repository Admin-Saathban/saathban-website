/* ════════════════════════════════════════════════
   Profile — data layer (migration 0002, public.profiles).

   Only the person's own safe fields are read and written here. The
   "update own profile" RLS policy scopes writes to id = auth.uid(),
   and the protected-columns trigger blocks role / tier / admin flags
   at the database — so even a crafted request can only change name,
   city, and languages. This layer sends exactly those three.
   ════════════════════════════════════════════════ */

import supabase from "../../lib/supabase.js";

export async function fetchMyProfile(id) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, role, full_name, city, country, languages, preferred_language")
    .eq("id", id)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

/* Persist the editable safe fields. languages arrives as an array of
   trimmed, non-empty strings. */
export async function updateMyProfile(id, { full_name, city, languages }) {
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: full_name.trim(),
      city: city.trim() || null,
      languages,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export function parseLanguages(text) {
  return [...new Set(text.split(",").map((s) => s.trim()).filter(Boolean))];
}
