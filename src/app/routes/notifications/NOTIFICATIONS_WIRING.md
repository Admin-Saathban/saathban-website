# Notifications lane — wiring notes

Self-contained under `src/app/routes/notifications/`: real Supabase reads/writes
against `public.notifications` (migration 0007), no edits outside this folder.

## 1. Route registration (AppRoot.jsx)

```jsx
import NotificationsRoutes from "./routes/notifications/NotificationsRoutes.jsx";
import { RequireAuth } from "./lib/session.jsx";

// inside <Routes>, alongside the other lanes — any signed-in role:
<Route
  path="notifications/*"
  element={
    <RequireAuth>
      <NotificationsRoutes />
    </RequireAuth>
  }
/>
```

`NotificationsRoutes` renders its own `AppHeader`.

## 2. Unread badge in AppHeader  ⚠ needs the header lane

The badge is delivered as a self-contained component,
`routes/notifications/NotificationsBell.jsx`, rather than by editing the shared
`components/AppHeader.jsx` (another lane's file — this lane stages only its own
paths). To show it, the header lane adds two lines to `AppHeader.jsx`:

```jsx
import NotificationsBell from "../routes/notifications/NotificationsBell.jsx";
// …inside the <nav>, before the Settings link:
<NotificationsBell />
```

It fetches the unread count on mount, on window focus, and on the
`sb:notifications-read` event the screen dispatches after marking read, so the
badge clears without a reload. See QUESTIONS.md (Q1) — confirm placement/owner.

## 3. Data contract (already real — migration 0007)

- **Read:** `notifications` (RLS: `profile_id = auth.uid()`), newest first.
- **Unread count:** `head` count where `read_at is null`.
- **Mark read:** `update read_at = now()` by id / for all unread — RLS-scoped.
- Notifications are **created by staff RPCs / service role only** (no insert
  policy), so this lane never writes new notifications. Seed test rows via
  `admin_contact_icon` or the service role.
