/* ════════════════════════════════════════════════
   Probe cleanup, shared, and deliberately narrow.

   Three of these suites created posts through the browser and deleted
   nothing, so every run left rows in a test account several lanes
   share. Twenty-two posts had built up before anyone looked.

   THE RULE IS BOTH CONDITIONS, NOT EITHER. A sweep is scoped to rows
   that (a) carry this run's marker prefix AND (b) did not exist when
   the run started. Marker alone would delete a concurrent run's rows
   from another lane, since the account is shared. Newness alone would
   delete whatever a person happened to post while the suite ran.

   This is the lesson from the cleanup that once removed the audio of
   "the three newest posts by this author" whatever they were: a
   cleanup that can destroy more than it created is worse than none.

   Usage:
     const before = await snapshotProbes();          // before any posting
     ...
     await sweepProbes(before);                      // last thing, before exit
   ════════════════════════════════════════════════ */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const raw = readFileSync("./.env.local", "utf8");
const g = (n) => { const l = raw.split(/\r?\n/).find((x) => x.startsWith(n)); return l.slice(l.indexOf("=") + 1).trim(); };

export const PROBE_PREFIX = "ZZ ";

async function client() {
  const SUPA = g("VITE_SUPABASE_URL"), ANON = g("VITE_SUPABASE_ANON_KEY");
  const r = await fetch(`${SUPA}/auth/v1/token?grant_type=password`, {
    method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email: "test-icon@saathban.dev", password: "SaathTest!2026" }),
  });
  const s = await r.json();
  if (!s?.access_token) throw new Error("probe cleanup could not sign in");
  return {
    sb: createClient(SUPA, ANON, { global: { headers: { Authorization: `Bearer ${s.access_token}` } } }),
    uid: s.user.id,
  };
}

/* Ids that already existed. Not a timestamp: a client clock in a
   PostgREST .gt("created_at") filter silently matches nothing when the
   two clocks disagree, which reads exactly like "nothing was created".
   Sets of ids cannot drift. */
export async function snapshotProbes() {
  try {
    const { sb, uid } = await client();
    const { data } = await sb.from("community_posts").select("id").eq("author_id", uid);
    return new Set((data || []).map((r) => r.id));
  } catch {
    return null;   /* cleanup must never fail a suite */
  }
}

/* A DELETED POST LEAVES A LIVE NOTIFICATION POINTING AT IT.

   Sweeping posts is not sweeping the run. Tagging someone writes a
   notification whose link carries the post id, and deleting the post
   does not touch it — five had built up aimed at posts that no longer
   exist. Followed by hand, the app degrades gracefully (it lands on
   the feed, no errors, no hang) so this is litter rather than a bug,
   but it is litter in a shared account that the next lane would have
   to reason about.

   Scoped to the ids just deleted, so it can only remove notifications
   about this run's own posts. */
async function sweepNotifications(ids) {
  if (!ids.length) return 0;
  let gone = 0;
  for (const email of ["test-fam@saathban.dev", "test-icon@saathban.dev"]) {
    try {
      const SUPA = g("VITE_SUPABASE_URL"), ANON = g("VITE_SUPABASE_ANON_KEY");
      const r = await fetch(`${SUPA}/auth/v1/token?grant_type=password`, {
        method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: "SaathTest!2026" }),
      });
      const s = await r.json();
      if (!s?.access_token) continue;
      const c = createClient(SUPA, ANON, { global: { headers: { Authorization: `Bearer ${s.access_token}` } } });
      for (const id of ids) {
        const { data } = await c.from("notifications").select("id").ilike("link", `%${id}%`);
        for (const n of data || []) { await c.from("notifications").delete().eq("id", n.id); gone++; }
      }
    } catch { /* cleanup must never fail a suite */ }
  }
  return gone;
}

export async function sweepProbes(before) {
  if (!before) return 0;
  try {
    const { sb, uid } = await client();
    const { data } = await sb
      .from("community_posts")
      .select("id, body, audio_path")
      .eq("author_id", uid)
      .like("body", PROBE_PREFIX + "%");
    const mine = (data || []).filter((r) => !before.has(r.id));
    for (const r of mine) {
      if (r.audio_path) await sb.storage.from("post-audio").remove([r.audio_path]).catch(() => {});
      await sb.from("community_posts").delete().eq("id", r.id);
    }
    const notes = await sweepNotifications(mine.map((r) => r.id));
    if (mine.length) console.log(`  (swept ${mine.length} probe post${mine.length > 1 ? "s" : ""}` +
                                 `${notes ? `, ${notes} notification${notes > 1 ? "s" : ""}` : ""})`);
    return mine.length;
  } catch {
    return 0;
  }
}
