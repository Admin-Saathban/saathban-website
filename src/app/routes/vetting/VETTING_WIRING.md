# Wiring `/app/vetting`

> **Status: WIRED, live against Supabase.** The route is registered in
> `AppRoot.jsx` behind `RequireAuth roles={["saath_buddy"]}`, the Buddy
> welcome screen (`routes/auth/Welcome.jsx`) links here as the entry point,
> and submission goes through the real `submit_buddy_application()` RPC —
> `mockSubmit.js` is gone.

## How the flow talks to Supabase

All backend access lives in `supabaseVetting.js`:

- **On mount** the form reads the applicant's own `buddy_applications` rows
  (RLS scopes the select). A live application (status ≠ `rejected`) renders
  the pipeline status screen instead of the form; a rejection decided within
  the last 90 days renders the cooldown screen with the days remaining.
- **On submit** the CNIC photo and selfie upload to the **private**
  `buddy-documents` bucket at `<auth uid>/cnic-<ts>.<ext>` and
  `<auth uid>/selfie-<ts>.<ext>` — migration 0008's policies reject any
  path whose first folder isn't the caller's own uid, and only
  jpeg/png/webp are accepted (enforced in the picker and again at upload).
  The returned object paths go into the payload, then
  `supabase.rpc("submit_buddy_application", { application, refs })` runs.
- **RPC rejections** are classified by message substring
  (`classifySubmitError`) onto kind, full-screen explanations — under-18,
  90-day cooldown, blocked/not-in-good-standing, duplicate live
  application (which re-fetches and shows the existing application's
  status instead). Raw database errors never reach an applicant.
- **After success** the form re-reads its own row and renders the status
  screen from the database's truth, not an assumption.

## Status screens

`screens.jsx` renders the applicant's view of the pipeline
(`pending → interviewing → probation → active`; `suspended` gets its own
gentle screen). Rejection is never shown as a pipeline stage — it appears
only as the cooldown screen with a date. Admin-side status changes are the
admin lane's queue; this folder only ever *reads* status.

## Previewing

`preview.html` + `preview.jsx` still mount the flow without AppRoot, but
the backend is real: sign in at `/app/auth` as a `saath_buddy` first (the
session is shared via localStorage on the same origin). Dev-only; outside
the production entry graph.

## Data contract

- Field keys in `vettingData.js` are **exactly** the snake_case columns of
  `supabase/migrations/0004_buddy_vetting.sql`; `buildPayload()` emits the
  `{ application, refs }` jsonb pair the RPC expects. Photos are in-memory
  `File`s until submit; their storage paths are passed to `buildPayload()`
  after upload.
- Drafts persist to `localStorage` under `saathban.vetting.draft.v1`
  (photos excluded — they're re-requested after a reload) and clear on
  submit or when a live application is found. Note for the session lane:
  consider clearing this key on sign-out too; a draft holds CNIC digits on
  a shared device.

## i18n

Strings are deliberately local to this folder (`vettingData.js`,
`steps.jsx`, `screens.jsx`) because the locales files belong to another
lane. When lifting them into `en.js`/`ur.js`, those three files plus
`VettingForm.jsx` are the whole extraction surface.
