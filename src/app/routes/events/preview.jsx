/* Entry for preview.html — mounts the events lane standalone with the
   real providers (language, auth) and a memory router. Dev-only. */

import React from "react";
import ReactDOM from "react-dom/client";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { LanguageProvider } from "../../lib/i18n.jsx";
import { AuthProvider } from "../../lib/session.jsx";
import EventsRoutes from "./EventsRoutes.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <LanguageProvider>
      <AuthProvider>
        <MemoryRouter initialEntries={["/events"]}>
          <Routes>
            <Route path="events/*" element={<EventsRoutes />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </LanguageProvider>
  </React.StrictMode>
);
