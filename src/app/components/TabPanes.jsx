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

   ─── FOUR OF THE FIVE ARE THEIR OWN DOWNLOADS ───

   Home is in the app's first chunk: it is where an Icon lands, and the
   daily log has to open offline. Games, Out & about, Groups and
   Community are fetched separately (lib/lazyScreen.jsx), so launching
   Home no longer means downloading and parsing four other screens and
   the parked game boards under Games.

   What keeps that from reintroducing the swipe problem below: a pane is
   never MOUNTED before its code is here. The idle pre-mount of the two
   neighbours fetches their chunks first and mounts them after, so the
   mount is synchronous and no gesture ever meets a placeholder. The
   other two tabs' chunks are fetched a little later, also at idle, so a
   tap on the bar normally finds them ready too. Each pane still has its
   own Suspense, for the rare tap that beats the download — it fills
   only that pane, with the app's ground, and never the header or bar.
   ════════════════════════════════════════════════ */

import { Suspense, useEffect, useRef, useState } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { RequireAuth, useSession } from "../lib/session.jsx";
import { lazyScreen, whenIdle, ScreenArriving, ScreenLoadBoundary } from "../lib/lazyScreen.jsx";
import { isOnline } from "../lib/offline.js";
import { quietenShutter, revealBars, freezeShutter, thawShutter } from "./useShutter.js";
import HomeRoutes from "../routes/home/HomeRoutes.jsx";

/* Exported because AppRoot renders the same subtrees for the paths that
   are not panes (the game world under games/*). One component each, so
   a chunk fetched for one is the chunk used by the other. */
export const GamesRoutes = lazyScreen(() => import("../routes/games/GamesRoutes.jsx"));
export const OutdoorRoutes = lazyScreen(() => import("../routes/outdoor/OutdoorRoutes.jsx"));
export const GroupsRoutes = lazyScreen(() => import("../routes/groups/GroupsRoutes.jsx"));
export const CommunityRoutes = lazyScreen(() => import("../routes/community/CommunityRoutes.jsx"));

/* THE GAME WORLD is not the games tab: a ludo table, and the setup
   room that opens onto it. Both are declared before games/* in AppRoot
   for the same reason. If the pane claimed either, it would render
   inside a hidden tab — with the tab underneath it still mounted,
   still holding its header and its scroll. */
const isGameWorld = (p) =>
  /^\/app\/games\/ludo\/[^/]+/.test(p) ||
  /^\/app\/games\/snakes\/[^/]+/.test(p) ||
  /^\/app\/games\/new\/[^/]+/.test(p);

/* `path` is relative to /app, because AppRoot is itself mounted at
   /app/* and these re-create the routes it used to declare.
   `preload` fetches a pane's code without mounting it; Home has none
   because it is already here. */
const PANES = [
  { key: "games", base: "/app/games", path: "games/*", preload: GamesRoutes.preload,
    el: () => <RequireAuth><GamesRoutes /></RequireAuth> },
  { key: "outdoor", base: "/app/outdoor", path: "outdoor/*", preload: OutdoorRoutes.preload,
    el: () => <RequireAuth><OutdoorRoutes /></RequireAuth> },
  /* `roles`: who may have this pane PRE-MOUNTED as a neighbour. Home is
     Icon-only, and a hidden Home pane mounted for anyone else renders
     RequireAuth's redirect — which navigates the whole app. For an admin
     standing on Out & about or Groups that yanked them into the panel at
     the first idle moment. */
  { key: "home", base: "/app/home", path: "home/*", preload: null, roles: ["saath_icon"],
    el: () => <RequireAuth roles={["saath_icon"]}><HomeRoutes /></RequireAuth> },
  { key: "groups", base: "/app/groups", path: "groups/*", preload: GroupsRoutes.preload,
    el: () => <RequireAuth><GroupsRoutes /></RequireAuth> },
  /* One pane for the community subtree: the feed and the Messages world
     are both under it, so they share a mount and a scroll. */
  { key: "community", base: "/app/community", path: "community/*", preload: CommunityRoutes.preload,
    el: () => <RequireAuth><CommunityRoutes /></RequireAuth> },
];

const preloadPane = (key) => {
  const p = PANES.find((x) => x.key === key);
  /* Home has no separate chunk, so it is always "here". A pane whose
     preload resolves to null did not arrive (offline, or a failed fetch). */
  return p && p.preload ? p.preload() : Promise.resolve(true);
};

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
  const { session, profile, loading } = useSession();
  const role = profile?.role;
  /* ── A HIDDEN PANE NEVER REDIRECTS ──

     Found on the deployed build: signed out, open /app/community and the
     tab froze — /app/auth/login was navigated to 200-300 times a second
     and the email field never appeared.

     The cause is this file plus RequireAuth. The active pane's RequireAuth
     redirects to login once, correctly. The Community pane then stays
     MOUNTED as a hidden pane still rendering its frozen /app/community, so
     its RequireAuth renders <Navigate to=login state={{ from }}> again.
     React Router's Navigate navigates in an effect keyed on `state`, and
     `{ from }` is a new object on every render — so every render
     navigates, every navigation re-renders the panes, and round it goes.

     So a pane that is not the one on screen is rendered only for someone
     signed in, and only if their role may open it. The pane on screen
     still renders whatever its guard says — that is the single redirect
     that should happen. */
  const signedIn = Boolean(session && profile);
  const mayHold = (p) =>
    p.key === active || (signedIn && (!p.roles || p.roles.includes(role)));

  /* Insertion order is visit order; a pane never leaves once added. */
  const [visited, setVisited] = useState(() => (active ? [active] : []));
  useEffect(() => {
    if (active && !visited.includes(active)) setVisited((v) => [...v, active]);
  }, [active, visited]);

  /* ── AND THE TWO NEXT DOOR, ONCE NOBODY IS DOING ANYTHING ──

     The owner reports that only ONE swipe direction misbehaves, and
     that is the fact this exists to answer. Going BACK reaches a pane
     that has been visited: it is in the document, it has its data, it
     is as tall as it was. Going FORWARD often reaches one that is not
     there at all — so the commit mounts a whole screen, which arrives
     empty and grows as it fetches. A page that briefly cannot scroll is
     a page whose browser re-reports its own insets, and that is the
     twenty-four pixels the bar drops. One direction changes the
     document's height and the other does not; only one of them moves
     the bar.

     Mounting on arrival would trade the swipe's problem for the launch
     problem this file was written to avoid — five screens fetching
     before anybody has asked for anything. So the neighbours are
     mounted only AFTER the person has settled on a tab and the browser
     has nothing else to do. Launch still costs exactly one screen; by
     the time a finger lands, the screens either side of it are already
     there and no gesture ever mounts anything.

     Idle, not a timer: on a phone that is still painting the screen
     somebody just opened, this must be the last thing that happens.

     CODE FIRST, THEN THE MOUNT. A neighbour's chunk is fetched before it
     is added, so what mounts is already here and nothing suspends. */
  useEffect(() => {
    /* Nobody signed in: nothing to pre-mount, and a pre-mounted pane would
       only be a guard waiting to redirect. */
    if (!active || !signedIn) return undefined;
    const here = PANES.findIndex((p) => p.key === active);
    if (here < 0) return undefined;
    const want = [PANES[here - 1], PANES[here + 1]]
      .filter((p) => p && (!p.roles || p.roles.includes(role)))
      .map((p) => p.key);
    if (want.every((k) => visited.includes(k))) return undefined;

    let cancelled = false;
    const add = () => {
      if (cancelled) return;
      /* No connection: nothing to fetch, so nothing to pre-mount. Tried
         again when the connection comes back (listener below). */
      if (!isOnline()) return;
      Promise.all(want.map(preloadPane)).then((got) => {
        if (cancelled) return;
        const arrived = want.filter((k, i) => Boolean(got[i]));
        if (!arrived.length) return;
        /* A LOCATION FIRST, OR THE PANE MOUNTS EMPTY AND NOTHING IS SAVED.

           Every pane renders <Routes location={the one it was last active
           at}>, and a pane that has never been active has none — so it
           falls back to the CURRENT location, which belongs to a
           different tab and matches none of its routes. The div appears,
           renders nothing, costs nothing, and the screen is still mounted
           from scratch on arrival. The pre-mount would have been a
           no-op that looked like a fix, which is the failure mode this
           whole session is about.

           So an unvisited neighbour is given its own root as the place it
           is standing. The line above — frozen.current[active] = location
           — overwrites this with the real thing the moment the person
           actually goes there. */
        arrived.forEach((k) => {
          if (!frozen.current[k]) {
            const base = PANES.find((p) => p.key === k).base;
            frozen.current[k] = { pathname: base, search: "", hash: "", state: null, key: "pre-" + k };
          }
        });
        setVisited((v) => (arrived.every((k) => v.includes(k)) ? v : [...v, ...arrived.filter((k) => !v.includes(k))]));
      });
    };
    const cancelIdle = whenIdle(add, 4000);
    const onOnline = () => whenIdle(add, 4000);
    window.addEventListener("online", onOnline);
    return () => {
      cancelled = true;
      cancelIdle();
      window.removeEventListener("online", onOnline);
    };
  }, [active, visited, role, signedIn]);

  /* SIGNED OUT FOR REAL (not merely resolving): forget the kept tabs, where
     they were frozen and how far they were scrolled. The next person to
     sign in on this phone starts from their own first screen, not from
     the previous person's panes coming back into view. */
  useEffect(() => {
    if (loading || session) return;
    setVisited((v) => {
      const keep = active ? [active] : [];
      return v.length === keep.length && v.every((k, i) => k === keep[i]) ? v : keep;
    });
    for (const k of Object.keys(frozen.current)) if (k !== active) delete frozen.current[k];
    scrolls.current = {};
  }, [loading, session, active]);

  /* The two tabs further away: code only, never a mount. Later and at
     idle, so it never competes with the screen being opened. */
  useEffect(() => {
    if (!active) return undefined;
    const run = () => { if (isOnline()) PANES.forEach((p) => p.preload && p.preload()); };
    const cancel = whenIdle(run, 8000);
    const onOnline = () => whenIdle(run, 8000);
    window.addEventListener("online", onOnline);
    return () => {
      cancel();
      window.removeEventListener("online", onOnline);
    };
    // Once per app life is enough; preload is idempotent anyway.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Boolean(active)]);

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
    /* ── THE HOLD IS HANDED OVER HERE, NOT DROPPED ──

       quietenShutter is a 450ms timer and the arrival is not a fixed
       450ms — it is a pane coming back from display:none, a scroll
       restore that takes as many frames as the layout needs, and on a
       first visit a fetch. A timer that expires in the middle of that
       is the bar deciding it has heard a gesture, and the gesture it
       heard was the page settling.

       So the arrival TAKES A HOLD of its own and gives it back when it
       is genuinely finished. useTabSwipe is still holding when this
       runs — it lets go two frames later — so the two overlap and
       there is never an instant with nobody holding, which is the
       whole reason the shutter counts holders rather than flagging one.

       The quieten stays underneath as the floor: this effect also runs
       for a tab change that was a TAP on the bar rather than a swipe,
       and that one has no gesture holding anything. */
    freezeShutter();
    let held = true;
    const release = () => { if (held) { held = false; thawShutter(); } };
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
    if (y === 0) {
      window.scrollTo(0, 0);
      /* A new tab starts at the top and has nothing to restore, so the
         only thing left to settle is the scrollTo above. One frame. */
      const go = requestAnimationFrame(release);
      return () => { cancelAnimationFrame(go); release(); settle(); };
    }

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
      if (max >= y || tries > 12) {
        window.scrollTo(0, Math.min(y, Math.max(max, 0)));
        /* One more frame before letting go: the scrollTo above fires
           its scroll event after this function returns, and releasing
           on the same line would hand the shutter the app's own
           restore as the first thing it hears. */
        raf = requestAnimationFrame(release);
        return;
      }
      tries += 1;
      raf = requestAnimationFrame(attempt);
    };
    raf = requestAnimationFrame(attempt);
    return () => { cancelAnimationFrame(raf); release(); settle(); };
  }, [active]);

  if (!visited.length) return null;

  return (
    <>
      {PANES.filter((p) => visited.includes(p.key) && mayHold(p)).map((p) => (
        <div
          key={p.key}
          data-sb-pane={p.key}
          /* display:none rather than unmounting — the state, the fetched
             data and the DOM all survive, which is the entire feature. */
          style={{ display: p.key === active ? "block" : "none" }}
          aria-hidden={p.key === active ? undefined : "true"}
        >
          <ScreenLoadBoundary resetKey={p.key === active ? location.pathname : p.key}>
            <Suspense fallback={<ScreenArriving />}>
              <Routes location={frozen.current[p.key] || location}>
                <Route path={p.path} element={p.el()} />
              </Routes>
            </Suspense>
          </ScreenLoadBoundary>
        </div>
      ))}
    </>
  );
}
