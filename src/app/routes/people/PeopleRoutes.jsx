/* ════════════════════════════════════════════════
   People route table — /app/people/:profileId (profile) and /chat
   (the DM thread). Registered in AppRoot for any signed-in role:
   what a viewer may see is decided by RLS (safe_profiles for the
   public fields, circle_members for the connection, dm_* for the
   thread), never by this navigation.
   ════════════════════════════════════════════════ */

import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { APP_COLORS as C } from "../../../shared/tokens.js";
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

function ChatRedirect() {
  const { profileId } = useParams();
  return <Navigate to={`/app/community/messages/with/${profileId}`} replace />;
}

export default function PeopleRoutes() {
  return (
    <>
      <Screen>
        <Routes>
          <Route index element={<PeopleList />} />
          <Route path="requests" element={<RequestsPage />} />
          {/* Before :profileId in the file for readability; react-router
              ranks the static segment higher either way. */}
          <Route path="invite" element={<InvitePage />} />
          <Route path=":profileId" element={<PersonPage />} />
          {/* THE OLD ADDRESS SURVIVES AS A DOOR, not as a screen. Bell
              deep-links, notification links and anything already sent to
              somebody still point here; they now open the Messages world
              at that thread instead of rendering a bare chat with the app
              bars around it. */}
          <Route path=":profileId/chat" element={<ChatRedirect />} />
          <Route path="*" element={<Navigate to="/app/people" replace />} />
        </Routes>
      </Screen>
    </>
  );
}
