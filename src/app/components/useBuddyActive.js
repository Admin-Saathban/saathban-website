/* ════════════════════════════════════════════════
   Is this Buddy through vetting?

   It matters to navigation because §0.6 says an item a role cannot use
   is absent rather than present-and-dead, and a Buddy before `active`
   has no Icons, no community and no games.

   THIS EXISTS BECAUSE THE TWO PLACES THAT ASK DISAGREED. The bottom
   bar queried buddy_applications; the More screen read
   `profile.buddy_status`, a field that does not exist on the profile —
   so it was undefined, always, and every Buddy got the shortened More
   while an active one got the full bar. Four items in the bar, three
   groups' worth of destinations missing behind it, and both screens
   entirely confident.

   The lesson is the ordinary one: two readers of the same fact will
   drift, and the fix is one reader. Nothing else may ask this question
   its own way.

   While the answer is unknown it returns true — generous. A bar that
   changes shape a second after every page load is worse than one that
   briefly offers a door the destination itself will close, and every
   destination enforces its own access at the database regardless.
   ════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import supabase from "../lib/supabase.js";

export default function useBuddyActive(role) {
  const [active, setActive] = useState(true);

  useEffect(() => {
    let alive = true;
    if (role !== "saath_buddy") {
      setActive(true);
      return undefined;
    }
    (async () => {
      try {
        const { data } = await supabase
          .from("buddy_applications")
          .select("status")
          .order("created_at", { ascending: false })
          .limit(1);
        if (alive) setActive((data || [])[0]?.status === "active");
      } catch {
        /* unknown stays generous */
      }
    })();
    return () => {
      alive = false;
    };
  }, [role]);

  return active;
}
