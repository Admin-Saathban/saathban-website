/* ════════════════════════════════════════════════
   Who a share would reach — first names, for the preview (0120).

   A share that notifies people must say who before it goes and who
   after it went. The server answers for the caller's own audience only:

     "circle"       the people in this person's circle, either direction
     "friends"      people they have an accepted conversation with
     "connections"  circle, friends and group-mates (what "my people"
                    means for a riddle or a badge)

   First names only — names the caller already sees elsewhere on their
   own screens.
   ════════════════════════════════════════════════ */

import supabase from "./supabase.js";

export async function fetchShareAudience(audience) {
  const { data, error } = await supabase.rpc("share_audience", { p_audience: audience });
  if (error) throw new Error(error.message);
  return (data || []).map((r) => r.first_name).filter(Boolean);
}

/* "Fatima, Ali and Sara" — or, past a handful, the first few and a
   count, so a long list stays readable at large text. */
export function namesLine(names, t) {
  if (!names || names.length === 0) return "";
  if (names.length === 1) return names[0];
  if (names.length <= 4) {
    return t("share.namesAnd", { list: names.slice(0, -1).join(", "), last: names[names.length - 1] });
  }
  return t("share.namesMore", { list: names.slice(0, 3).join(", "), n: names.length - 3 });
}
