/* ════════════════════════════════════════════════
   Saathban app — everything under /app

   Mounted by src/main.jsx at path "/app/*". The marketing
   site (src/App.jsx) owns every other path and is not
   touched by anything in this folder.

   Folder layout:
     app/
       AppRoot.jsx    this file — the /app route table
       routes/        one file per route (SPEC.md, Technical)
       components/    shared app UI primitives
       constants/     role display names, enums — see SPEC.md, Roles
       lib/           supabase client, helpers        (build step 2)
       locales/       en + ur translation files       (Urdu from day one)

   See SPEC.md for the full specification and build order.
   ════════════════════════════════════════════════ */

import { Routes, Route } from "react-router-dom";
import { GOOGLE_FONTS_URL } from "../shared/tokens.js";
import AppHome from "./routes/AppHome.jsx";

export default function AppRoot() {
  return (
    <>
      {/* The marketing site loads its own fonts inside its own components,
          so /app has to ask for them itself. */}
      <style>{`@import url('${GOOGLE_FONTS_URL}');`}</style>

      <Routes>
        <Route index element={<AppHome />} />
        {/* Role selection, auth, and per-role dashboards land here
            in build steps 3-6. */}
        <Route path="*" element={<AppHome />} />
      </Routes>
    </>
  );
}
