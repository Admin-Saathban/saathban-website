/* ════════════════════════════════════════════════
   Community route table — the single entry point for this folder.
   Registered in AppRoot behind RequireAuth (any signed-in role; the
   0014 policies decide who actually sees or writes anything).

   MESSAGES IS NOW A WORLD, not a page under this header
   (MESSAGES_SPEC §1). It renders as a full-screen overlay with its
   own three-item bar, so it is mounted OUTSIDE the AppHeader that
   covers the rest of this folder — a world with two headers is not a
   world. Everything that used to link to /app/community/messages
   still lands in it, because the path did not move.
   ════════════════════════════════════════════════ */

import { Routes, Route, Navigate } from "react-router-dom";
import AppHeader from "../../components/AppHeader.jsx";
import Feed from "./Feed.jsx";
import MessagesWorld from "../messages/MessagesWorld.jsx";

export default function CommunityRoutes() {
  return (
    <Routes>
      {/* The world: no AppHeader, no app bar — it covers both. */}
      <Route path="messages/*" element={<MessagesWorld />} />

      <Route path="" element={<><AppHeader /><Feed /></>} />
      {/* §2.1 — "Connect with Saath-Icons" promised finding people and
         landed on the Requests inbox, which is people who had already
         found you. The label and the destination were two different
         features. Finding people is unified search now, so that is
         where an old link goes; the inbox keeps its own path and its
         own badge, which is where §2.1 puts it. */}
      <Route path="connect" element={<Navigate to="/app/search" replace />} />
      <Route path="*" element={<Navigate to="/app/community" replace />} />
    </Routes>
  );
}
