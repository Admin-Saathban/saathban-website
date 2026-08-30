/* ════════════════════════════════════════════════
   More — the weekly and rare tiers (PRODUCT_DECISIONS §3).

   The bar carries the daily tier. Everything else lives here, in two
   labelled groups: the things a person reaches for every week or so,
   then the things they reach for rarely. Two groups rather than one
   long list, because "Settings" and "Out & about" are not the same
   kind of errand and a list that mixes them makes both harder to find.

   Not a hamburger. §3: a hamburger hides everything behind a symbol a
   senior may not read as "menu", so this is a labelled item in the bar
   with a screen of its own, and every row here is a word.

   §0.6: a group with nothing in it for this role is absent, not an
   empty heading. navItems.js does that filtering, so this file draws
   whatever it is handed and never has an empty-state of its own.
   ════════════════════════════════════════════════ */

import { Link } from "react-router-dom";
import { COLORS as C, A11Y } from "../../shared/tokens.js";
import { useI18n } from "../lib/i18n.jsx";
import { useSession } from "../lib/session.jsx";
import AppHeader from "../components/AppHeader.jsx";
import { moreGroups } from "../components/navItems.js";
import useBuddyActive from "../components/useBuddyActive.js";
import { BAR_HEIGHT } from "../components/BottomBar.jsx";

export default function MorePage() {
  const { t, ts } = useI18n();
  const { profile } = useSession();
  const role = profile?.role;
  /* NOT profile.buddy_status — there is no such field, and reading it
     gave every Buddy the shortened list while the bar, which asked
     properly, gave them the full one. */
  const buddyActive = useBuddyActive(role);
  const groups = moreGroups(role, { buddyActive });

  return (
    <>
      <AppHeader />
      <main
        style={{
          minHeight: "100vh",
          background: C.bg,
          color: C.textMain,
          padding: `16px 14px calc(${BAR_HEIGHT}px + 24px)`,
        }}
      >
        <div style={{ maxWidth: 620, margin: "0 auto" }}>
          <h1
            style={{
              fontSize: ts(28),
              fontWeight: 800,
              color: C.green,
              margin: "4px 0 18px",
            }}
          >
            {t("hub.more")}
          </h1>

          {groups.map((g) => (
            <section key={g.id} style={{ marginBottom: 26 }}>
              <h2
                style={{
                  fontSize: ts(A11Y.minBodyPx),
                  fontWeight: 700,
                  color: C.textMuted,
                  margin: "0 0 10px",
                }}
              >
                {t(g.labelKey)}
              </h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {g.items.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                      minHeight: 62,
                      padding: "12px 16px",
                      background: C.white,
                      border: `2px solid ${C.warmGray}`,
                      borderRadius: 16,
                      textDecoration: "none",
                      color: C.textMain,
                      fontSize: ts(A11Y.minBodyPx),
                      fontWeight: 700,
                    }}
                  >
                    <span aria-hidden="true" style={{ fontSize: 26, lineHeight: 1 }}>
                      {item.emoji}
                    </span>
                    <span>{t(item.key)}</span>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>
    </>
  );
}
