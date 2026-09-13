/* ════════════════════════════════════════════════
   /app/admin/people and /app/admin/people/:id — the list and one person.

   Wide (SPLIT_QUERY): the list stays on the left (right, in Urdu) and the
   person opens beside it, so going through several accounts is one tap
   each rather than open, back, scroll, open. The list keeps its place in
   the tree when a person opens, so it is not fetched again — which
   matters, because every people search is written to the audit log.

   Narrow: one column. A person replaces the list, and the list is not
   mounted behind it (a phone would otherwise fetch, and audit, a list
   nobody can see).
   ════════════════════════════════════════════════ */

import { Outlet, useMatch, useOutletContext } from "react-router-dom";
import PeopleList from "./PeopleList.jsx";
import useMedia, { SPLIT_QUERY } from "./useMedia.js";

export default function PeopleDesk() {
  const ctx = useOutletContext();
  const match = useMatch("/app/admin/people/:id");
  const id = match?.params?.id || null;
  const wide = useMedia(SPLIT_QUERY);
  const split = Boolean(id) && wide;
  const showList = !id || wide;

  return (
    <div className="sb-adm-split" data-split={split ? "yes" : "no"} data-admin-desk="people">
      {showList && (
        <div className="sb-adm-split-list">
          <PeopleList compact={split} selectedId={id} />
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
