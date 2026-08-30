/* ════════════════════════════════════════════════
   Groups route table — the single entry point for this folder. NOT
   registered in AppRoot.jsx; GROUPS_WIRING.md holds the one-line
   registration. AppHeader here matches the other signed-in lanes.
   ════════════════════════════════════════════════ */

import { Routes, Route, Navigate } from "react-router-dom";
import AppHeader from "../../components/AppHeader.jsx";
import GroupsList from "./GroupsList.jsx";
import CreateGroup from "./CreateGroup.jsx";
import GroupPage from "./GroupPage.jsx";
import GroupManage from "./GroupManage.jsx";

export default function GroupsRoutes() {
  return (
    <>
      <AppHeader />
      <Routes>
        <Route index element={<GroupsList />} />
        <Route path="new" element={<CreateGroup />} />
        <Route path=":id" element={<GroupPage />} />
        {/* GROUPS_SPEC section 7 — reached from the group's three dots.
            Members see none of it; the screen says so rather than
            rendering an empty version of itself. */}
        <Route path=":id/manage" element={<GroupManage />} />
        <Route path="*" element={<Navigate to="/app/groups" replace />} />
      </Routes>
    </>
  );
}
