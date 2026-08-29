# Wiring `/app/vetting`

This folder is self-contained and **not yet registered** in the router, to
avoid touching `AppRoot.jsx` while other lanes are mid-flight there.
Whoever owns AppRoot next: registration is two lines.

## Route registration

In `src/app/AppRoot.jsx`:

```jsx
import VettingForm from "./routes/vetting/VettingForm.jsx";

// inside <Routes>:
<Route path="vetting" element={<VettingForm />} />
```

The flow is a single route — steps are internal state, not sub-routes, so a
half-finished application never produces a shareable deep link into someone's
identity details. `path="vetting"` (no splat) is enough.

## Entry point

The natural door is the Saath-Buddy signup: `routes/auth/SignupBuddy.jsx`
already tells applicants the full application comes after the account exists.
Once wired, its post-signup landing (or the Buddy placeholder dashboard)
should link to `/app/vetting`.

Gating that belongs to the auth/data lanes, not this folder:

- Require a signed-in `saath_buddy` account (the real RPC enforces this
  server-side regardless — `submit_buddy_application` rejects other roles).
- If the profile already has a live application (any status except
  `rejected`), show its status instead of a blank form.

## Previewing without wiring

With `npm run dev` running:

    http://localhost:5173/src/app/routes/vetting/preview.html

`preview.html` + `preview.jsx` mount the flow standalone; they're dev-only
and outside the production entry graph.

## Data contract

- Field keys in `vettingData.js` are **exactly** the snake_case columns of
  `supabase/migrations/0004_buddy_vetting.sql`; `buildPayload()` emits the
  `{ application, refs }` jsonb pair `submit_buddy_application()` expects.
- `mockSubmit.js` stands in for the RPC and mirrors its rejections (18+,
  exactly two references, required declarations). Swap its body for
  `supabase.rpc("submit_buddy_application", payload)` when the data layer
  lands; nothing else changes.
- Photo "uploads" store only mock paths under `buddy-documents/pending/…`.
  Real uploads must target the **private** `buddy-documents` bucket
  (migration 0008) *before* submission, then pass the returned storage paths
  as `cnic_photo_path` / `selfie_path`. Never a public bucket.
- Drafts persist to `localStorage` under `saathban.vetting.draft.v1`
  (cleared on submit). Note for the real data layer: the draft holds CNIC
  digits on the shared device used to apply — consider clearing it on
  sign-out as well.

## i18n

Strings are deliberately local to this folder (`vettingData.js` and
`steps.jsx`) because the locales files belong to another lane. When the
`ts()`/`useI18n` contract is stable, extraction is contained to those two
files plus `VettingForm.jsx`.
