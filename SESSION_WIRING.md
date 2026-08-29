# Session wiring — the AppRoot diff to apply

The session-guard lane (sole owner of `src/app/routes/auth/` and
`src/app/lib/session.jsx`) is not allowed to edit `AppRoot.jsx` while other
sessions are active in it. This file is the exact change the AppRoot owner
should apply. Everything else already works without it — the auth flow
routes each role to the right place on its own — but until this diff is
applied, `/app/home` and `/app/admin` render for signed-out visitors.

The diff is written against `AppRoot.jsx` as of commit `db0755c`
("Seam fix: /app front door links every landed lane"). If the file has
moved on, apply the three numbered steps rather than the literal lines.

## What it does

- Wraps the route table in `<AuthProvider>` (holds Supabase session +
  the signed-in profile row; any component may then call `useSession()`).
- Guards the Icon home behind `RequireAuth roles={["saath_icon"]}` and
  admin behind `roles={["admin"]}`. Signed out → login; signed in without
  a profile row → finish-mode signup; wrong role → that role's own home
  (`roleHomePath()` in `src/app/lib/session.jsx` is the single map).
- Saath-Fam and Saath-Buddy land on `/app/auth/welcome` (inside the auth
  lane's own route table — no AppRoot change needed for it) until their
  dashboards exist.

RLS remains the real security boundary; this is navigation.

## Step 1 — add two imports

```diff
 import { LanguageProvider } from "./lib/i18n.jsx";
 import AuthRoutes from "./routes/auth/AuthRoutes.jsx";
 import AppSettings from "./routes/AppSettings.jsx";
+import { AuthProvider, RequireAuth } from "./lib/session.jsx";
```

## Step 2 — wrap the route table in AuthProvider

`AuthProvider` goes immediately inside `LanguageProvider` (it renders no
DOM and uses no router hooks, so inside or outside `<Routes>`' parent both
work — inside `LanguageProvider` keeps one obvious nesting order):

```diff
 export default function AppRoot() {
   return (
     <LanguageProvider>
+      <AuthProvider>
       {/* The marketing site loads its own fonts inside its own components,
           so /app has to ask for them itself. */}
       <style>{`@import url('${GOOGLE_FONTS_URL}');`}</style>

       <Routes>
         ...
       </Routes>
+      </AuthProvider>
     </LanguageProvider>
   );
 }
```

(Re-indent the wrapped block or not — cosmetic, your call.)

## Step 3 — guard the two role-owned route trees

```diff
-        <Route path="home/*" element={<IconHome />} />
+        <Route
+          path="home/*"
+          element={
+            <RequireAuth roles={["saath_icon"]}>
+              <IconHome />
+            </RequireAuth>
+          }
+        />
```

```diff
-        <Route path="admin" element={<AdminLayout />}>
+        <Route
+          path="admin"
+          element={
+            <RequireAuth roles={["admin"]}>
+              <AdminLayout />
+            </RequireAuth>
+          }
+        >
```

The nested admin routes (`buddies`, `buddies/:id`, `moderation`) need no
change — guarding the layout guards them all.

Optionally guard `settings` the same way with no `roles` prop
(`<RequireAuth><AppSettings /></RequireAuth>`) once Settings should be
signed-in only — the Settings owner's call.

## Behaviour notes for whoever applies this

- `RequireAuth` passes the blocked path as `state.from` on the login
  redirect. Nothing reads it yet; a later improvement can send people
  back where they were headed after sign-in.
- While the session resolves, `RequireAuth` renders a quiet wordless
  loading frame, so guarded pages never flash before a redirect.
- `roleHomePath()` in `src/app/lib/session.jsx` is the one place that
  maps role → home. When the Fam/Buddy dashboards land, retarget those
  roles there and delete `src/app/routes/auth/Welcome.jsx`.
- For the i18n lane: `Welcome.jsx` carries a small `STRINGS` constant of
  hardcoded English (the locales files were owned by another session at
  the time). Please lift them into `en.js`/`ur.js` under `auth.welcome.*`
  and swap to `t()`.

Once applied, this file can be deleted.
