/* ════════════════════════════════════════════════
   One box, four kinds of result — NAVIGATION_SPEC §5.

   Four queries, run together, each one deliberately small. Nothing
   here widens what a person can see: every table below already has
   row-level security, and search asks the same questions the rest of
   the app asks. A search box is exactly where a leak would be
   invisible, so none of these queries carries a filter that RLS is not
   already enforcing underneath it.

   People is `safe_profiles`, not `profiles` — the view that exists so
   a name and a city can be looked up without a date of birth, an
   email or a phone number coming along.

   Groups relies on 0063: `can_see_group` returns true for a group
   whose privacy is 'anyone'. So an ilike over `groups` returns the
   caller's own groups plus the public ones and nothing else, without
   this file having to know the rule.

   THE SEARCH TERM IS ESCAPED. `%` and `_` are wildcards to ilike and
   a comma ends a term inside PostgREST's `or=()`, so a name with a
   comma in it silently became two conditions. Escaped rather than
   stripped: somebody searching for "O'Brien, A" should find them.
   ════════════════════════════════════════════════ */

import supabase from "../../lib/supabase.js";

const LIMIT = 8;

/* PostgREST parses `or=(a.ilike.%x%,b.ilike.%y%)` by splitting on
   commas, so a comma in the term breaks the filter apart. Wrapping the
   value in double quotes is how PostgREST is told "this is one value";
   inner quotes and backslashes then need escaping themselves. */
function safeTerm(q) {
  return q.trim().replace(/[\\"]/g, "\\$&").replace(/[%_]/g, "\\$&");
}

export async function searchPeople(q) {
  const term = safeTerm(q);
  if (!term) return [];
  const { data, error } = await supabase
    .from("safe_profiles")
    .select("id, full_name, city, role")
    .or(`full_name.ilike."%${term}%",city.ilike."%${term}%"`)
    .limit(LIMIT);
  if (error) throw error;
  return data || [];
}

export async function searchGroups(q) {
  const term = safeTerm(q);
  if (!term) return [];
  const { data, error } = await supabase
    .from("groups")
    .select("id, name, description, privacy")
    .or(`name.ilike."%${term}%",description.ilike."%${term}%"`)
    .is("hidden_at", null)
    .limit(LIMIT);
  if (error) throw error;
  return data || [];
}

export async function searchPlaces(q) {
  const term = safeTerm(q);
  if (!term) return [];
  const { data, error } = await supabase
    .from("outdoor_places")
    .select("id, name, city, area, place_type")
    .or(`name.ilike."%${term}%",area.ilike."%${term}%",city.ilike."%${term}%"`)
    .limit(LIMIT);
  if (error) throw error;
  return data || [];
}

export async function searchPosts(q) {
  const term = safeTerm(q);
  if (!term) return [];
  const { data, error } = await supabase
    .from("community_posts")
    .select("id, body, author_id, created_at")
    .ilike("body", `%${term}%`)
    .order("created_at", { ascending: false })
    .limit(LIMIT);
  if (error) throw error;
  return data || [];
}

/* Which groups the caller is already in, so a row can say "Open"
   rather than offering to join something they are standing inside. */
export async function myGroupIds() {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return new Set();
  const { data } = await supabase
    .from("group_members")
    .select("group_id")
    .eq("member_id", uid);
  return new Set((data || []).map((r) => r.group_id));
}

/* ── Recent searches ──

   On the device, never on the server. What somebody typed into a
   search box is a record of who they were curious about, and there is
   no version of that being useful to Saathban that is worth keeping.
   It is also why "Forget these" is offered plainly rather than buried
   in Settings. */
const RECENTS_KEY = "sb.search.recents";
const MAX_RECENTS = 6;

export function loadRecents() {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENTS_KEY) || "[]");
    return Array.isArray(raw) ? raw.filter((s) => typeof s === "string").slice(0, MAX_RECENTS) : [];
  } catch {
    return [];
  }
}

export function rememberSearch(q) {
  const term = q.trim();
  if (term.length < 2) return loadRecents();
  const next = [term, ...loadRecents().filter((r) => r.toLowerCase() !== term.toLowerCase())].slice(
    0,
    MAX_RECENTS
  );
  try {
    localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  } catch {
    /* a full or blocked store costs a convenience, never the search */
  }
  return next;
}

export function forgetRecents() {
  try {
    localStorage.removeItem(RECENTS_KEY);
  } catch {
    /* nothing to do — the list is already unreadable */
  }
  return [];
}

/* A few groups to look at before anybody has typed anything.

   §5: "Before typing: recent searches and a few suggested groups.
   Never a blank page." A search box with nothing under it is the screen
   that teaches people the feature is broken — they type, get nothing
   they recognise, and do not come back. It matters more here than on a
   younger audience's app, where an empty search box is a familiar
   shape.

   Public groups only, and only ones the caller is not already in:
   suggesting the group somebody is standing inside is worse than
   suggesting nothing. 0063 makes privacy='anyone' groups visible to
   any community-enabled account, so RLS returns exactly the right set
   without this query knowing the rule. */
export async function suggestedGroups(limit = 5) {
  const mine = await myGroupIds();
  const { data, error } = await supabase
    .from("groups")
    .select("id, name, description, privacy")
    .eq("privacy", "anyone")
    .is("hidden_at", null)
    .order("created_at", { ascending: false })
    .limit(limit + mine.size);
  if (error) throw error;
  return (data || []).filter((g) => !mine.has(g.id)).slice(0, limit);
}

/* ── Asking to join (NAVIGATION_SPEC §5, migration 0086/0087) ── */

export async function requestToJoinGroup(groupId, message = null) {
  const { error } = await supabase.rpc("request_to_join_group", {
    p_group: groupId,
    p_message: message,
  });
  if (error) throw error;
}

/* My own knocks, by group. The DECLINED ones matter as much as the
   pending ones: 0086 keeps a declined row precisely so this row can say
   "not this time" instead of silently reverting to "Ask", which would
   leave a person asking over and over with no idea anything had
   happened. RLS ("requester reads own") scopes it; the filter is here
   anyway rather than trusting a policy to be the query. */
export async function myJoinRequests() {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return {};
  const { data, error } = await supabase
    .from("group_join_requests")
    .select("group_id, status, created_at")
    .eq("requester_id", uid)
    .order("created_at", { ascending: false });
  if (error) throw error;
  /* Newest first, so the first row seen for a group is its current
     state — a person who was declined and asked again is 'pending'. */
  const byGroup = {};
  for (const r of data || []) if (!byGroup[r.group_id]) byGroup[r.group_id] = r.status;
  return byGroup;
}
