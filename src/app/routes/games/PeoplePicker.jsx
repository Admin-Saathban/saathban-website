/* People-first picker (0029): the caller's connections — circle,
   friends, group friends — as tappable seat-fillers. The list arrives
   from game_people(), which filters eligibility (a pending/suspended
   Buddy simply isn't in it) and blocks server-side, so nothing shown
   here can fail on tap. Zero connections renders a warm door, never
   an empty grid. */

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { gamePeople } from "../../lib/games.js";
import { BodyText } from "./ui.jsx";

function Face({ person, size = 44 }) {
  const initial = (person.full_name || "?").trim().charAt(0).toUpperCase();
  return person.avatar_url ? (
    <img
      src={person.avatar_url}
      alt=""
      style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover" }}
    />
  ) : (
    <span
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: C.olive,
        color: C.cream,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.45,
        fontWeight: 700,
        flex: "0 0 auto",
      }}
    >
      {initial}
    </span>
  );
}

/* states: {id: 'seated' | 'invited' | 'picked'} — anything else is
   free to tap. onToggle(person) is called only for free/picked. */
export default function PeoplePicker({ states = {}, onToggle, maxPick, pickedCount = 0, searchable = false }) {
  const { t, ts } = useI18n();
  const [people, setPeople] = useState(null); // null = loading
  const [q, setQ] = useState("");

  useEffect(() => {
    let alive = true;
    gamePeople()
      .then((rows) => alive && setPeople(rows))
      .catch(() => alive && setPeople([]));
    return () => {
      alive = false;
    };
  }, []);

  if (people === null) {
    return <BodyText muted role="status">…</BodyText>;
  }

  if (people.length === 0) {
    return (
      <div>
        <BodyText>{t("games.picker.empty")}</BodyText>
        <Link
          to="/app/community/connect"
          style={{
            display: "inline-flex",
            alignItems: "center",
            minHeight: A11Y.minTapTargetPx,
            padding: "0 20px",
            borderRadius: 50,
            border: `2px solid ${C.green}`,
            color: C.green,
            fontSize: ts(A11Y.minBodyPx),
            fontWeight: 600,
            textDecoration: "none",
            marginBottom: 10,
          }}
        >
          🤝 {t("games.picker.emptyConnect")}
        </Link>
        <BodyText muted style={{ margin: 0 }}>
          {t("games.picker.emptyOpen")}
        </BodyText>
      </div>
    );
  }

  // Search narrows the faces; the list itself is already filtered
  // server-side for eligibility and blocks (game_people).
  const needle = q.trim().toLowerCase();
  const shown = needle ? people.filter((p) => (p.full_name || "").toLowerCase().includes(needle)) : people;

  const howLabel = (how) =>
    t(how === "circle" ? "games.picker.howCircle" : how === "friend" ? "games.picker.howFriend" : "games.picker.howGroup");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {searchable && (
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("games.new.searchPh")}
          aria-label={t("games.new.searchPh")}
          style={{
            width: "100%",
            boxSizing: "border-box",
            minHeight: A11Y.minTapTargetPx,
            fontSize: ts(A11Y.minBodyPx),
            fontFamily: "inherit",
            color: C.textMain,
            background: C.white,
            border: "2px solid " + C.warmGray,
            borderRadius: 14,
            padding: "8px 14px",
            marginBottom: 4,
          }}
        />
      )}
      {shown.map((p) => {
        const state = states[p.id];
        const locked = state === "seated" || state === "invited";
        const picked = state === "picked";
        const atMax = maxPick != null && pickedCount >= maxPick && !picked;
        return (
          <button
            key={p.id}
            type="button"
            disabled={locked || atMax}
            aria-pressed={picked}
            onClick={() => onToggle(p)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              minHeight: A11Y.minTapTargetPx + 8,
              padding: "8px 14px",
              background: picked ? "#eef3e8" : C.white,
              border: picked ? `2.5px solid ${C.green}` : `1.5px solid ${C.warmGray}`,
              borderRadius: 16,
              fontFamily: "inherit",
              cursor: locked || atMax ? "default" : "pointer",
              opacity: locked ? 0.75 : atMax ? 0.5 : 1,
              textAlign: "start",
            }}
          >
            <Face person={p} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span
                style={{
                  display: "block",
                  fontSize: ts(A11Y.minBodyPx),
                  fontWeight: 700,
                  color: C.textMain,
                  overflowWrap: "anywhere",
                }}
              >
                {p.full_name}
              </span>
              <span style={{ fontSize: ts(15), color: C.textMuted }}>{howLabel(p.how)}</span>
            </span>
            <span
              style={{
                fontSize: ts(16),
                fontWeight: 700,
                color: picked || locked ? C.green : C.textMuted,
              }}
            >
              {state === "seated"
                ? `🪑 ${t("games.picker.seated")}`
                : state === "invited"
                  ? `✉️ ${t("games.picker.asked")}`
                  : picked
                    ? `✓ ${t("games.picker.picked")}`
                    : "+"}
            </span>
          </button>
        );
      })}
    </div>
  );
}
