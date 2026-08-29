# "Suggest a gathering" — wiring notes

Icon-proposed gatherings, reviewed by admins in events → Manage (migration
**0021**, `event_proposals`). Self-contained within the events lane; no
AppRoot edit (the events routes already mount under `/app/events`).

## Files

New (this flow):
- `supabase/migrations/0021_event_proposals.sql` — table + RLS + the
  `approve_event_proposal` / `decline_event_proposal` RPCs. Applied to the
  remote project via MCP. (Renumbered from 0019 → 0021: 0019 was taken by a
  concurrent `circle_dms`, 0020 reserved by the games/ludo lane.)
- `proposalsStore.js` — data layer.
- `proposalsCopy.js` — bilingual strings (see "Copy" below).
- `SuggestGathering.jsx` — the Icon's form.
- `AdminProposals.jsx` — the admin review section.

Integration edits (existing events files):
- `EventsRoutes.jsx` — `suggest` route, Icons only.
- `EventsList.jsx` — a "Suggest a gathering" CTA for Icons (links to `suggest`).
- `AdminEvents.jsx` — renders `<AdminProposals onReviewed={load} />` at the top
  of Manage; approving one adds a published event, so it refreshes the list.

## The loop

1. Icon opens Gatherings → **Suggest a gathering** → `/app/events/suggest`.
2. Fills title, a place (picked from `outdoor_places` or free text), day, optional
   time and note → a `pending` row (direct insert, RLS-guarded to the Icon).
3. Admin sees it in Manage → Proposals:
   - **Approve** → `approve_event_proposal` publishes an event whose description
     ends "Suggested by <first name>.", and notifies the proposer.
   - **Decline** → `decline_event_proposal(id, message)` requires a kind message,
     delivered to the proposer as a notification.
4. Timed-out proposals aren't a concept here — proposals wait until reviewed.

## Copy — local, pending central merge

`proposalsCopy.js` holds bilingual strings (English reference + Urdu draft) rather
than the central `locales/`. The rest of the events lane reads central
`t("events.*")`; this flow is kept local so its commit touches only its own paths
while `locales/` is under concurrent edit. **Follow-up:** merge into
`events.proposals.*` (and `events.list.suggestCta`) and swap the three integration
points to `t()`. The Urdu is a draft pending native review.

## Data contract (real — migration 0021)

- **Submit:** insert into `event_proposals` (RLS: `proposer_id = auth.uid()`,
  role `saath_icon`, `account_ok`, status `pending`). Place is either a
  `place_id` (FK to `outdoor_places`) or free `place_text` — a CHECK requires one.
- **Admin queue:** `select … where status='pending'`, place embedded via FK,
  proposer name from `safe_profiles`.
- **Approve / decline:** admin-only SECURITY DEFINER RPCs — the status flip, the
  event creation, and the notification are atomic.
