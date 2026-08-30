/* ════════════════════════════════════════════════
   People route table — /app/people/:profileId (profile) and /chat
   (the DM thread). Registered in AppRoot for any signed-in role:
   what a viewer may see is decided by RLS (safe_profiles for the
   public fields, circle_members for the connection, dm_* for the
   thread), never by this navigation.
   ════════════════════════════════════════════════ */

import { Navigate, Route, Routes } from "react-router-dom";
import AppHeader from "../../components/AppHeader.jsx";
import { COLORS as C } from "../../../shared/tokens.js";
import PersonPage from "./PersonPage.jsx";
import ThreadPage from "./ThreadPage.jsx";
import PeopleList from "./PeopleList.jsx";
import RequestsPage from "./RequestsPage.jsx";
import InvitePage from "./InvitePage.jsx";

function Screen({ children }) {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: C.bg,
        color: C.textMain,
        padding: "20px 16px 64px",
      }}
    >
      <div style={{ maxWidth: 640, margin: "0 auto" }}>{children}</div>
    </main>
  );
}

export default function PeopleRoutes() {
  return (
    <>
      <AppHeader />
      <Screen>
        <Routes>
          <Route index element={<PeopleList />} />
          <Route path="requests" element={<RequestsPage />} />
          {/* Before :profileId in the file for readability; react-router
              ranks the static segment higher either way. */}
          <Route path="invite" element={<InvitePage />} />
          <Route path=":profileId" element={<PersonPage />} />
          <Route path=":profileId/chat" element={<ThreadPage />} />
          <Route path="*" element={<Navigate to="/app/people" replace />} />
        </Routes>
      </Screen>
    </>
  );
}
