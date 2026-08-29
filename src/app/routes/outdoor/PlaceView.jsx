/* ════════════════════════════════════════════════
   One place — /app/outdoor/:placeId.

   Check-in panel (Icons; manual only, ~2h auto-expiry, per-check-in
   visibility: circle-only default or announce to the board), the
   "here now" first-name list, planned outings, and the park board —
   an open chat with report and block one tap on every message.
   Coarse presence only: a place name, never a pin, never a time trail
   (expired check-ins are invisible at the database level).
   ════════════════════════════════════════════════ */

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, Navigate } from "react-router-dom";
import { COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { useSession } from "../../lib/session.jsx";
import { COPY, TYPE_ICONS, firstNameOf } from "./outdoorCopy.js";
import {
  fetchPlaces,
  fetchLiveCheckins,
  myLiveCheckin,
  checkIn,
  leaveCheckin,
  fetchAuthors,
  fetchOutings,
  createOuting,
  cancelOuting,
  fetchBoard,
  postToBoard,
  reportBoardMessage,
  blockAuthor,
  unblockAuthor,
} from "./outdoorData.js";
import { OutdoorScreen, Card, BodyText, SectionLabel, PrimaryBtn, GhostBtn, Toast } from "./ui.jsx";

const c = COPY.place;

function VisibilityChoice({ value, onChange }) {
  const { ts } = useI18n();
  const option = (val, label, hint) => (
    <button
      type="button"
      role="radio"
      aria-checked={value === val}
      onClick={() => onChange(val)}
      style={{
        flex: "1 1 220px",
        minHeight: 72,
        borderRadius: 14,
        border: `2.5px solid ${value === val ? C.green : C.warmGray}`,
        background: value === val ? "#eef3ea" : C.white,
        fontFamily: "inherit",
        textAlign: "start",
        padding: "10px 14px",
        cursor: "pointer",
      }}
    >
      <span style={{ display: "block", fontSize: ts(A11Y.minBodyPx), fontWeight: 700, color: C.textMain }}>
        {value === val ? "✓ " : ""}
        {label}
      </span>
      <span style={{ display: "block", fontSize: ts(16), color: C.textMuted, lineHeight: 1.4 }}>
        {hint}
      </span>
    </button>
  );
  return (
    <div role="radiogroup" aria-label={c.visibilityLabel} style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
      {option("connections", c.visConnections, c.visConnectionsHint)}
      {option("board", c.visBoard, c.visBoardHint)}
    </div>
  );
}

export default function PlaceView() {
  const { placeId } = useParams();
  const { ts, meta, lang } = useI18n();
  const { profile } = useSession();
  const myId = profile?.id;
  const isIcon = profile?.role === "saath_icon";
  const dateLocale = lang === "ur" ? "ur-PK" : "en-GB";

  const [place, setPlace] = useState(undefined); // undefined loading, null missing
  const [here, setHere] = useState([]);
  const [names, setNames] = useState({});
  const [mine, setMine] = useState(null);
  const [visibility, setVisibility] = useState("connections");
  const [outings, setOutings] = useState([]);
  const [board, setBoard] = useState([]);
  const [boardBody, setBoardBody] = useState("");
  const [planOpen, setPlanOpen] = useState(false);
  const [planWhen, setPlanWhen] = useState("");
  const [planNote, setPlanNote] = useState("");
  const [planVis, setPlanVis] = useState("connections");
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const showToast = (text, actionLabel, onAction) => {
    window.clearTimeout(toastTimer.current);
    setToast({ text, actionLabel, onAction });
    toastTimer.current = window.setTimeout(() => setToast(null), 6000);
  };

  const load = useCallback(async () => {
    try {
      const [places, live, my, outs, msgs] = await Promise.all([
        fetchPlaces(),
        fetchLiveCheckins(),
        myId ? myLiveCheckin(myId) : null,
        fetchOutings(placeId),
        fetchBoard(placeId),
      ]);
      const p = places.find((x) => x.id === placeId) || null;
      setPlace(p);
      const hereNow = live.filter((ci) => ci.place_id === placeId);
      setHere(hereNow);
      setMine(my && my.place_id === placeId ? my : null);
      setOutings(outs);
      setBoard(msgs);
      setNames(
        await fetchAuthors([
          ...hereNow.map((x) => x.profile_id),
          ...outs.map((x) => x.creator_id),
          ...msgs.map((x) => x.author_id),
        ])
      );
    } catch {
      setError(COPY.home.loadError);
      setPlace((p) => (p === undefined ? null : p));
    }
  }, [placeId, myId]);

  useEffect(() => {
    load();
  }, [load]);

  if (place === null) return <Navigate to="/app/outdoor" replace />;

  const doCheckIn = async () => {
    setError("");
    try {
      await checkIn(placeId, visibility);
      await load();
    } catch {
      setError(c.checkinFailed);
    }
  };

  const doLeave = async () => {
    if (!mine) return;
    try {
      await leaveCheckin(mine.id);
      await load();
    } catch {
      setError(c.checkinFailed);
    }
  };

  const savePlan = async (e) => {
    e.preventDefault();
    if (!planWhen) return;
    setError("");
    try {
      await createOuting(placeId, myId, new Date(planWhen).toISOString(), planNote, planVis);
      setPlanOpen(false);
      setPlanWhen("");
      setPlanNote("");
      await load();
    } catch {
      setError(c.checkinFailed);
    }
  };

  const postBoard = async (e) => {
    e.preventDefault();
    if (!boardBody.trim()) return;
    setError("");
    try {
      await postToBoard(placeId, myId, boardBody);
      setBoardBody("");
      await load();
    } catch {
      setError(c.checkinFailed);
    }
  };

  const report = async (m) => {
    try {
      await reportBoardMessage(myId, m);
      showToast(c.reportedToast);
    } catch {
      setError(COPY.home.loadError);
    }
  };

  const block = async (m) => {
    try {
      await blockAuthor(myId, m.author_id);
      await load();
      showToast(c.blockedToast, c.undo, async () => {
        await unblockAuthor(myId, m.author_id);
        setToast(null);
        await load();
      });
    } catch {
      setError(COPY.home.loadError);
    }
  };

  const smallLink = (label, onClick) => (
    <button
      type="button"
      onClick={onClick}
      style={{
        minHeight: 36,
        background: "none",
        border: "none",
        color: C.textMuted,
        fontSize: ts(15),
        fontFamily: "inherit",
        textDecoration: "underline",
        cursor: "pointer",
        padding: "2px 6px",
      }}
    >
      {label}
    </button>
  );

  return (
    <OutdoorScreen backTo="/app/outdoor" backLabel={c.backToPlaces}>
      {place === undefined ? (
        <BodyText muted role="status">…</BodyText>
      ) : (
        <>
          <h1
            style={{
              fontFamily: meta.fonts.heading,
              fontSize: ts(30),
              fontWeight: 700,
              color: C.green,
              margin: "0 0 4px",
            }}
          >
            <span aria-hidden="true">{TYPE_ICONS[place.place_type] || "🌳"}</span> {place.name}
          </h1>
          <BodyText muted style={{ marginBottom: 16 }}>
            {place.area} · {place.city}
          </BodyText>

          {error && (
            <BodyText role="alert" style={{ fontWeight: 700, color: C.brown }}>
              ⚠ {error}
            </BodyText>
          )}

          {/* Check-in panel — Icons only; manual, visible choice first. */}
          {isIcon && (
            <Card style={{ border: `2px solid ${C.sage}`, background: "#f4f7f1" }}>
              {mine ? (
                <>
                  <BodyText style={{ fontWeight: 600 }}>
                    ✓{" "}
                    {c.checkedInUntil.replace(
                      "{time}",
                      new Date(mine.expires_at).toLocaleTimeString(dateLocale, {
                        hour: "numeric",
                        minute: "2-digit",
                      })
                    )}
                  </BodyText>
                  <GhostBtn onClick={doLeave} style={{ borderColor: C.green, color: C.green }}>
                    {c.leaveCta}
                  </GhostBtn>
                </>
              ) : (
                <>
                  <BodyText style={{ fontWeight: 700, marginBottom: 8 }}>{c.visibilityLabel}</BodyText>
                  <VisibilityChoice value={visibility} onChange={setVisibility} />
                  <div style={{ marginTop: 12 }}>
                    <PrimaryBtn onClick={doCheckIn}>{c.checkInCta}</PrimaryBtn>
                  </div>
                </>
              )}
              <BodyText muted style={{ margin: "10px 0 0", fontSize: ts(16) }}>
                {c.expiresNote}
              </BodyText>
            </Card>
          )}

          {/* Here now — first names only, coarse presence. */}
          <SectionLabel>{c.hereNowLabel}</SectionLabel>
          {here.length === 0 ? (
            <BodyText muted>{c.nobodyHere}</BodyText>
          ) : (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
              {here.map((ci) => (
                <span
                  key={ci.id}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    background: C.white,
                    border: `1.5px solid ${C.sage}`,
                    borderRadius: 50,
                    padding: "8px 18px",
                    fontSize: ts(A11Y.minBodyPx),
                    fontWeight: 600,
                    color: C.green,
                  }}
                >
                  🙂 {firstNameOf(names[ci.profile_id])}
                </span>
              ))}
            </div>
          )}

          {/* Planned outings */}
          <SectionLabel>{c.outingsLabel}</SectionLabel>
          {outings.length === 0 && <BodyText muted>{c.noOutings}</BodyText>}
          {outings.map((o) => (
            <Card key={o.id} style={{ padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <BodyText style={{ margin: 0, flex: "1 1 220px" }}>
                  <strong>{firstNameOf(names[o.creator_id])}</strong>
                  {" — "}
                  {new Date(o.starts_at).toLocaleString(dateLocale, {
                    weekday: "long",
                    day: "numeric",
                    month: "short",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                  {o.note && (
                    <span style={{ display: "block", color: C.textMuted }}>{o.note}</span>
                  )}
                </BodyText>
                {o.creator_id === myId && (
                  <GhostBtn onClick={() => cancelOuting(o.id).then(load)}>
                    {c.outingRemove}
                  </GhostBtn>
                )}
              </div>
            </Card>
          ))}
          {isIcon &&
            (planOpen ? (
              <Card>
                <form onSubmit={savePlan}>
                  <label style={{ display: "block", fontSize: ts(A11Y.minBodyPx), fontWeight: 600, marginBottom: 14 }}>
                    {c.outingWhen}
                    <input
                      type="datetime-local"
                      value={planWhen}
                      onChange={(e) => setPlanWhen(e.target.value)}
                      style={{ marginTop: 6 }}
                    />
                  </label>
                  <label style={{ display: "block", fontSize: ts(A11Y.minBodyPx), fontWeight: 600, marginBottom: 14 }}>
                    {c.outingNote}
                    <input
                      value={planNote}
                      onChange={(e) => setPlanNote(e.target.value)}
                      placeholder={c.outingNotePh}
                      maxLength={300}
                      style={{ marginTop: 6 }}
                    />
                  </label>
                  <VisibilityChoice value={planVis} onChange={setPlanVis} />
                  <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
                    <PrimaryBtn type="submit" onClick={savePlan} disabled={!planWhen}>
                      {c.outingSave}
                    </PrimaryBtn>
                    <GhostBtn onClick={() => setPlanOpen(false)}>{c.formCancel}</GhostBtn>
                  </div>
                </form>
              </Card>
            ) : (
              <GhostBtn onClick={() => setPlanOpen(true)} style={{ borderColor: C.green, color: C.green }}>
                🗓️ {c.planCta}
              </GhostBtn>
            ))}

          {/* Park board — open chat, guards one tap away. */}
          <SectionLabel>{c.boardLabel}</SectionLabel>
          <BodyText muted>{c.boardIntro}</BodyText>
          <Card>
            <form onSubmit={postBoard} style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              <input
                value={boardBody}
                onChange={(e) => setBoardBody(e.target.value)}
                placeholder={c.boardPh}
                maxLength={1000}
                style={{ flex: 1 }}
              />
              <GhostBtn
                type="submit"
                onClick={postBoard}
                style={{ borderColor: C.green, color: C.green }}
              >
                {c.boardSend}
              </GhostBtn>
            </form>
            {board.length === 0 ? (
              <BodyText muted style={{ margin: 0 }}>{c.boardEmpty}</BodyText>
            ) : (
              board.map((m) => (
                <div
                  key={m.id}
                  style={{ borderTop: `1px solid ${C.warmGray}`, padding: "10px 0 4px" }}
                >
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: ts(17), fontWeight: 700, color: C.green }}>
                      {firstNameOf(names[m.author_id])}
                    </span>
                    <span style={{ fontSize: ts(14), color: C.textMuted }}>
                      {new Date(m.created_at).toLocaleString(dateLocale, {
                        day: "numeric",
                        month: "short",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                    {m.author_id !== myId && (
                      <span>
                        {smallLink(c.report, () => report(m))}
                        {smallLink(c.block, () => block(m))}
                      </span>
                    )}
                  </div>
                  <BodyText style={{ margin: "2px 0 6px" }}>{m.body}</BodyText>
                </div>
              ))
            )}
          </Card>
        </>
      )}
      {toast && <Toast text={toast.text} actionLabel={toast.actionLabel} onAction={toast.onAction} />}
    </OutdoorScreen>
  );
}
