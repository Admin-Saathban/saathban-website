/* ════════════════════════════════════════════════
   Company, not competition — PRODUCT_DECISIONS §5.

   One quiet line at the END of the log, never in the middle:
   "Fatima's logged today too", "Three of your people have logged
   today". It is the SOCIAL third of §5's split, and §5 is explicit
   that it sits last, because a social line in the middle turns
   logging into performing.

   THE APP NEVER NAMES AN ABSENCE. Not softened, not implied, not
   "everyone except Fatima" — never. The rule is kept by the data
   rather than by care here: circle_logged_today() (0081) can only
   return people who DID log, and returns no total, so this component
   has nothing from which to construct a missing person even if
   somebody later tried.

   IT READS NATURALLY AT ONE, TWO OR FIVE. §5 names that requirement
   directly, so the phrasing branches on the count instead of joining
   a list — five names in a row is a roll-call, and a roll-call is a
   scoreboard with commas.

   SOMEBODY WITH NOBODY SEES NOTHING HERE. Not "no one has logged
   today", not an invitation to add people: §0.6 says a section that
   would be empty is ABSENT. Their own thread — the character, the
   record, the quiet line about their week — is the whole screen, and
   it is complete on its own.

   OFFLINE: the last answer is kept on this phone for the person who
   asked (saathban.app.company.<id>, first names only) and shown only on
   the same day it was fetched — yesterday's company is not today's.
   Cleared on sign-out with every other signed-in copy.
   ════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { APP_COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import supabase from "../../lib/supabase.js";
import { COMPANY_CACHE_PREFIX, readUserCache, writeUserCache } from "../../lib/offline.js";
import { isoDate } from "./homeMock.js";

export async function fetchCircleLoggedToday() {
  const { data, error } = await supabase.rpc("circle_logged_today");
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

/* First name only. "Fatima Bibi's logged today too" reads like a
   register; "Fatima's logged today too" reads like a friend. */
function firstName(name) {
  return String(name || "").trim().split(/\s+/)[0] || "";
}

function keptForToday(iconId) {
  if (!iconId) return null;
  const c = readUserCache(COMPANY_CACHE_PREFIX, iconId)?.data;
  return c && c.date === isoDate(new Date()) && Array.isArray(c.people) ? c.people : null;
}

export default function CompanyLine({ iconId }) {
  const { t, ts } = useI18n();
  // null = not answered yet
  const [people, setPeople] = useState(() => keptForToday(iconId));

  useEffect(() => {
    if (!iconId) return undefined;
    let alive = true;
    fetchCircleLoggedToday()
      .then((rows) => {
        writeUserCache(COMPANY_CACHE_PREFIX, iconId, {
          date: isoDate(new Date()),
          people: rows.map((r) => ({ full_name: firstName(r.full_name) })),
        });
        if (alive) setPeople(rows);
      })
      /* A failed probe shows nothing at all — or, offline, what this
         phone already knew about today. The line is a grace note; an
         error message where a kindness should be is worse than
         silence. */
      .catch(() => alive && setPeople((p) => p ?? []));
    return () => {
      alive = false;
    };
  }, [iconId]);

  if (!people || people.length === 0) return null;

  const names = people.map((p) => firstName(p.full_name)).filter(Boolean);
  if (names.length === 0) return null;
  const text =
    names.length === 1
      ? t("home.company.one", { name: names[0] })
      : names.length === 2
      ? t("home.company.two", { a: names[0], b: names[1] })
      : t("home.company.many", { n: names.length });

  return (
    <p
      role="status"
      style={{
        margin: "18px 0 0",
        fontSize: ts(A11Y.minBodyPx),
        color: C.textMuted,
        textAlign: "center",
        lineHeight: 1.55,
      }}
    >
      {text}
    </p>
  );
}
