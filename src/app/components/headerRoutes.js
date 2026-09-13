/* ════════════════════════════════════════════════
   Where the app header does not appear — ONE list.

   It lived inside AppHeader.jsx. The tab swipe now has to ask the same
   question about the tab a finger is heading to (does the screen I am
   bringing in have the header above it?), and a second copy of this list
   would be a second list that has to agree with the first.

   Game worlds are answered separately in AppHeader, because no tab a
   swipe can reach is a game world.
   ════════════════════════════════════════════════ */

export const NO_HEADER = ["/app/auth", "/app/g/", "/app/join/", "/app/community/messages"];

export function headerShownOn(pathname) {
  return !NO_HEADER.some((q) => (pathname || "").startsWith(q));
}
