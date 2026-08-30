/* ════════════════════════════════════════════════
   Where the bottom bar appears, and where it must not.

   PRODUCT_DECISIONS §3 replaces the home card grid with a bar, but a
   bar that exists only on the home screen is not navigation — it is a
   grid with a different shape. It has to be underfoot everywhere, so
   it is mounted once here, at the app shell, rather than by each
   screen remembering to.

   IT IS ABSENT IN FOUR PLACES, each for its own reason:

   - Signed out, and anywhere under /app/auth. There is nowhere to
     navigate to and the bar would be an invitation into a wall.
   - Admins. §18 gives them a worklist, not a daily life in the app;
     Home/Community/Games/People is not their screen.
   - The ludo play screen. It is a fixed 100dvh viewport that sizes the
     board into exactly the space left over, and a bar laid over it
     would cover the bottom seat plate, or shrink the board to make
     room for navigation nobody wants mid-turn. The way out of a game
     is the door in its own top bar.
   - The public pages a stranger can open — a shared game result, a
     join link — where the person may have no account at all.

   A BUDDY BEFORE `active` GETS A SHORTER BAR, not a greyed-out one.
   Their status lives on their application row rather than the
   profile, so it is read once here and handed down. While it is
   unknown the bar renders as if active: the alternative is a bar that
   changes shape a second after every page load, which is worse than a
   bar that is briefly generous. Every destination behind it enforces
   its own access anyway — this is navigation, RLS is the boundary.
   ════════════════════════════════════════════════ */

import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useSession } from "../lib/session.jsx";
import BottomBar, { BAR_HEIGHT } from "./BottomBar.jsx";
import useBuddyActive from "./useBuddyActive.js";

const HIDDEN_PREFIXES = ["/app/auth", "/app/admin", "/app/g/", "/app/join/"];

/* A ludo session is /app/games/ludo/<id> — the list at
   /app/games/ludo keeps its bar. */
const isLudoTable = (path) => /^\/app\/games\/ludo\/[^/]+/.test(path);

export default function AppShellBar() {
  const { profile } = useSession();
  const { pathname } = useLocation();
  const role = profile?.role;
  const buddyActive = useBuddyActive(role);

  const hidden =
    !profile ||
    !role ||
    HIDDEN_PREFIXES.some((p) => pathname.startsWith(p)) ||
    isLudoTable(pathname);

  /* A FIXED BAR RESERVES NO SPACE, so the last thing on every screen
     would sit underneath it — which for a screen ending in a button
     means a button that cannot be pressed. Rather than adding padding
     to forty screens and to every screen written after this one, the
     shell pays for its own chrome: body padding while the bar is up,
     removed the moment it is not. */
  useEffect(() => {
    if (hidden) return undefined;
    const prev = document.body.style.paddingBottom;
    document.body.style.paddingBottom = `calc(${BAR_HEIGHT}px + env(safe-area-inset-bottom, 0px))`;
    return () => {
      document.body.style.paddingBottom = prev;
    };
  }, [hidden]);

  if (hidden) return null;

  return <BottomBar role={role} buddyActive={buddyActive} />;
}
