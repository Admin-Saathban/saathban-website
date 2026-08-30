/* ═══════════════════════════════════════════════════════════════
   0051 — close the anonymous grants, and the tap they came from

   Found by the Lane A lane while proving that 0050's public game
   result was the schema's ONLY anon door. It wasn't. Two tables
   carried table-level grants to `anon`:

     audit_log        SELECT
     reminder_dones   SELECT, INSERT, UPDATE, DELETE, TRUNCATE

   reminder_dones is mine (0048) and it is the worse of the two: an
   anonymous client held full DML on rows recording whether a person
   took their medication.

   NEITHER WAS EXPLOITABLE TODAY, and it matters why not. Both refuse
   a stranger — but they refuse because their RLS policies reference
   things anon cannot reach (`is_super_admin`, a SELECT on
   circle_members), not because the table is closed. That is defence
   by accident. It holds, and it is one policy edit away from not
   holding, and that edit would look like it was about circle
   permissions rather than about anonymous access. Nobody reviewing it
   would see what it had done.

   THE ROOT CAUSE, which is the real fix. Supabase ships
   ALTER DEFAULT PRIVILEGES granting anon ALL on every new table in
   public owned by postgres:

     pg_default_acl → {anon=arwdDxtm/postgres, ...}

   So every table any lane creates from now on arrives wide open to
   anonymous callers unless its author remembers to revoke. Every
   other table in this schema is closed only because somebody
   remembered — daily_logs, outdoor_places and the rest all revoke
   explicitly. Two out of forty forgot, which is a better hit rate
   than this pattern deserves and not one to keep relying on.

   So this migration revokes the default itself. New tables will
   arrive closed to anon, and a table that genuinely needs anonymous
   access must say so out loud, in its own migration, where a reviewer
   can see the word `anon` and ask why. 0050 is exactly that: one
   SECURITY DEFINER function, granted deliberately.

   `authenticated` and `service_role` are untouched. RLS is unchanged.
   Nothing a signed-in person can do changes.
   ═══════════════════════════════════════════════════════════════ */

revoke all on table public.reminder_dones from anon;
revoke all on table public.audit_log from anon;

/* The tap. Without this, the next table repeats the finding. */
alter default privileges in schema public revoke all on tables from anon;

/* Sequences and functions come from the same default and deserve the
   same treatment: an anon caller has no business calling a routine
   nobody deliberately exposed. 0050's function grants itself
   explicitly, so it is unaffected. */
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke execute on functions from anon;
