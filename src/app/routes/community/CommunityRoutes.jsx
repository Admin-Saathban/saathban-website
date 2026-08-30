/* ════════════════════════════════════════════════
   Community route table — the single entry point for this folder.
   Registered in AppRoot behind RequireAuth (any signed-in role; the
   0014 policies decide who actually sees or writes anything).
   One AppHeader covers every nested page (HEADER_WIRING.md).
   ════════════════════════════════════════════════ */

import { Routes, Route, Navigate } from "react-router-dom";
import AppHeader from "../../components/AppHeader.jsx";
import Feed from "./Feed.jsx";
import Messages from "./Messages.jsx";
import Thread from "./Thread.jsx";
import MessageRequests from "./MessageRequests.jsx";

export default function CommunityRoutes() {
  return (
    <>
      <AppHeader />
      <Routes>
        <Route index element={<Feed />} />
        <Route path="messages" element={<Messages />} />
        {/* §6 — the guarded request screen. Before :requestId in the
            file for readability; react-router ranks the static
            segment higher either way. */}
        <Route path="messages/requests" element={<MessageRequests />} />
        <Route path="messages/:requestId" element={<Thread />} />
        {/* Requests moved to the unified My People inbox (people lane). */}
        <Route path="connect" element={<Navigate to="/app/people/requests" replace />} />
        <Route path="*" element={<Navigate to="/app/community" replace />} />
      </Routes>
    </>
  );
}
