# Profile lane — wiring notes

Self-contained under `src/app/routes/profile/`: real Supabase reads/writes
against `public.profiles` (migration 0002), no edits outside this folder.

## 1. Route registration (AppRoot.jsx)

```jsx
import ProfileRoutes from "./routes/profile/ProfileRoutes.jsx";
import { RequireAuth } from "./lib/session.jsx";

// inside <Routes> — any signed-in role edits their own profile:
<Route
  path="profile/*"
  element={
    <RequireAuth>
      <ProfileRoutes />
    </RequireAuth>
  }
/>
```

`ProfileRoutes` renders its own `AppHeader`. A "Profile" link can be added to
the header/menu by the header lane (optional).

## 2. Data contract (already real — migration 0002)

- **Read:** own `profiles` row (`select ... where id = auth.uid()`).
- **Edit:** `full_name`, `city`, `languages` only. The "update own profile"
  policy scopes writes to `id = auth.uid()`, and the protected-columns trigger
  blocks role / tier / admin flags at the database — so the form cannot change
  anything sensitive even if tampered with. After save, the page calls
  `refreshProfile()` from `useSession()` so the rest of the app sees the new name.
- Role is shown (respectfully, via `constants/roles.js` `ROLE_DISPLAY`) but is
  never editable here.
