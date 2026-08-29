# Fam lane — wiring notes

This folder is self-contained: mock data only, no Supabase calls, no edits to
any file outside `src/app/routes/fam/`. Whoever runs the next seam pass wires
it up as follows.

## 1. Route registration (AppRoot.jsx)

```jsx
import FamRoutes from "./routes/fam/FamRoutes.jsx";
import { RequireAuth } from "./lib/session.jsx";

// inside <Routes>, alongside the other lanes:
<Route
  path="fam/*"
  element={
    <RequireAuth roles={["family_member"]}>
      <FamRoutes />
    </RequireAuth>
  }
/>
```

Since session guarding landed (`src/app/lib/session.jsx`), two more one-liners
belong to the same seam pass:

- `roleHomePath()` in `session.jsx` currently sends `family_member` to the
  `/app/auth/welcome` placeholder — its own comment says to point the role at
  the real dashboard when it lands. Change that case to return `"/app/fam"`.
- The mock signed-in member in `famMock.js` (`MOCK_FAM`) becomes the
  `useAuth()` profile at the same time.

`FamRoutes.jsx` owns everything below `/app/fam`:

| Path | Screen |
|---|---|
| `/app/fam` | `FamDashboard` — connected Icons, pending request, invite door |
| `/app/fam/invite` | `InviteFlow` — email / 6-digit code / QR placeholder, plus "enter a code" join request |
| `/app/fam/icon/:iconId/reminders` | `Reminders` — routines management, gated on `manageReminders` |

The route table must stay inside the `LanguageProvider` wrapper (it already
wraps the whole table), since every screen here uses `useI18n()` for `ts()`,
direction, and font metadata.

Optional: add a Fam card to the `/app` front door (`AppHome.jsx`) the way the
other landed lanes are linked.

## 2. Strings → locales

Following the home lane's convention, all copy sits in one place —
`famMock.js` → `COPY` — so the Urdu pass is a one-file extraction into
`locales/en.js` + `locales/ur.js` (TODO-wrapped) under a `fam.*` namespace.
Note that several strings are functions (interpolations); they become
`{name}`-style templates when they move into the locale files.

## 3. Mock → Supabase (My Circle backend, build step 7)

`famMock.js` is the data contract to replace:

- `MOCK_CONNECTED_ICONS` — circle memberships where this account is the Fam
  member, joined with each Icon's *permitted* daily summary. The permission
  object (`sosContact`, `seeDailyLogs`, `seeHealth`, `manageReminders`,
  `location: "never" | "sos_only"`) mirrors the per-member grants in SPEC.md
  §My Circle — **RLS must enforce it; the card component only reflects it.**
- `MOCK_PENDING` — outgoing join requests (single-use tokens, 48 h expiry).
- `MOCK_INVITE` — a real single-use token behind all three faces (email send,
  6-digit code, QR). The QR is a drawn placeholder; swap in a QR render of the
  token URL when tokens exist.
- Reminder add/edit/delete in `Reminders.jsx` writes local state; each handler
  marks the seam for the corresponding insert/update/delete.

## Deliberate UI decisions (keep on rewire)

- An Icon who granted nothing beyond the default shows privacy lines, not
  locked-state teasers; the reminders button is **absent**, never disabled.
- "Nothing logged yet today" copy is a fact, never an alarm — no scoreboard
  framing (SPEC.md, empty states are doors).
- Reminder deletion is one tap, no confirmation maze (mirrors circle removal).
- Digit groups (invite code, code entry) are pinned `dir="ltr"` so they don't
  reorder under Urdu.
