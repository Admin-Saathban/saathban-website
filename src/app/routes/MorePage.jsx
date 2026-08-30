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
import { shouldPulse } from "./profile/profileFields.js";
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
  /* PRODUCT_DECISIONS §8 / TONIGHT.md §6 — the soft dot. The user
     completed their profile without ever being told it was
     incomplete, because nothing anywhere said so. It is an
     invitation, not an error: no red, no badge count, no percentage.
     It stops once dismissed and returns at most weekly. */
  const pulseProfile = shouldPulse(profile);

  const DOT_CSS = `
    @keyframes saath-pulse-dot {
      0%, 100% { opacity: 0.55; transform: scale(0.9); }
      50%      { opacity: 1;    transform: scale(1.12); }
    }
    .sb-pulse-dot { animation: saath-pulse-dot 2.4s ease-in-out infinite; }
    @media (prefers-reduced-motion: reduce) {
      /* Stops moving, stays visible: the dot is the message, the
         pulse is only emphasis. */
      .sb-pulse-dot { animation: none; opacity: 1; }
    }
  `;

  return (
    <>
      <style>{DOT_CSS}</style>
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
              {/* NAVIGATION_SPEC §6 deleted the group headers —
                 "Every so often" and "Now and then" were synonyms, so
                 a person could not predict which one held what. The
                 single group navItems now returns carries labelKey:
                 null, and a heading is drawn only if one comes back. */}
              {g.labelKey && (
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
              )}
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
                    <span style={{ flex: 1 }}>{t(item.key)}</span>
                    {item.to === "/app/profile" && pulseProfile && (
                      /* Carried by POSITION and a word, never by the
                         dot alone (§0.1): a person who cannot see the
                         colour still reads "something to add". */
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 8,
                          fontSize: ts(A11Y.minBodyPx),
                          fontWeight: 600,
                          color: C.greenMuted,
                        }}
                      >
                        {t("profile.somethingToAdd")}
                        <span
                          className="sb-pulse-dot"
                          aria-hidden="true"
                          style={{
                            width: 12,
                            height: 12,
                            borderRadius: "50%",
                            background: C.sage,
                            flexShrink: 0,
                          }}
                        />
                      </span>
                    )}
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
