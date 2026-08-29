/* ════════════════════════════════════════════════
   Shared moments — what a connected person CHOSE to share with the
   community: their posts, including badge / score / walk share cards
   (0018 payload snapshots).

   Permission model, load-bearing: earned badges are OWNER-ONLY at the
   database (0017) — a Fam member can never query them. The only lawful
   window is the community share the person made themselves (posting IS
   the consent), and the posts read-policy (0014: visible, not hidden,
   not blocked) trims this further. So this module reads community_posts
   for one author and nothing else — celebration of what was offered,
   structurally incapable of monitoring what wasn't.
   ════════════════════════════════════════════════ */

import supabase from "../../lib/supabase.js";

export async function fetchSharedMoments(iconId, limit = 3) {
  const { data, error } = await supabase
    .from("community_posts")
    .select("id, post_type, body, payload, created_at")
    .eq("author_id", iconId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data || [];
}

/* A short, warm day label ("today", "yesterday", else a date). */
export function momentDayLabel(iso, t) {
  const d = new Date(iso);
  const today = new Date();
  const midnight = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate());
  const days = Math.round((midnight(today) - midnight(d)) / 864e5);
  if (days <= 0) return t("home.todayLower");
  if (days === 1) return t("home.yesterdayLower");
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}
