/* ════════════════════════════════════════════════
   Seeing other people — the three ways that are not a relationship
   (0123). safe_profiles now only returns people you are related to
   (0124): circle, groups, conversations, friends, tables, requests.

   · fetchProfileCards(ids) — name, photo, city, role for people who
     appear in something you can already see (a post, a board message, a
     check-in, a seat at a table). By id only; it cannot list anyone, and
     it never carries presence or "about".
   · searchPeopleByName(q) — an explicit search: three letters or more,
     matched to the start of a word in the name.
   · fetchPublicProfileRow(id) — the stranger view of one person.
   ════════════════════════════════════════════════ */

import supabase from "./supabase.js";

export async function fetchProfileCards(ids) {
  const unique = [...new Set(ids || [])].filter(Boolean);
  if (!unique.length) return [];
  const out = [];
  for (let i = 0; i < unique.length; i += 200) {
    const { data, error } = await supabase.rpc("profile_cards", { p_ids: unique.slice(i, i + 200) });
    if (error) throw error;
    out.push(...(data || []));
  }
  return out;
}

export async function searchPeopleByName(q, { role = null, limit = 12 } = {}) {
  const term = (q || "").trim();
  if (term.length < 3) return [];
  const { data, error } = await supabase.rpc("search_people", { p_term: term, p_role: role, p_limit: limit });
  if (error) throw error;
  return data || [];
}

export async function fetchPublicProfileRow(id) {
  if (!id) return null;
  const { data, error } = await supabase.rpc("public_profile", { p_id: id });
  if (error) throw new Error(error.message);
  return (data && data[0]) || null;
}
