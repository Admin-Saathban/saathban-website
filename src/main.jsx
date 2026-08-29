import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Saathban from './App.jsx'
import AppRoot from './app/AppRoot.jsx'

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

/* The marketing site owns every path except /app. It does its own
   ?blog= / ?event= routing internally via pushState, so it stays on the
   catch-all route and is unaffected by the router around it. */
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/app/*" element={<AppRoot />} />
        <Route path="*" element={<Saathban />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
)
