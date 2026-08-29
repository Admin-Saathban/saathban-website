# AppHeader wiring — one line per lane

`src/app/components/AppHeader.jsx` is the small persistent bar for
signed-in areas: the Saathban mark linking to the signed-in role's own
home (`roleHomePath`), a Settings link, and Sign out. It is already
live on the auth lane's Welcome screen; each area lane adds it to its
own pages whenever ready.

## The one-line integration

```jsx
import AppHeader from "../../components/AppHeader.jsx";
```

(adjust `../../` to your depth — from `routes/home/`, `routes/fam/`,
`routes/admin/`, `routes/vetting/` it is exactly `../../components/`)

then render it as the FIRST element of the page, outside your own
padding/max-width wrappers so it spans the full width:

```jsx
return (
  <>
    <AppHeader />
    <main>…your page…</main>
  </>
);
```

For `routes/admin/AdminLayout.jsx` and `routes/fam/FamRoutes.jsx` one
placement in the layout covers every nested page.

## Facts you can rely on

- **No props, no setup.** It reads the session from `useSession()`;
  `<AuthProvider>` already wraps the whole /app route table.
- **Sticky** (`position: sticky; top: 0`, `zIndex: 20`) with the cream
  background and a hairline bottom border. If your page has its own
  sticky elements, keep their z-index below 20 or ask the header lane.
- **Sign out** clears the Supabase session and returns to `/app/auth`.
- **RTL and text size** are handled: flexbox flips under the Urdu
  direction wrapper, and both controls scale via `ts()` while keeping
  the 48px tap-target floor.
- **Strings** reuse existing locale keys (`settings.title`,
  `auth.welcome.signOut`) — nothing to translate to adopt it.

## For the i18n lane

Two string sets currently reuse/hardcode, by ownership necessity:

1. AppHeader reuses `auth.welcome.signOut` for its Sign out control.
   If you'd rather have `common.signOut` (+ `common.settings`), add
   the keys and update `AppHeader.jsx` — single file.
2. The simplified front door (`routes/AppHome.jsx`) carries a
   `STRINGS` constant of hardcoded English (`appHome.*` suggested):
   tagline, welcome line, and the "Join Saathban" label. "Sign in" and
   "Back to saathban.com" already use existing keys.

Delete this file once home, fam, admin, and vetting all carry the
header.
