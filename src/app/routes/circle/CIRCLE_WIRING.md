# My Circle lane — wiring notes

> **Status: WIRED.** `circle/*` is registered in `AppRoot.jsx` behind
> `RequireAuth roles={["saath_icon"]}` → `CircleRoutes` (which carries its
> own AppHeader), and Settings links to `/app/circle` for Icons. The
> sections below remain as the data contract.

Self-contained under `src/app/routes/circle/`: real Supabase reads/writes
against `circle_members` and `circle_invites` (migration 0005).

## 1. Route registration (AppRoot.jsx)

```jsx
import CircleRoutes from "./routes/circle/CircleRoutes.jsx";
import { RequireAuth } from "./lib/session.jsx";

// inside <Routes>, alongside the other lanes:
<Route
  path="circle/*"
  element={
    <RequireAuth roles={["saath_icon"]}>
      <CircleRoutes />
    </RequireAuth>
  }
/>
```

My Circle is **Icon-facing** — the guard is `saath_icon`. `CircleRoutes.jsx`
renders its own `AppHeader`, so no header is needed at the registration site.
The route table must stay inside the existing `LanguageProvider` + `AuthProvider`
wrappers (they already wrap the whole table); every screen uses `useI18n()` for
`ts()` / direction and `useSession()` for the signed-in Icon.

### Navigation visibility (SPEC.md, "The empty circle")

> Circle stays out of main navigation until it has a member.

The route may always be *reachable*; what must be gated is any **nav entry** to
it (e.g. a link on the Icon home). Show that link only when the Icon has at least
one circle member or a pending request. A cheap check:
`select 1 from circle_members where icon_id = auth.uid() limit 1` (plus the same
for pending `member_to_icon` invites). The page itself is a safe landing even
when empty — it renders the door, not a scoreboard.

## 2. Strings → locales

**Done** (quality-report pass): all copy lives in `locales/en.js` + `ur.js`
under `circle.*` (`copy.js` is gone), Urdu drafted pending native review;
the two inline name fallbacks moved to `circle.member.unknownFallback` /
`circle.requests.unknownFallback`.

## 3. Data contract (already real — migration 0005)

No mock to replace; the lane is wired to production tables and RPCs:

- **Read:** `circle_members` (RLS: `icon_id = auth.uid()`) joined in JS to
  `safe_profiles` for names (the Icon cannot read another person's `profiles`
  row — `safe_profiles` is the only lawful source). Pending requests come from
  `circle_invites` where `direction='member_to_icon'`, `used_at is null`,
  `expires_at > now()`.
- **Permissions:** `update circle_members set <col> = <val>` by row id — all
  default OFF at the database. SOS ordering (`is_sos_contact` + `sos_order`) is
  kept compact 1..N in the app; the schema stores it but leaves sequencing to
  the client.
- **Removal:** `delete circle_members` by row id — one tap, RLS-scoped.
- **Approve request:** `rpc('approve_circle_request', { p_invite_id })`.
- **Invite (empty-state door):** `rpc('create_circle_invite', { p_email,
  p_phone })` → 6-digit code. Email/phone send and the QR are the invite lane's
  job; this lane proves the code path.

## Deliberate decisions (keep on rewire)

- Every permission renders OFF until the Icon turns it on; toggles announce
  On/Off in words (never colour alone) and keep the 48px / 18px floors.
- Removal has no confirmation maze and no notification to the removed person.
- The empty state is a door ("your circle is yours to build"), never a gap or a
  "you haven't added anyone yet".
