/* ════════════════════════════════════════════════
   New chat — the pencil's replacement, INSIDE the world.

   What was here before was a pencil glyph linking to /app/people. Two
   faults in one control:

   1. An icon nobody can read. A pencil means "compose" to people who
      have used software that taught them so. It is not a picture of
      anything a person recognises, and this app's users are the least
      likely to have been taught it.
   2. It left the world. Tapping it landed on My People with the app
      header and bottom bar back, and nothing announced the departure —
      the person was simply somewhere else, with no idea they had gone
      or how to return to what they were doing.

   So: a labelled action, and an in-world list. Picking a name is the
   whole screen; there is nothing else on it to be distracted by.

   The list is my_people — the people already connected, which is who a
   new chat can be with. Not a search over everybody: a first message to
   a stranger is a request and belongs to the Requests tab, not here.
   ════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { APP_COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { fetchMyPeople } from "../people/myPeopleStore.js";
import { openDmWith } from "../people/peopleStore.js";
import Avatar from "./Avatar.jsx";

export default function NewChat() {
  const { t, ts } = useI18n();
  const navigate = useNavigate();
  const [people, setPeople] = useState(null);   /* null = loading */
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    fetchMyPeople()
      .then((rows) => { if (alive) setPeople(rows || []); })
      .catch(() => { if (alive) setPeople([]); });
    return () => { alive = false; };
  }, []);

  const open = async (person) => {
    if (busy) return;
    setBusy(person.id);
    setError("");
    try {
      await openDmWith(person.id);
      navigate(`/app/community/messages/with/${person.id}`);
    } catch (e) {
      setError(e?.message || "");
      setBusy(null);
    }
  };

  if (people === null) {
    return <p role="status" style={{ fontSize: ts(A11Y.minBodyPx), color: C.textMuted }}>{t("common.loading")}</p>;
  }

  if (!people.length) {
    /* A door, never a scoreboard. Someone with nobody connected yet is
       not told they have nobody — they are told where people are. */
    return (
      <div style={{ padding: "8px 2px" }}>
        <p style={{ fontSize: ts(A11Y.minBodyPx), color: C.textMain, lineHeight: 1.55, margin: "0 0 14px" }}>
          {t("msg.newChat.nobodyYet")}
        </p>
      </div>
    );
  }

  return (
    <>
      <h2 style={{ fontSize: ts(20), fontWeight: 700, color: C.textMain, margin: "2px 0 12px" }}>
        {t("msg.newChat.pick")}
      </h2>

      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {people.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              disabled={!!busy}
              onClick={() => open(p)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                width: "100%",
                minHeight: Math.max(64, A11Y.minTapTargetPx),
                padding: "10px 4px",
                /* No border. §2 of the redesign: a row is separated by
                   space, not by a box drawn round it. */
                border: "none",
                background: "transparent",
                fontFamily: "inherit",
                textAlign: "start",
                cursor: busy ? "default" : "pointer",
                opacity: busy && busy !== p.id ? 0.5 : 1,
              }}
            >
              <Avatar person={p} size={46} />
              <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                <span style={{ fontSize: ts(A11Y.minBodyPx), fontWeight: 600, color: C.textMain }}>
                  {p.full_name}
                </span>
                {p.city ? (
                  <span style={{ fontSize: ts(15), color: C.textMuted }}>{p.city}</span>
                ) : null}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {error ? (
        <p role="alert" style={{ fontSize: ts(16), fontWeight: 700, color: C.brown }}>⚠ {error}</p>
      ) : null}
    </>
  );
}
