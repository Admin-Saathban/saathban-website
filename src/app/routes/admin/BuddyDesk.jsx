/* ════════════════════════════════════════════════
   /app/admin/buddies and /app/admin/buddies/:id — the vetting queue and
   one application.

   Wide (SPLIT_QUERY): the queue narrows to a list of names beside the
   application, so a reviewer working down the waiting applications never
   loses the queue. Without an application open, the queue is the full
   table across the width. Narrow: one column, the application replacing
   the queue, as before.

   The applications themselves come from AdminLayout's outlet context
   (one fetch for both), so nothing here fetches or audits on its own.
   ════════════════════════════════════════════════ */

import { Outlet, useMatch, useOutletContext } from "react-router-dom";
import BuddyQueue from "./BuddyQueue.jsx";
import useMedia, { SPLIT_QUERY } from "./useMedia.js";

export default function BuddyDesk() {
  const ctx = useOutletContext();
  const match = useMatch("/app/admin/buddies/:id");
  const id = match?.params?.id || null;
  const wide = useMedia(SPLIT_QUERY);
  const split = Boolean(id) && wide;
  const showList = !id || wide;

  return (
    <div className="sb-adm-split" data-split={split ? "yes" : "no"} data-admin-desk="buddies">
      {showList && (
        <div className="sb-adm-split-list">
          <BuddyQueue compact={split} selectedId={id} />
        </div>
      )}
      {id && (
        <div className="sb-adm-split-detail">
          <Outlet context={ctx} />
        </div>
      )}
    </div>
  );
}
