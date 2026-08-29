# Chat depth on the canonical DM thread (migration 0034)

`/app/people/<profileId>/chat` (ThreadPage.jsx) gains reply-to, per-person
delete, sender delete-for-everyone, and photos. Everything else on that screen —
the carrom inline board and its one-live-board guard, the sticker picker, the
money-talk banner, per-message Report, and bell-clearing — is untouched and
unreordered (that surface belongs to the integration/games lane; changes here
were made against a clean HEAD and announced before commit).

## What was added

| Feature | Where it lives | The rule that governs it |
|---|---|---|
| Reply-to | `reply_to_id` on `dm_messages` | A trigger refuses a reply that points outside the same thread |
| Quoted snippet | ThreadPage render | Tap the quote → scrolls to and briefly highlights the original |
| Delete for me | `dm_message_hides` (message, person) | RLS: you may only hide *for yourself*, and only in a thread you're in |
| Delete for everyone | `delete_dm_message()` RPC | Sender only, within **15 minutes**; the row survives as a stub (`deleted_at`, body/image nulled) |
| Photos | `image_path` + private bucket `dm-images` | Path is `<request_id>/<file>`; a trigger refuses a path outside this thread's folder |
| Inline + large view | ThreadPage render | Short-lived **signed URLs** (never a public URL); tap to open a lightbox |

**No filters** on photos — deliberately v2, per the spec.

## Privacy and moderation notes

- The bucket is **private**. Upload requires `dm_open(request_id)` (a
  participant of an open thread); read requires `is_dm_participant`. Verified at
  the database: a non-participant's insert into a thread's folder is refused,
  and they read **0** objects while a participant reads theirs.
- **Moderation snapshots survive deletion by design.** A report copies the text
  into `community_reports.target_excerpt` when it is filed; removing the message
  afterwards does not erase that snapshot. A report is a report.
- The 0014 freeze rule still forbids editing a message. It is carved open for
  exactly one transition — setting `deleted_at` while nulling body and image —
  and refuses anything else.
- `kind='dm'` bell notifications (0030) are untouched.

## Milestone progress (same migration)

`milestone_progress()` returns, per badge trigger, `{current, target}` computed
by **the same rules `compute_badge_awards` (0017) uses to award** — so the line
on a card can never disagree with the badge. Earned cards read complete. It
reads only the caller's own counts: nothing here can compare two people.

## Verified (test-icon ↔ test-fam)

Database: reply-in-thread OK; cross-thread reply and foreign image path
rejected; non-sender delete rejected; delete-for-everyone → body null +
`deleted_at`; late (>15 min) delete rejected; hide-as-another-person rejected;
intruder upload rejected; participant reads 1 image, non-participant reads 0.

UI (both roles, en + ur): quote renders and jumps; delete-for-me hides for one
person only (the other still sees the message); delete-for-everyone replaces
the message with exactly one “message removed” stub; photo uploads and renders via a
signed URL with a working lightbox; a recipient has **no** delete-for-everyone
on someone else's message (absent, not disabled) while Report stays reachable;
milestone progress lines and bars render; RTL wrapper and Urdu strings correct.

All checks green. Note for whoever tests this surface next: the project goes
intermittently unresponsive under concurrent lane load, which shows up as
assertions flapping with no code change (a seeded message present then absent,
one assertion failing while another on the same element passes). Run DB-heavy
suites one lane at a time, and use the smoke-* accounts — never the test-* pair
the user retests in.
