/* ════════════════════════════════════════════════
   Width, and only width.

   The panel changes shape by how wide the window is — never by what
   device it thinks it is on. Most of that is CSS (media and container
   queries in AdminLayout and the screens). This hook is for the one
   decision CSS cannot make: whether a list and the thing opened from it
   are MOUNTED side by side, or the list is left out so that a phone does
   not fetch (and audit) a list nobody can see.
   ════════════════════════════════════════════════ */

import { useEffect, useState } from "react";

/* The side navigation stays put from here up; below it, a drawer. */
export const SIDE_NAV_QUERY = "(min-width: 900px)";
/* A list and what it opens sit side by side from here up. */
export const SPLIT_QUERY = "(min-width: 1200px)";

export default function useMedia(query) {
  const read = () => typeof window !== "undefined" && Boolean(window.matchMedia?.(query).matches);
  const [matches, setMatches] = useState(read);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatches(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [query]);
  return matches;
}
