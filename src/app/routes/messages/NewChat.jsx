/* ════════════════════════════════════════════════
   New chat — EVERYTHING ABOUT STARTING A CONVERSATION, inside the world.

   Owner, 2026-09-13: Chats shows only the conversations a person has.
   Every way of starting one lives here, and nowhere else:

   1. "Not heard from" — the faces of people you have talked to before
      and not lately (§9). A face opens the say-hello sheet: a hello is
      starting a conversation again, so it moved here from Chats.
   2. People you know — my_people, the people already connected. A tap
      opens the conversation straight away.
   3. Find someone new — a search by name through search_people (0123:
      three letters or more, the start of a word), the same search the
      app's search page uses. A first message to somebody not connected
      is a REQUEST, so a tap asks first and says so in plain words; the
      server's own guards (who can write to them, have you met, five a
      day) are then said in words rather than as an error code.
   4. Not on Saathban yet? — the invite page.

   HISTORY THAT STILL APPLIES. The pencil that used to be here was a glyph
   nobody is taught and a link that dropped the person out of the world;
   this is a labelled action and an in-world page. The people list draws
   at once from what the world already holds (heldData.js) and is then
   refreshed — the owner saw it take a second on every visit.
   ════════════════════════════════════════════════ */

import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { APP_COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { useSession } from "../../lib/session.jsx";
import { openDmWith } from "../people/peopleStore.js";
import { searchPeople } from "../search/searchData.js";
import Icon from "../../components/Icon.jsx";
import { WORLD, cachedChats, fetchChats, driftedFrom, driftedHushed, hushDriftedRow } from "./messagesData.js";
import { heldFor, loadPeople } from "./heldData.js";
import Avatar from "./Avatar.jsx";
import ConfirmDialog from "./ConfirmDialog.jsx";
import SayHelloSheet from "./SayHelloSheet.jsx";

/* Past this many, the people you know fold behind "Show everyone", so
   Find someone new and Invite are not pushed off the bottom of a long
   list. The search box over them appears at the same point. */
const KNOWN_FOLD = 6;

/* The server refuses a first message for reasons a person can act on.
   Its words are English and technical; these are both languages. */
function refusalKey(message) {
  const m = String(message || "");
  if (/not met this person/i.test(m)) return "msg.newChat.errNotMet";
  if (/only takes messages from people they are connected/i.test(m)) return "msg.newChat.errConnected";
  if (/finish your profile/i.test(m)) return "msg.newChat.errProfile";
  if (/too many requests/i.test(m)) return "msg.newChat.errTooMany";
  return "msg.newChat.errFailed";
}

function SectionTitle({ children }) {
  const { ts } = useI18n();
  return (
    <h3 style={{ fontSize: ts(A11Y.minBodyPx), fontWeight: 800, color: C.textMain, margin: "0 0 6px" }}>
      {children}
    </h3>
  );
}

function PersonRow({ p, busy, onPick, note }) {
  const { ts } = useI18n();
  return (
    <li>
      <button
        type="button"
        data-person-row={p.id}
        disabled={!!busy}
        onClick={() => onPick(p)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          width: "100%",
          minHeight: Math.max(64, A11Y.minTapTargetPx),
          padding: "10px 4px",
          /* No border. §2 of the redesign: a row is separated by space,
             not by a box drawn round it. */
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
          {(p.city || note) ? (
            <span style={{ fontSize: ts(15), color: C.textMuted }}>
              {[p.city, note].filter(Boolean).join(" · ")}
            </span>
          ) : null}
        </span>
      </button>
    </li>
  );
}

function Alert({ children }) {
  const { ts } = useI18n();
  return (
    <p role="alert" style={{ fontSize: ts(16), fontWeight: 700, color: C.brown, margin: "4px 0 10px", lineHeight: 1.45 }}>
      ⚠ {children}
    </p>
  );
}

const searchBox = (ts) => ({
  width: "100%", boxSizing: "border-box",
  minHeight: A11Y.minTapTargetPx, marginBottom: 10,
  fontSize: ts(A11Y.minBodyPx), fontFamily: "inherit",
  color: C.textMain, background: C.white,
  border: `2px solid ${C.warmGray}`, borderRadius: 12, padding: "10px 14px",
});

const section = { marginTop: 22 };

export default function NewChat() {
  const { t, ts } = useI18n();
  const { profile } = useSession();
  const myId = profile?.id;
  const navigate = useNavigate();

  /* Seeded from what the world holds, not from null: a second visit, or
     a first one after the world warmed up, draws the list on the first
     frame. null still means "never looked" and draws a quiet line. */
  const [people, setPeople] = useState(() => heldFor("people", myId));
  const [peopleError, setPeopleError] = useState("");
  const peopleRef = useRef(people);
  peopleRef.current = people;
  const [showAll, setShowAll] = useState(false);
  const [q, setQ] = useState("");

  const [chats, setChats] = useState(() => cachedChats(myId));
  const [hushed, setHushed] = useState(() => driftedHushed());
  const [hello, setHello] = useState(null);

  const [find, setFind] = useState("");
  const [found, setFound] = useState(null);     // null = nothing searched
  const [finding, setFinding] = useState(false);
  const [findFailed, setFindFailed] = useState(false);

  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);     // { where: "known" | "find", text }
  const [ask, setAsk] = useState(null);         // somebody new, before the request

  useEffect(() => {
    if (!myId) return undefined;
    let alive = true;
    loadPeople(myId)
      .then((rows) => { if (alive) { setPeople(rows); setPeopleError(""); } })
      /* NOT AN EMPTY LIST. A read that was refused is not a person with
         nobody to write to. If rows are already on screen they stay; if
         there were none, the section says what happened. */
      .catch(() => {
        if (!alive) return;
        if (peopleRef.current === null) { setPeople([]); setPeopleError(t("common.loadError")); }
      });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myId]);

  /* The faces come from the chats list, which Chats has normally just
     loaded. Only asked for here when nothing is held. */
  useEffect(() => {
    if (!myId || cachedChats(myId)) return undefined;
    let alive = true;
    fetchChats(myId).then((c) => { if (alive) setChats(c); }).catch(() => {});
    return () => { alive = false; };
  }, [myId]);

  const drifted = useMemo(() => (chats && !hushed ? driftedFrom(chats) : []), [chats, hushed]);

  useEffect(() => {
    const term = find.trim();
    if (term.length < 3) {
      setFound(null); setFinding(false); setFindFailed(false);
      return undefined;
    }
    let alive = true;
    setFinding(true);
    const timer = setTimeout(() => {
      searchPeople(term)
        .then((rows) => { if (alive) { setFound((rows || []).filter((p) => p.id !== myId)); setFindFailed(false); } })
        .catch(() => { if (alive) { setFound([]); setFindFailed(true); } })
        .finally(() => { if (alive) setFinding(false); });
    }, 350);
    return () => { alive = false; clearTimeout(timer); };
  }, [find, myId]);

  const knownIds = useMemo(() => new Set((people || []).map((p) => p.id)), [people]);

  const start = async (person, where) => {
    if (busy) return;
    setBusy(person.id);
    setError(null);
    try {
      await openDmWith(person.id);
      setAsk(null);
      navigate(`${WORLD}/with/${person.id}`);
    } catch (e) {
      const name = (person.full_name || "").trim().split(" ")[0];
      setAsk(null);
      setError({ where, text: t(refusalKey(e?.message), { name }) });
      setBusy(null);
    }
  };

  /* Somebody already connected opens straight away, wherever they were
     found. Somebody new is asked about first: the tap creates a request
     they will see, and that should never be an accident. */
  const pickFound = (p) => (knownIds.has(p.id) ? start(p, "find") : setAsk(p));

  const needle = q.trim().toLowerCase();
  const filtered = (people || []).filter((p) => !needle
    || (p.full_name || "").toLowerCase().includes(needle)
    || (p.city || "").toLowerCase().includes(needle));
  const folded = !needle && !showAll && filtered.length > KNOWN_FOLD;
  const knownShown = folded ? filtered.slice(0, KNOWN_FOLD) : filtered;
  const askFirst = (ask?.full_name || "").trim().split(" ")[0];

  return (
    <>
      <h2 style={{ fontSize: ts(20), fontWeight: 700, color: C.textMain, margin: "2px 0 4px" }}>
        {t("msg.newChat.pick")}
      </h2>

      {/* ── 1. Not heard from (§9) — moved here from Chats ── */}
      {drifted.length > 0 && (
        <section data-newchat="drifted" style={{ marginTop: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ flex: 1 }}>
              <SectionTitle>{t("msg.drifted.label")}</SectionTitle>
            </span>
            <button
              type="button"
              onClick={() => { hushDriftedRow(); setHushed(true); }}
              aria-label={t("msg.drifted.dismiss")}
              style={{
                minWidth: A11Y.minTapTargetPx,
                minHeight: A11Y.minTapTargetPx,
                border: "none",
                background: "transparent",
                color: C.textMuted,
                fontSize: ts(20),
                cursor: "pointer",
              }}
            >
              <span aria-hidden="true">✕</span>
            </button>
          </div>
          <p style={{ margin: "0 0 8px", fontSize: ts(16), color: C.textMuted, lineHeight: 1.45 }}>
            {t("msg.drifted.hint")}
          </p>
          <div style={{ display: "flex", gap: 14, overflowX: "auto", paddingBottom: 4 }}>
            {drifted.map((c) => (
              <button
                key={c.requestId}
                type="button"
                onClick={() => setHello(c.person ? { ...c.person, id: c.otherId } : { id: c.otherId })}
                style={{
                  border: "none",
                  background: "transparent",
                  padding: 0,
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 6,
                  minWidth: 72,
                  minHeight: A11Y.minTapTargetPx,
                  fontFamily: "inherit",
                }}
              >
                {/* No ring, no presence dot (§9): these are people you have
                    drifted from, not people who are active. */}
                <Avatar person={c.person} size={56} />
                <span style={{ fontSize: ts(15), color: C.textMain, maxWidth: 72, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {(c.person?.full_name || "").split(" ")[0]}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ── 2. People you know ── */}
      <section data-newchat="known" style={section}>
        <SectionTitle>{t("msg.newChat.knownTitle")}</SectionTitle>
        {error?.where === "known" && <Alert>{error.text}</Alert>}
        {people === null ? (
          <p role="status" style={{ fontSize: ts(A11Y.minBodyPx), color: C.textMuted, margin: "4px 0" }}>
            {t("common.loading")}
          </p>
        ) : peopleError ? (
          <Alert>{peopleError}</Alert>
        ) : people.length === 0 ? (
          /* A door, never a scoreboard: where people are, not that there
             is nobody — and the two ways onward are right below. */
          <p data-newchat-empty="" style={{ fontSize: ts(A11Y.minBodyPx), color: C.textMuted, lineHeight: 1.55, margin: "2px 0 0" }}>
            {t("msg.newChat.nobodyYet")}
          </p>
        ) : (
          <>
            {people.length > KNOWN_FOLD && (
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t("msg.newChat.search")}
                aria-label={t("msg.newChat.search")}
                style={{ ...searchBox(ts), marginTop: 4 }}
              />
            )}
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {knownShown.map((p) => (
                <PersonRow key={p.id} p={p} busy={busy} onPick={(x) => start(x, "known")} />
              ))}
            </ul>
            {needle && filtered.length === 0 && (
              <p style={{ fontSize: ts(16), color: C.textMuted, margin: "4px 0" }}>{t("msg.noMatches")}</p>
            )}
            {folded && (
              <button
                type="button"
                onClick={() => setShowAll(true)}
                style={{
                  minHeight: A11Y.minTapTargetPx, padding: "0 18px", marginTop: 4,
                  borderRadius: 50, border: `2px solid ${C.warmGray}`, background: C.white,
                  color: C.textMain, fontFamily: "inherit", fontSize: ts(16), fontWeight: 700, cursor: "pointer",
                }}
              >
                {t("msg.newChat.showAll", { n: filtered.length })}
              </button>
            )}
          </>
        )}
      </section>

      {/* ── 3. Find someone new ── */}
      <section data-newchat="find" style={section}>
        <SectionTitle>{t("msg.newChat.findTitle")}</SectionTitle>
        <p style={{ margin: "0 0 10px", fontSize: ts(16), color: C.textMuted, lineHeight: 1.45 }}>
          {t("msg.newChat.findBody")}
        </p>
        <input
          type="search"
          value={find}
          onChange={(e) => setFind(e.target.value)}
          placeholder={t("msg.newChat.findPh")}
          aria-label={t("msg.newChat.findTitle")}
          aria-describedby="newchat-find-hint"
          style={searchBox(ts)}
        />
        {error?.where === "find" && <Alert>{error.text}</Alert>}
        <div aria-live="polite">
          {find.trim().length > 0 && find.trim().length < 3 && (
            <p id="newchat-find-hint" style={{ fontSize: ts(16), color: C.textMuted, margin: "2px 0" }}>
              {t("msg.newChat.findHint")}
            </p>
          )}
          {finding && (
            <p style={{ fontSize: ts(16), color: C.textMuted, margin: "2px 0" }}>{t("msg.newChat.searching")}</p>
          )}
          {!finding && findFailed && <Alert>{t("msg.newChat.findFailed")}</Alert>}
          {!finding && !findFailed && found && found.length === 0 && (
            <p style={{ fontSize: ts(16), color: C.textMuted, margin: "2px 0", lineHeight: 1.45 }}>
              {t("msg.newChat.findNone")}
            </p>
          )}
        </div>
        {!finding && found && found.length > 0 && (
          <ul data-newchat-found="" style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {found.map((p) => (
              <PersonRow
                key={p.id}
                p={p}
                busy={busy}
                onPick={pickFound}
                note={knownIds.has(p.id) ? t("msg.newChat.known") : null}
              />
            ))}
          </ul>
        )}
      </section>

      {/* ── 4. Not on Saathban yet? ── */}
      <section
        data-newchat="invite"
        style={{
          ...section,
          padding: "14px 16px",
          background: C.white,
          border: `1px solid ${C.warmGray}`,
          borderRadius: 16,
          boxSizing: "border-box",
        }}
      >
        <SectionTitle>{t("msg.newChat.inviteTitle")}</SectionTitle>
        <p style={{ margin: "0 0 12px", fontSize: ts(16), color: C.textMuted, lineHeight: 1.45 }}>
          {t("msg.newChat.inviteBody")}
        </p>
        <Link
          to={`${WORLD}/invite`}
          className="sb-press"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            minHeight: A11Y.minTapTargetPx,
            padding: "0 22px",
            borderRadius: 50,
            background: people && people.length === 0 ? C.green : "transparent",
            border: `2px solid ${C.green}`,
            color: people && people.length === 0 ? C.cream : C.green,
            fontSize: ts(A11Y.minBodyPx),
            fontWeight: 700,
            textDecoration: "none",
          }}
        >
          <Icon name="add" size={20} />
          {t("msg.newChat.inviteCta")}
        </Link>
      </section>

      {ask && (
        <ConfirmDialog
          title={t("msg.newChat.askTitle", { name: askFirst })}
          body={t("msg.newChat.askBody", { name: askFirst })}
          confirmLabel={t("msg.newChat.askConfirm", { name: askFirst })}
          cancelLabel={t("msg.newChat.askCancel")}
          busy={busy === ask.id}
          onConfirm={() => start(ask, "find")}
          onCancel={() => setAsk(null)}
        />
      )}

      {hello && <SayHelloSheet person={hello} onClose={() => setHello(null)} />}
    </>
  );
}
