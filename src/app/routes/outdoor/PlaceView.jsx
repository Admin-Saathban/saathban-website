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
import { TYPE_ICONS, firstNameOf } from "./outdoorCopy.js";
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
  fetchPlacedActivities,
  activityIsCurrent,
  fetchActivityJoins,
  dropMirroredOutings,
  startActivityHere,
  joinPlacedActivity,
} from "./outdoorData.js";
import { OutdoorScreen, Card, BodyText, SectionLabel, PrimaryBtn, GhostBtn, Toast } from "./ui.jsx";

function VisibilityChoice({ value, onChange }) {
  const { t, ts } = useI18n();
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
    <div role="radiogroup" aria-label={t("outdoor.place.visibilityLabel")} style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
      {option("connections", t("outdoor.place.visConnections"), t("outdoor.place.visConnectionsHint"))}
      {option("board", t("outdoor.place.visBoard"), t("outdoor.place.visBoardHint"))}
    </div>
  );
}

export default function PlaceView() {
  const { placeId } = useParams();
  const { t, ts, meta, lang } = useI18n();
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
  const [activities, setActivities] = useState([]);
  const [joins, setJoins] = useState({ counts: {}, mine: new Set() });
  const [startOpen, setStartOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [planWhen, setPlanWhen] = useState("");
  const [planNote, setPlanNote] = useState("");
  const [planVis, setPlanVis] = useState("connections");
  const [actOpen, setActOpen] = useState(false);
  const [actWhat, setActWhat] = useState("");
  const [actWhen, setActWhen] = useState("");
  const [actNote, setActNote] = useState("");
  const [actLimit, setActLimit] = useState("");
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
      const [places, live, my, outs, msgs, acts] = await Promise.all([
        fetchPlaces(),
        fetchLiveCheckins(),
        myId ? myLiveCheckin(myId) : null,
        fetchOutings(placeId),
        fetchBoard(placeId),
        fetchPlacedActivities(),
      ]);
      const p = places.find((x) => x.id === placeId) || null;
      setPlace(p);
      const hereNow = live.filter((ci) => ci.place_id === placeId);
      setHere(hereNow);
      setMine(my && my.place_id === placeId ? my : null);
      // A timed activity mirrors an outing row — show it once, as the
      // activity (which carries the join button).
      const outsClean = dropMirroredOutings(outs, acts);
      setOutings(outsClean);
      const actsHere = acts.filter((a) => a.payload.place_id === placeId && activityIsCurrent(a));
      setActivities(actsHere);
      setJoins(await fetchActivityJoins(actsHere.map((a) => a.id), myId));
      setBoard(msgs);
      setNames(
        await fetchAuthors([
          ...hereNow.map((x) => x.profile_id),
          ...outsClean.map((x) => x.creator_id),
          ...msgs.map((x) => x.author_id),
          ...actsHere.map((x) => x.author_id),
        ])
      );
    } catch {
      setError(t("outdoor.home.loadError"));
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
      setError(t("outdoor.place.checkinFailed"));
    }
  };

  const doLeave = async () => {
    if (!mine) return;
    try {
      await leaveCheckin(mine.id);
      await load();
    } catch {
      setError(t("outdoor.place.checkinFailed"));
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
      setError(t("outdoor.place.checkinFailed"));
    }
  };

  const doJoin = async (a) => {
    setError("");
    try {
      const res = await joinPlacedActivity(a.id);
      setJoins((j) => {
        const mine = new Set(j.mine);
        if (res.joined) mine.add(a.id);
        return { counts: { ...j.counts, [a.id]: res.count }, mine };
      });
      if (!res.joined && res.full) showToast(t("outdoor.place.actFullToast"));
    } catch {
      setError(t("outdoor.place.joinFailed"));
    }
  };

  const saveActivity = async (e) => {
    e.preventDefault();
    if (!actWhat.trim()) return;
    setError("");
    try {
      await startActivityHere(myId, {
        activity: actWhat,
        placeId,
        placeText: place.name,
        startsAtIso: actWhen ? new Date(actWhen).toISOString() : null,
        note: actNote,
        limit: actLimit ? Number(actLimit) : null,
      });
      setActOpen(false);
      setActWhat("");
      setActWhen("");
      setActNote("");
      setActLimit("");
      await load();
    } catch {
      setError(t("outdoor.place.checkinFailed"));
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
      setError(t("outdoor.place.checkinFailed"));
    }
  };

  const report = async (m) => {
    try {
      await reportBoardMessage(myId, m);
      showToast(t("outdoor.place.reportedToast"));
    } catch {
      setError(t("outdoor.home.loadError"));
    }
  };

  const block = async (m) => {
    try {
      await blockAuthor(myId, m.author_id);
      await load();
      showToast(t("outdoor.place.blockedToast"), t("outdoor.place.undo"), async () => {
        await unblockAuthor(myId, m.author_id);
        setToast(null);
        await load();
      });
    } catch {
      setError(t("outdoor.home.loadError"));
    }
  };

  /* Report and block are safety affordances: full 48px target, full
     18px text (same floor as the Community fixes, QUALITY_REPORT §3). */
  const smallLink = (label, onClick) => (
    <button
      type="button"
      onClick={onClick}
      style={{
        minHeight: A11Y.minTapTargetPx,
        background: "none",
        border: "none",
        color: C.textMuted,
        fontSize: ts(18),
        fontFamily: "inherit",
        textDecoration: "underline",
        cursor: "pointer",
        padding: "2px 8px",
      }}
    >
      {label}
    </button>
  );

  return (
    <OutdoorScreen backTo="/app/outdoor" backLabel={t("outdoor.place.backToPlaces")}>
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
                    {t("outdoor.place.checkedInUntil", {
                      time: new Date(mine.expires_at).toLocaleTimeString(dateLocale, {
                        hour: "numeric",
                        minute: "2-digit",
                      }),
                    })}
                  </BodyText>
                  <GhostBtn onClick={doLeave} style={{ borderColor: C.green, color: C.green }}>
                    {t("outdoor.place.leaveCta")}
                  </GhostBtn>
                </>
              ) : (
                <>
                  <BodyText style={{ fontWeight: 700, marginBottom: 8 }}>{t("outdoor.place.visibilityLabel")}</BodyText>
                  <VisibilityChoice value={visibility} onChange={setVisibility} />
                  <div style={{ marginTop: 12 }}>
                    <PrimaryBtn onClick={doCheckIn}>{t("outdoor.place.checkInCta")}</PrimaryBtn>
                  </div>
                </>
              )}
              <BodyText muted style={{ margin: "10px 0 0", fontSize: ts(16) }}>
                {t("outdoor.place.expiresNote")}
              </BodyText>
            </Card>
          )}

          {/* Here now — first names only, coarse presence. */}
          <SectionLabel>{t("outdoor.place.hereNowLabel")}</SectionLabel>
          {here.length === 0 ? (
            <BodyText muted>{t("outdoor.place.nobodyHere")}</BodyText>
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

          {/* Happening here — "who's up for…?" invitations + planned
              outings, the same happenings the list badge counted. */}
          <SectionLabel>{t("outdoor.place.happeningLabel")}</SectionLabel>
          {outings.length === 0 && activities.length === 0 && (
            <BodyText muted>{t("outdoor.place.happeningEmpty")}</BodyText>
          )}
          {activities.map((a) => {
            const count = joins.counts[a.id] || 0;
            const joined = joins.mine.has(a.id);
            const full = !!a.payload.limit && count >= a.payload.limit;
            return (
              <Card key={a.id} style={{ padding: 16, border: `1.5px solid ${C.sage}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <BodyText style={{ margin: 0, flex: "1 1 220px" }}>
                    <strong>{firstNameOf(names[a.author_id])}</strong>
                    {" — "}
                    {/* legacy 'walk' posts (pre-0027) carry no activity text */}
                    {t("outdoor.place.actWho", { what: a.payload.activity || t("outdoor.place.actWalk") })}
                    {a.payload.starts_at && (
                      <span style={{ display: "block", color: C.textMuted }}>
                        🕐{" "}
                        {new Date(a.payload.starts_at).toLocaleString(dateLocale, {
                          weekday: "long",
                          day: "numeric",
                          month: "short",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </span>
                    )}
                    {a.payload.note && (
                      <span style={{ display: "block", color: C.textMuted }}>{a.payload.note}</span>
                    )}
                    {(count > 0 || a.payload.limit) && (
                      <span style={{ display: "block", fontSize: ts(16), fontWeight: 600, color: C.greenMuted }}>
                        {count === 1
                          ? t("outdoor.place.actOneIn")
                          : count > 1
                            ? t("outdoor.place.actManyIn", { n: count })
                            : ""}
                        {a.payload.limit
                          ? `${count > 0 ? " · " : ""}${t("outdoor.place.actLimitOf", { n: a.payload.limit })}`
                          : ""}
                      </span>
                    )}
                  </BodyText>
                  {a.author_id === myId ? (
                    <span
                      style={{
                        fontSize: ts(16),
                        fontWeight: 700,
                        color: C.greenMuted,
                        padding: "8px 14px",
                      }}
                    >
                      {t("outdoor.place.actYours")}
                    </span>
                  ) : joined ? (
                    <span
                      style={{
                        fontSize: ts(A11Y.minBodyPx),
                        fontWeight: 700,
                        color: C.green,
                        padding: "8px 14px",
                      }}
                    >
                      ✓ {t("outdoor.place.actJoined")}
                    </span>
                  ) : full ? (
                    <GhostBtn disabled aria-disabled="true">
                      {t("outdoor.place.actFull")}
                    </GhostBtn>
                  ) : (
                    <PrimaryBtn onClick={() => doJoin(a)}>{t("outdoor.place.actJoin")}</PrimaryBtn>
                  )}
                </div>
              </Card>
            );
          })}
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
                    {t("outdoor.place.outingRemove")}
                  </GhostBtn>
                )}
              </div>
            </Card>
          ))}
          {isIcon && planOpen && (
              <Card>
                <form onSubmit={savePlan}>
                  <label style={{ display: "block", fontSize: ts(A11Y.minBodyPx), fontWeight: 600, marginBottom: 14 }}>
                    {t("outdoor.place.outingWhen")}
                    <input
                      type="datetime-local"
                      value={planWhen}
                      onChange={(e) => setPlanWhen(e.target.value)}
                      style={{ marginTop: 6 }}
                    />
                  </label>
                  <label style={{ display: "block", fontSize: ts(A11Y.minBodyPx), fontWeight: 600, marginBottom: 14 }}>
                    {t("outdoor.place.outingNote")}
                    <input
                      value={planNote}
                      onChange={(e) => setPlanNote(e.target.value)}
                      placeholder={t("outdoor.place.outingNotePh")}
                      maxLength={300}
                      style={{ marginTop: 6 }}
                    />
                  </label>
                  <VisibilityChoice value={planVis} onChange={setPlanVis} />
                  <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
                    <PrimaryBtn type="submit" onClick={savePlan} disabled={!planWhen}>
                      {t("outdoor.place.outingSave")}
                    </PrimaryBtn>
                    <GhostBtn onClick={() => setPlanOpen(false)}>{t("outdoor.place.formCancel")}</GhostBtn>
                  </div>
                </form>
              </Card>
          )}

          {/* "Ask who's up for…?" — an open invitation pre-filled with
              this place; writes through the community lane's own store. */}
          {isIcon && actOpen && (
            <Card>
              <form onSubmit={saveActivity}>
                <label style={{ display: "block", fontSize: ts(A11Y.minBodyPx), fontWeight: 600, marginBottom: 14 }}>
                  {t("outdoor.place.actWhatLabel")}
                  <input
                    value={actWhat}
                    onChange={(e) => setActWhat(e.target.value)}
                    placeholder={t("outdoor.place.actWhatPh")}
                    maxLength={120}
                    style={{ marginTop: 6 }}
                  />
                </label>
                <label style={{ display: "block", fontSize: ts(A11Y.minBodyPx), fontWeight: 600, marginBottom: 14 }}>
                  {t("outdoor.place.actWhenLabel")}
                  <input
                    type="datetime-local"
                    value={actWhen}
                    onChange={(e) => setActWhen(e.target.value)}
                    style={{ marginTop: 6 }}
                  />
                </label>
                <label style={{ display: "block", fontSize: ts(A11Y.minBodyPx), fontWeight: 600, marginBottom: 14 }}>
                  {t("outdoor.place.outingNote")}
                  <input
                    value={actNote}
                    onChange={(e) => setActNote(e.target.value)}
                    placeholder={t("outdoor.place.outingNotePh")}
                    maxLength={300}
                    style={{ marginTop: 6 }}
                  />
                </label>
                <label style={{ display: "block", fontSize: ts(A11Y.minBodyPx), fontWeight: 600, marginBottom: 14 }}>
                  {t("outdoor.place.actLimitLabel")}
                  <input
                    type="number"
                    inputMode="numeric"
                    min={2}
                    max={50}
                    value={actLimit}
                    onChange={(e) => setActLimit(e.target.value)}
                    style={{ marginTop: 6 }}
                  />
                </label>
                <div style={{ display: "flex", gap: 10, marginTop: 4, flexWrap: "wrap" }}>
                  <PrimaryBtn type="submit" onClick={saveActivity} disabled={!actWhat.trim()}>
                    {t("outdoor.place.actSave")}
                  </PrimaryBtn>
                  <GhostBtn onClick={() => setActOpen(false)}>{t("outdoor.place.formCancel")}</GhostBtn>
                </div>
              </form>
            </Card>
          )}

          {/* Start something here — an Icon can initiate at any moment. */}
          {isIcon && !planOpen && !actOpen && (
            startOpen ? (
              <Card style={{ border: `2px solid ${C.green}` }}>
                <BodyText style={{ fontWeight: 700 }}>{t("outdoor.place.startTitle")}</BodyText>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <GhostBtn
                    onClick={() => {
                      setStartOpen(false);
                      setPlanOpen(true);
                    }}
                    style={{ borderColor: C.green, color: C.green, minHeight: 56 }}
                  >
                    🗓️ {t("outdoor.place.planCta")}
                  </GhostBtn>
                  <GhostBtn
                    onClick={() => {
                      setStartOpen(false);
                      setActOpen(true);
                    }}
                    style={{ borderColor: C.green, color: C.green, minHeight: 56 }}
                  >
                    🙋 {t("outdoor.place.actCta")}
                  </GhostBtn>
                  <GhostBtn onClick={() => setStartOpen(false)}>{t("outdoor.place.formCancel")}</GhostBtn>
                </div>
              </Card>
            ) : (
              <PrimaryBtn onClick={() => setStartOpen(true)} style={{ minHeight: 60, width: "100%" }}>
                ✨ {t("outdoor.place.startCta")}
              </PrimaryBtn>
            )
          )}

          {/* Park board — open chat, guards one tap away. */}
          <SectionLabel>{t("outdoor.place.boardLabel")}</SectionLabel>
          <BodyText muted>{t("outdoor.place.boardIntro")}</BodyText>
          <Card>
            <form onSubmit={postBoard} style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              <input
                value={boardBody}
                onChange={(e) => setBoardBody(e.target.value)}
                placeholder={t("outdoor.place.boardPh")}
                maxLength={1000}
                style={{ flex: 1 }}
              />
              <GhostBtn
                type="submit"
                onClick={postBoard}
                style={{ borderColor: C.green, color: C.green }}
              >
                {t("outdoor.place.boardSend")}
              </GhostBtn>
            </form>
            {board.length === 0 ? (
              <BodyText muted style={{ margin: 0 }}>{t("outdoor.place.boardEmpty")}</BodyText>
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
                        {smallLink(t("outdoor.place.report"), () => report(m))}
                        {smallLink(t("outdoor.place.block"), () => block(m))}
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
