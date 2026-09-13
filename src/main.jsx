import React, { lazy, Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { APP_COLORS } from './shared/tokens.js'
import { preloadStoredLocale } from './app/locales/index.js'

/* Auth-link safety net: when a Supabase email link redirects to the
   SITE ROOT instead of /app/auth/complete (mis-customized email
   template, or a redirect URL the allow-list dropped), the tokens
   still arrive in the URL fragment (implicit flow) or as ?code=
   (PKCE). The marketing site would silently ignore them and the
   sign-in would be lost — so forward them to the completion screen
   before anything renders. */
if (
  window.location.pathname === '/' &&
  (/[#&](access_token|refresh_token|error|error_code)=/.test(window.location.hash) ||
    /[?&]code=/.test(window.location.search))
) {
  window.location.replace(
    '/app/auth/complete' + window.location.search + window.location.hash
  )
}

/* ── TWO SITES, TWO DOWNLOADS ──

   Both halves used to be imported here, so every visitor downloaded
   both: somebody opening /app on a phone paid for the whole marketing
   site (166KB) before their Home could appear, and somebody reading a
   blog post paid for the entire app. Measured before this change: one
   1.86MB chunk for everyone.

   Each half is now its own chunk and is fetched only on its own paths.

   The app is asked for AT ONCE rather than when React first renders,
   and so is its language: the two downloads race each other instead of
   queueing behind the entry script. */
const loadApp = () => import('./app/AppRoot.jsx')
const loadSite = () => import('./App.jsx')
const AppRoot = lazy(loadApp)
const Saathban = lazy(loadSite)

const onApp = /^\/app(\/|$)/.test(window.location.pathname)
if (onApp) {
  loadApp().catch(() => { /* the lazy boundary reports it */ })
  preloadStoredLocale()
}

/* ── A CHUNK FROM A BUILD THAT NO LONGER EXISTS ──

   A deploy replaces every hashed file. A page opened before it still
   names the old ones, and the service worker keeps the last builds'
   files for exactly this — but a piece that page never fetched is not
   in any cache, and the server no longer has it. The only honest
   recovery is to load the current build, once. The timestamp stops a
   genuinely offline page from reloading itself in a loop; that case
   falls through to the app's own "could not load" boundary instead. */
window.addEventListener('vite:preloadError', (event) => {
  if (navigator.onLine === false) return
  try {
    const KEY = 'saathban.chunkReloadAt'
    const last = Number(sessionStorage.getItem(KEY) || 0)
    if (Date.now() - last < 30000) return
    sessionStorage.setItem(KEY, String(Date.now()))
  } catch {
    return
  }
  event.preventDefault()
  window.location.reload()
})

/* The app's placeholder is its own ground, so the moment between the
   entry script and the app chunk reads as the app arriving rather than
   as a white page — and it is the same colour LanguageProvider paints,
   so nothing shifts when the real shell replaces it. Wordless on
   purpose: the language has not loaded yet. */
function AppArriving() {
  return <div aria-busy="true" style={{ minHeight: '100vh', background: APP_COLORS.bg }} />
}

/* The marketing site owns every path except /app. It does its own
   ?blog= / ?event= routing internally via pushState, so it stays on the
   catch-all route and is unaffected by the router around it. */
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route
          path="/app/*"
          element={
            <Suspense fallback={<AppArriving />}>
              <AppRoot />
            </Suspense>
          }
        />
        <Route
          path="*"
          element={
            <Suspense fallback={null}>
              <Saathban />
            </Suspense>
          }
        />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
)
