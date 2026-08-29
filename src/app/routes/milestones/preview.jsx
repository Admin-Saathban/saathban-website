/* Entry for preview.html — mounts the milestones lane standalone with
   the real providers and a memory router. Dev-only. */

import React from "react";
import ReactDOM from "react-dom/client";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { LanguageProvider } from "../../lib/i18n.jsx";
import { AuthProvider } from "../../lib/session.jsx";
import MilestonesRoutes from "./MilestonesRoutes.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <LanguageProvider>
      <AuthProvider>
        <MemoryRouter initialEntries={["/milestones"]}>
          <Routes>
            <Route path="milestones/*" element={<MilestonesRoutes />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </LanguageProvider>
  </React.StrictMode>
);
