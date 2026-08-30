/* ═══════════════════════════════════════════════════════════════
   0061 — a calendar entry knows what it is, and who it is about
   (PRODUCT_DECISIONS §13)

   "A calendar entry that's only text is a note. An entry must offer
   the action that fits it, at its time."

   The actions §13 asks for are different per KIND:

     Sunday 4pm — Chai Reunion  → open the event, message who's going
     Tuesday 10am — doctor      → tell your circle you're heading out
     Thursday — Ammi's birthday → call her, send a sticker, post a wish
     Friday — Sara visiting     → message her

   Today `calendar_entries.kind` allows exactly three values —
   personal, birthday, custom_reminder — so "doctor" and "Sara
   visiting" are both 'personal' and therefore indistinguishable. An
   entry that cannot say which of those it is cannot offer the right
   action, and the feature reduces to a list of text again.

   So two changes, both small:

   1. `appointment` and `visiting` join the allowed kinds. They are
      the two §13 names explicitly and they need different actions —
      one tells your circle you are going out, the other messages a
      person.

   2. `person_id` — because "message her" has to know who *her* is.
      Nullable: most entries are about nobody, and an entry whose
      person later leaves Saathban must not vanish, so the reference
      nulls rather than cascading the row away.

   MEDICATION IS STILL EXCLUDED, deliberately (§13): it recurs daily
   and would bury everything that makes a day different. Reminders
   handle it. Nothing here creates a path for it.
   ═══════════════════════════════════════════════════════════════ */

alter table public.calendar_entries
  drop constraint if exists calendar_entries_kind_check;

alter table public.calendar_entries
  add constraint calendar_entries_kind_check
  check (kind in ('personal', 'birthday', 'custom_reminder', 'appointment', 'visiting'));

alter table public.calendar_entries
  add column if not exists person_id uuid references public.profiles (id) on delete set null;

comment on column public.calendar_entries.person_id is
  'Who the entry is about, when it is about someone (§13: "Friday — Sara visiting" must be able to offer "message her"). Nullable; nulls rather than cascades so an entry outlives the person leaving.';

/* The calendar reads "mine, from today onwards" on every visit. */
create index if not exists calendar_entries_owner_date_idx
  on public.calendar_entries (owner_id, entry_date);
