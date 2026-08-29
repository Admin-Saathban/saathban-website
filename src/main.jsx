import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Saathban from './App.jsx'
import AppRoot from './app/AppRoot.jsx'

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
