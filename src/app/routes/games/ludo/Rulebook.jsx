/* ════════════════════════════════════════════════
   The rules of the game, as the book on the shelf beside the board.

   SECTION-WISE AND COLLAPSIBLE, because nobody reads a rulebook —
   they look one thing up. Setting up · Moving · Safe squares ·
   Capturing · Jota · Getting home · Winning, all shut, and you open
   the one you came for.

   IT SEARCHES. Typing filters to the passages that match, across
   every section at once, and opens them. That is the difference
   between a rulebook and a wall of text: "can he take me on a star"
   is a question, and a person asking it should not have to know
   which heading it lives under.

   AND IT DESCRIBES THIS TABLE, NOT LUDO IN GENERAL. Half these rules
   are the host's to switch on and off, so every switchable one says
   what it is set to HERE, inline, in the sentence. A book that
   describes a game nobody at this table is playing is worse than no
   book, because it will be believed.

   The passages are data rather than markup so the search has
   something to search. Each carries its own id, its title and its
   body come from the locale files, and a `rule` names the house rule
   whose state to append when there is one.
   ════════════════════════════════════════════════ */

import { useMemo, useState } from "react";
import { A11Y } from "../../../../shared/tokens.js";
import { useI18n } from "../../../lib/i18n.jsx";
import { GAME } from "../gameSurface.js";

/* section → the passages under it. `rule` is the house-rule key whose
   current setting is appended to that passage; `on`/`off` are the two
   sentences it can end with. */
const BOOK = [
  {
    id: "setup",
    items: [
      { id: "seats" },
      { id: "colours" },
      { id: "dice", rule: "dice_count" },
    ],
  },
  {
    id: "moving",
    items: [
      { id: "out" },
      { id: "count" },
      { id: "six", rule: "extra_roll_on_six" },
      { id: "threeSixes", rule: "three_sixes" },
    ],
  },
  { id: "safe", items: [{ id: "stars" }, { id: "sharing" }] },
  {
    id: "capturing",
    items: [{ id: "take" }, { id: "extraTurn" }, { id: "notOnStar" }],
  },
  {
    id: "jota",
    items: [{ id: "what", rule: "jota" }, { id: "half" }, { id: "breaking" }],
  },
  {
    id: "home",
    items: [
      { id: "column" },
      { id: "exact", rule: "exact_home" },
      { id: "captureFirst", rule: "capture_before_home" },
      { id: "another" },
    ],
  },
  { id: "winning", items: [{ id: "four" }, { id: "carryOn" }] },
];

/* What this table has decided, in a sentence. Missing means the
   default, which for every one of these is ON — except capture-first,
   whose default is off. */
function stateOf(rule, rules, t) {
  if (!rule) return null;
  if (rule === "dice_count") {
    const n = Number(rules?.dice_count) || 1;
    return t(n === 2 ? "ludo.book.state.twoDice" : "ludo.book.state.oneDie");
  }
  const off =
    rule === "capture_before_home"
      ? rules?.capture_before_home !== true
      : rules?.[rule] === false;
  return t(off ? "ludo.book.state.off" : "ludo.book.state.on");
}

export default function Rulebook({ rules }) {
  const { t, ts } = useI18n();
  const [open, setOpen] = useState(null);
  const [q, setQ] = useState("");

  /* Every passage, flattened, with the words it can be found by. */
  const passages = useMemo(
    () =>
      BOOK.flatMap((sec) =>
        sec.items.map((it) => {
          const title = t(`ludo.book.${sec.id}.title`);
          const body = t(`ludo.book.${sec.id}.${it.id}`);
          return {
            section: sec.id,
            id: it.id,
            rule: it.rule,
            title,
            body,
            hay: `${title} ${body}`.toLowerCase(),
          };
        })
      ),
    [t]
  );

  const needle = q.trim().toLowerCase();
  const hits = needle ? passages.filter((p) => p.hay.includes(needle)) : null;

  const row = (p) => (
    <p
      key={p.section + p.id}
      style={{
        margin: "0 0 10px",
        fontSize: ts(A11Y.minBodyPx),
        lineHeight: 1.55,
        color: GAME.ink,
      }}
    >
      {p.body}
      {p.rule && (
        <>
          {" "}
          {/* THE SETTING, IN THE SENTENCE. Not a badge beside it: a
              person reading a rule needs to know whether it applies
              here at the moment they read it, and a chip in the
              margin is read second or not at all. */}
          <span style={{ color: GAME.you, fontWeight: 700 }}>
            {stateOf(p.rule, rules, t)}
          </span>
        </>
      )}
    </p>
  );

  return (
    <div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t("ludo.book.search")}
        aria-label={t("ludo.book.search")}
        style={{
          width: "100%",
          minHeight: A11Y.minTapTargetPx,
          padding: "0 14px",
          marginBottom: 12,
          borderRadius: 12,
          border: `1px solid ${GAME.glassEdge}`,
          background: "rgba(255,255,255,0.10)",
          color: GAME.ink,
          fontSize: ts(A11Y.minBodyPx),
          fontFamily: "inherit",
          boxSizing: "border-box",
        }}
      />

      {hits ? (
        hits.length ? (
          /* SEARCH FLATTENS THE BOOK. Somebody looking for a rule
             does not care which heading it lives under, and making
             them open the right section to see a match they have
             already been told exists is a second search. */
          <div>
            {hits.map((p) => (
              <div key={p.section + p.id} style={{ marginBottom: 12 }}>
                <p
                  style={{
                    margin: "0 0 2px",
                    fontSize: ts(13),
                    fontWeight: 800,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: GAME.inkMuted,
                  }}
                >
                  {p.title}
                </p>
                {row(p)}
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: GAME.inkMuted, fontSize: ts(A11Y.minBodyPx), margin: 0 }}>
            {t("ludo.book.nothing", { q: q.trim() })}
          </p>
        )
      ) : (
        BOOK.map((sec) => {
          const isOpen = open === sec.id;
          return (
            <div key={sec.id} style={{ marginBottom: 8 }}>
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : sec.id)}
                aria-expanded={isOpen}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  width: "100%",
                  minHeight: A11Y.minTapTargetPx,
                  padding: "10px 14px",
                  borderRadius: 12,
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
                {t(`ludo.book.${sec.id}.title`)}
                <span aria-hidden="true" style={{ color: GAME.inkMuted }}>
                  {isOpen ? "−" : "+"}
                </span>
              </button>
              {isOpen && (
                <div style={{ padding: "12px 14px 2px" }}>
                  {passages.filter((p) => p.section === sec.id).map(row)}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
