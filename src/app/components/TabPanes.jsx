/* ════════════════════════════════════════════════
   The five tab panes, kept alive after their first visit.

   A tab used to unmount the moment you left it, so coming back refetched
   its data and threw away where you had scrolled to. On a feed that is
   the difference between a swipe and a page load.

   MOUNT ON FIRST VISIT, NEVER BEFORE. The obvious keep-alive renders all
   five at launch, and on the phones this app is for that means five
   screens fetching before anybody has asked for anything. A pane appears
   here only once it has been visited; launch still costs exactly one
   screen, and the second visit to a tab costs nothing.

   Hidden panes stay MOUNTED, which is the whole point and also the cost:
   their effects keep running and their subscriptions stay open. That is
   deliberate for the five screens a person moves between, and it is why
   this list is the five tabs rather than every route in the app.

   ─── TWO THINGS THAT MAKE IT WORK, AND BOTH BIT ME FIRST ───

   A ROUTE SUBTREE NEEDS ITS ROUTE CONTEXT. Rendered bare — <HomeRoutes />
   on its own — a subtree resolves its inner paths against the router
   root, so nothing matches: the pane mounted, the shell painted, and the
   page under it was empty. Every pane therefore re-declares the route
   AppRoot used to own, splat and all.

   AND A HIDDEN PANE NEEDS A LOCATION THAT STILL MATCHES. <Routes> renders
   whatever matches the CURRENT location, so the moment you leave a tab
   its own <Routes> would match nothing and unmount the very subtree this
   file exists to hold. Each pane is therefore given the location it was
   last active at, frozen. A hidden Groups pane goes on rendering
   /app/groups for as long as it is away, and comes back exactly as it
   was — which is also why a tab returns to the screen you left it on
   rather than to its root.

   ─── SCROLL ───

   All five panes share the window's scroll, so switching tabs would
   otherwise carry one tab's position onto another. Each pane's position
   is saved on the way out and restored on the way in, and ScrollToTop is
   told to leave tab switches alone — otherwise it would helpfully undo
   the restoration a frame later.
   ════════════════════════════════════════════════ */

import { useEffect, useRef, useState } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { RequireAuth } from "../lib/session.jsx";
import { quietenShutter, revealBars } from "./useShutter.js";
import HomeRoutes from "../routes/home/HomeRoutes.jsx";
import GamesRoutes from "../routes/games/GamesRoutes.jsx";
import OutdoorRoutes from "../routes/outdoor/OutdoorRoutes.jsx";
import GroupsRoutes from "../routes/groups/GroupsRoutes.jsx";
import CommunityRoutes from "../routes/community/CommunityRoutes.jsx";

/* THE GAME WORLD is not the games tab: a ludo table, and the setup
   room that opens onto it. Both are declared before games/* in AppRoot
   for the same reason. If the pane claimed either, it would render
   inside a hidden tab — with the tab underneath it still mounted,
   still holding its header and its scroll. */
const isGameWorld = (p) =>
  /^\/app\/games\/ludo\/[^/]+/.test(p) || /^\/app\/games\/new\/[^/]+/.test(p);

/* `path` is relative to /app, because AppRoot is itself mounted at
   /app/* and these re-create the routes it used to declare. */
const PANES = [
  { key: "games", base: "/app/games", path: "games/*",
    el: () => <RequireAuth><GamesRoutes /></RequireAuth> },
  { key: "outdoor", base: "/app/outdoor", path: "outdoor/*",
    el: () => <RequireAuth><OutdoorRoutes /></RequireAuth> },
  { key: "home", base: "/app/home", path: "home/*",
    el: () => <RequireAuth roles={["saath_icon"]}><HomeRoutes /></RequireAuth> },
  { key: "groups", base: "/app/groups", path: "groups/*",
    el: () => <RequireAuth><GroupsRoutes /></RequireAuth> },
  /* One pane for the community subtree: the feed and the Messages world
     are both under it, so they share a mount and a scroll. */
  { key: "community", base: "/app/community", path: "community/*",
    el: () => <RequireAuth><CommunityRoutes /></RequireAuth> },
];

/* Longest match wins, so a deeper base is never shadowed by a shorter
   one. Exported because AppRoot has to ask the same question — the two
   must never both render a tab. */
export function paneFor(pathname) {
  /* A ludo table and the setup room that opens onto it are not
     tabs. They are full-screen worlds with no app chrome, and a
     pane would keep the Games tab mounted underneath — its
     header, its scroll position, its bar. */
  if (isGameWorld(pathname)) return null;
  let best = null;
  for (const p of PANES) {
    if (pathname === p.base || pathname.startsWith(p.base + "/")) {
      if (!best || p.base.length > best.base.length) best = p;
    }
  }
  return best ? best.key : null;
}

export default function TabPanes() {
  const location = useLocation();
  const active = paneFor(location.pathname);

  /* Insertion order is visit order; a pane never leaves once added. */
  const [visited, setVisited] = useState(() => (active ? [active] : []));
  useEffect(() => {
    if (active && !visited.includes(active)) setVisited((v) => [...v, active]);
  }, [active, visited]);

  /* The location each pane should keep rendering while it is away. */
  const frozen = useRef({});
  if (active) frozen.current[active] = location;

  /* Where each pane was left. */
  const scrolls = useRef({});
  const activeRef = useRef(active);
  activeRef.current = active;

  /* RECORDED AS IT HAPPENS, not read on the way out — and that was the
     bug. Saving window.scrollY when the pane changed looked obviously
     right and captured ZERO every time: hiding a tall pane and showing
     a short one shrinks the document in the same commit, so the browser
     CLAMPS the scroll before any effect of mine runs. Traced on a real
     switch — scrollY 700 with the document at 3930, then immediately
     scroll@0 with the document at 985. There was nothing left to save.

     A listener banks the position under whichever pane is active while
     it is being scrolled. The clamp still fires its scroll event, but
     by then the active pane is the INCOMING one, so it writes 0 against
     that and leaves the outgoing pane's number alone — which is exactly
     what should happen. */
  useEffect(() => {
    const onScroll = () => {
      const k = activeRef.current;
      if (k) scrolls.current[k] = window.scrollY;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!active) return undefined;

    /* THE ARRIVAL, IN ONE PLACE.

       Quieten the shutter, because the restore below is a scroll the APP
       performs and the shutter reads scrolling as intent. Traced on the
       deployed build: the bar held still through the whole drag and then
       slid — 105, 48.8, 4.7 — after the tab had already changed. That is
       the bar obeying a gesture nobody made.

       Reveal the bars, because you should arrive at a tab able to leave
       it, wherever the previous tab happened to be scrolled to.

       And hold the chrome still while both happen, so the bar does not
       animate up the screen while the pane is still arriving — two
       movements arguing is exactly what reads as jitter. */
    quietenShutter(450);
    revealBars();
    const root = document.documentElement;
    root.classList.add("sb-tabswitch");
    const calm = window.setTimeout(() => root.classList.remove("sb-tabswitch"), 260);
    const settle = () => { window.clearTimeout(calm); root.classList.remove("sb-tabswitch"); };
    /* No saved position means a first visit, and a new screen starts at
       the top — without this it would inherit the previous tab's scroll,
       because ScrollToTop stands down for tab switches. */
    const y = scrolls.current[active] ?? 0;
    if (y === 0) { window.scrollTo(0, 0); return settle; }

    /* RESTORING TAKES MORE THAN A FRAME, and one frame is what my first
       version gave it. A pane coming back from display:none has no
       layout until it is shown, so the document is still the height of
       the OUTGOING tab when the next frame runs — scrollTo clamps to
       that height and the position is lost. Measured: 700 became 0.

       So it tries until the document is actually tall enough, over a
       handful of frames, and gives up rather than looping forever if
       the tab genuinely got shorter while it was away. */
    let tries = 0;
    let raf = 0;
    const attempt = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (max >= y || tries > 12) { window.scrollTo(0, Math.min(y, Math.max(max, 0))); return; }
      tries += 1;
      raf = requestAnimationFrame(attempt);
    };
    raf = requestAnimationFrame(attempt);
    return () => { cancelAnimationFrame(raf); settle(); };
  }, [active]);

  if (!visited.length) return null;

  return (
    <>
      {PANES.filter((p) => visited.includes(p.key)).map((p) => (
        <div
          key={p.key}
          /* display:none rather than unmounting — the state, the fetched
             data and the DOM all survive, which is the entire feature. */
          style={{ display: p.key === active ? "block" : "none" }}
          aria-hidden={p.key === active ? undefined : "true"}
        >
          <Routes location={frozen.current[p.key] || location}>
            <Route path={p.path} element={p.el()} />
          </Routes>
        </div>
      ))}
    </>
  );
}
