/* ════════════════════════════════════════════════
   The house rules, on a screen of their own.

   WHAT THIS REPLACES. Every rule was a full-width switch stacked down
   the setup room: six toggles, a five-way timer, a two-way memory and
   a teams switch, between the dice choice and Start. The owner's word
   was "a wall", and a wall is exactly what a column of nine identical
   controls is — nothing on it is more important than anything else,
   so none of it is read and Start is a scroll away.

   Setup is short now — seats, dice, board, Start — with one small
   button under the dice that opens this. Almost nobody changes a
   house rule; the people who do are looking for it, and a person
   looking for something is happy to press one button to find it.

   IN THE SETTINGS-MENU LANGUAGE, deliberately: collapsible sections
   on the midnight panel surface, the same shape as the sheet inside a
   table. Somebody who has opened the settings menu once already knows
   how this works, and the rules of a table should look the same
   before it starts and while it is being played.

   NOT A SHEET. It is a whole screen that replaces the room, because a
   sheet over the setup room would put a second scrolling surface on
   top of one that already scrolls. That also makes the way back an
   ordinary back control rather than a scrim, which is the one thing
   the owner has been most consistent about.

   THE SECTIONS ARE THE QUESTIONS SOMEBODY ACTUALLY ASKS — how a turn
   works, what happens when pieces meet, how a goti gets home — rather
   than the order the switches happened to be written in.
   ════════════════════════════════════════════════ */

import { useState } from "react";
import { A11Y } from "../../../../shared/tokens.js";
import { useI18n } from "../../../lib/i18n.jsx";
import { GAME, NO_SELECT } from "../gameSurface.js";
import useBackToClose from "../../../components/useBackToClose.js";

function Section({ id, open, onToggle, title, children, ts }) {
  const isOpen = open === id;
  return (
    <div style={{ marginBottom: 10 }}>
      <button
        type="button"
        onClick={() => onToggle(isOpen ? null : id)}
        aria-expanded={isOpen}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          width: "100%",
          minHeight: A11Y.minTapTargetPx + 4,
          padding: "10px 14px",
          borderRadius: 14,
          border: `1px solid ${GAME.glassEdge}`,
          background: GAME.glass,
          color: GAME.ink,
          fontSize: ts(A11Y.minBodyPx),
          fontWeight: 700,
          fontFamily: "inherit",
          cursor: "pointer",
          textAlign: "start",
          boxSizing: "border-box",
        }}
      >
        {title}
        <span aria-hidden="true" style={{ color: GAME.inkMuted }}>
          {isOpen ? "−" : "+"}
        </span>
      </button>
      {isOpen && <div style={{ padding: "12px 2px 4px" }}>{children}</div>}
    </div>
  );
}

/* How many of a section's switches are on, so a shut section still
   says something. A row reading "3 of 3 on" is the reason somebody
   can leave it shut. */
function tally(flags, t) {
  const on = flags.filter(Boolean).length;
  return t("games.setup.rulesOnOf", { on, of: flags.length });
}

export default function HouseRulesScreen({ onBack, sections, ts }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(null);
  /* The back gesture returns to the table being set, rather than
     leaving the game world from a screen whose only visible way out
     is a back control that goes somewhere else. */
  useBackToClose(true, onBack);

  return (
    <div style={{ ...NO_SELECT }}>
      <button
        type="button"
        onClick={onBack}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          minHeight: A11Y.minTapTargetPx,
          padding: "0 16px 0 12px",
          marginBottom: 16,
          borderRadius: 12,
          border: `1px solid ${GAME.glassEdge}`,
          background: GAME.glass,
          color: GAME.ink,
          fontFamily: "inherit",
          fontSize: ts(A11Y.minBodyPx),
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        <span aria-hidden="true">‹</span>
        {t("games.setup.backToTable")}
      </button>

      <h1
        style={{
          margin: "0 0 4px",
          fontSize: ts(26),
          fontWeight: 800,
          color: GAME.ink,
        }}
      >
        {t("games.setup.houseRules")}
      </h1>
      <p style={{ margin: "0 0 18px", fontSize: ts(16), lineHeight: 1.45, color: GAME.inkMuted }}>
        {t("games.setup.houseRulesHint")}
      </p>

      {sections.map((sec) => (
        <Section
          key={sec.id}
          id={sec.id}
          open={open}
          onToggle={setOpen}
          ts={ts}
          title={
            <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span>{sec.title}</span>
              {sec.flags && sec.flags.length > 0 && (
                <span style={{ fontSize: ts(14), fontWeight: 500, color: GAME.inkMuted }}>
                  {tally(sec.flags, t)}
                </span>
              )}
            </span>
          }
        >
          {sec.body}
        </Section>
      ))}
    </div>
  );
}
