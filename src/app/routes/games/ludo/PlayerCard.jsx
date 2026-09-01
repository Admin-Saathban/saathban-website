/* ════════════════════════════════════════════════
   A player's card, opened by tapping their circle at the table.

   TWO CARDS, ONE SHEET, and the difference between them is the whole
   design. Your own is about YOU: your photo, your name, and the goti
   colour you have been dealt. Somebody else's is about how much of
   them reaches you: their chat, their emoji, their sounds, and a way
   to report them if it comes to that.

   YOUR GOTI COLOUR IS A FACT, NEVER A PICKER. It is shown as a swatch
   beside your name and it cannot be tapped. The seat decides the
   colour — the engine starts seat s at absolute 13·s and the board's
   whole geometry is built on that — so a colour picker here would
   either be a lie or a seat swap wearing a paint tin's clothes. If
   you want the green one, take the green chair.

   THE THREE MUTES ARE LOCAL, PER PERSON, PER TABLE, and reversible in
   one tap — see tableMutes.js for why they live in this browser and
   why the muted person is never told. They are the quiet control: the
   loud one is Report, which is its own row, in its own colour, at the
   bottom where nothing is tapped by accident.

   There is no Block here on purpose. Blocking is a decision about a
   person and belongs to the people lane, where it is not made in the
   middle of a game somebody is losing.
   ════════════════════════════════════════════════ */

import { useEffect, useRef, useState } from "react";
import { A11Y } from "../../../../shared/tokens.js";
import { useI18n } from "../../../lib/i18n.jsx";
import { GAME, NO_SELECT } from "../gameSurface.js";
import { GameMotion, GamePill } from "../GameUI.jsx";
import { SEAT_COLORS, SEAT_INK, SEAT_COLOR_NAMES } from "../seatColors.js";
import { MUTE_KINDS, readMutes, setMuted } from "../tableMutes.js";
import { signedAvatarUrl, uploadAvatar, ACCEPTED, MAX_BYTES } from "../../profile/avatar.js";
import { useSignedAvatar } from "../gameAvatar.jsx";
import SampleAvatar, { sampleFor, SAMPLE_COUNT } from "../sampleAvatars.jsx";
import { updateMyProfile } from "../../profile/data.js";
import { fileReport } from "../../community/communityData.js";

function initialOf(name) {
  const s = (name || "").trim();
  if (!s) return "•";
  return [...s][0].toUpperCase();
}

/* One frosted row. Used for the three mutes and for Report, because
   they are the same shape of thing — a line about this person with a
   control at the end of it — and giving Report a different shape as
   well as a different colour would make it look like a mistake. */
function Row({ children, onClick, danger, label }) {
  const { ts } = useI18n();
  const body = (
    <span
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        width: "100%",
        minHeight: A11Y.minTapTargetPx,
        padding: "8px 14px",
        borderRadius: 12,
        background: danger ? GAME.report : GAME.glass,
        border: `1px solid ${danger ? "transparent" : GAME.glassEdge}`,
        color: GAME.ink,
        fontSize: ts(A11Y.minBodyPx),
        fontWeight: 600,
        boxSizing: "border-box",
        textAlign: "start",
      }}
    >
      {children}
    </span>
  );
  if (!onClick) return <div style={{ marginBottom: 8 }}>{body}</div>;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      style={{
        display: "block",
        width: "100%",
        marginBottom: 8,
        padding: 0,
        border: "none",
        background: "transparent",
        cursor: "pointer",
        font: "inherit",
      }}
    >
      {body}
    </button>
  );
}

/* On is TEAL, off is grey. Never a red for "muted": muting somebody
   is an ordinary, reversible thing and a red switch would make it
   feel like an accusation. The state is also written in words beside
   it, so the colour is never carrying it alone. */
function Switch({ on }) {
  return (
    <span
      aria-hidden="true"
      style={{
        flex: "0 0 auto",
        width: 50,
        height: 28,
        borderRadius: 14,
        background: on ? GAME.you : "#4A5058",
        position: "relative",
        transition: `background ${GAME.motionMs}ms ease`,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 3,
          insetInlineStart: on ? 25 : 3,
          width: 22,
          height: 22,
          borderRadius: 11,
          background: "#FFFFFF",
          transition: `inset-inline-start ${GAME.motionMs}ms ease`,
          boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
        }}
      />
    </span>
  );
}

export default function PlayerCard({
  sessionId,
  seat,
  row,
  isMe,
  myProfileId,
  myName,
  myAvatarPath,
  onClose,
  onNameChanged,
}) {
  const { t, ts } = useI18n();
  const [name, setName] = useState(myName || "");
  const [photo, setPhoto] = useState(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [mutes, setMutes] = useState({});
  const [reported, setReported] = useState(false);
  /* The sample-face picker, opened from the camera badge alongside
     uploading a real one. */
  const [picking, setPicking] = useState(false);
  const [sample, setSample] = useState(null);
  const fileRef = useRef(null);

  const profileId = row?.profile_id || null;
  const shownSample =
    sample ?? row?.avatar_sample ?? sampleFor(profileId, seat);
  const colour = SEAT_COLORS[seat];

  useEffect(() => {
    setMutes(readMutes(sessionId));
  }, [sessionId]);

  /* THEIR face, from the seat. Mine comes from my own profile and
     can change while the card is open — a fresh upload replaces it
     — so it stays in state; theirs is read straight off the table
     and cannot change under us. */
  const theirPhoto = useSignedAvatar(isMe ? null : row?.avatar || null);

  useEffect(() => {
    let alive = true;
    if (isMe && myAvatarPath) signedAvatarUrl(myAvatarPath).then((u) => alive && setPhoto(u));
    return () => {
      alive = false;
    };
  }, [isMe, myAvatarPath]);

  const pickPhoto = async (file) => {
    if (!file) return;
    if (file.size > MAX_BYTES) {
      setError(t("ludo.card.photoTooBig"));
      return;
    }
    setBusy(true);
    setError("");
    try {
      const path = await uploadAvatar(profileId, file);
      const url = await signedAvatarUrl(path);
      setPhoto(url);
    } catch {
      setError(t("games.actionError"));
    }
    setBusy(false);
  };

  const save = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      await updateMyProfile(profileId, { full_name: name.trim() });
      setSaved(true);
      onNameChanged?.(name.trim());
    } catch {
      setError(t("games.actionError"));
    }
    setBusy(false);
  };

  const toggle = (kind) => {
    const now = mutes[profileId]?.[kind] === true;
    setMutes(setMuted(sessionId, profileId, kind, !now));
  };

  const report = async () => {
    if (busy || reported) return;
    setBusy(true);
    try {
      /* ONE QUEUE. Admins watch community_reports and nothing
         else, so a game report is a community_reports row like
         every other kind — 0111 only had to widen the check
         constraint. The target id carries BOTH the table and the
         person, because a report naming only the person leaves a
         moderator with no idea what happened and one naming only
         the table leaves them with four people and a complaint
         about none of them. */
      await fileReport(
        myProfileId,
        "game_player",
        `${sessionId}:${profileId}`,
        profileId,
        null,
        null
      );
      setReported(true);
    } catch {
      setError(t("games.actionError"));
    }
    setBusy(false);
  };

  const displayName = row?.is_bot
    ? t("ludo.seat.bot")
    : row?.name || t("ludo.seat.someone");

  return (
    <>
      <GameMotion />
      <div
        className="sb-veil-in"
        onClick={onClose}
        style={{ position: "fixed", inset: 0, zIndex: 74, background: "rgba(0,0,0,0.5)" }}
        aria-hidden="true"
      />
      <section
        className="sb-panel-in"
        role="dialog"
        aria-modal="true"
        aria-label={isMe ? t("ludo.card.mine") : displayName}
        style={{
          ...NO_SELECT,
          position: "fixed",
          insetInline: 0,
          bottom: 0,
          zIndex: 75,
          maxHeight: "86dvh",
          overflowY: "auto",
          background: GAME.panel,
          border: "none",
          borderRadius: "18px 18px 0 0",
          boxShadow: GAME.panelShadow,
          padding: "14px 16px calc(18px + env(safe-area-inset-bottom))",
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={t("ludo.chat.close")}
          style={{
            display: "block",
            margin: "0 auto 10px",
            width: 64,
            height: 20,
            padding: 0,
            border: "none",
            background: "transparent",
            cursor: "pointer",
          }}
        >
          <span
            style={{
              display: "block",
              width: 44,
              height: 4,
              margin: "0 auto",
              borderRadius: 2,
              background: "rgba(255,255,255,0.28)",
            }}
          />
        </button>

        {/* ── The face ── */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
          <div style={{ position: "relative" }}>
            <span
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 84,
                height: 84,
                borderRadius: "50%",
                background: isMe ? GAME.you : colour,
                color: isMe ? GAME.youInk : SEAT_INK[seat],
                fontWeight: 800,
                fontSize: ts(34),
                overflow: "hidden",
                boxShadow: "0 8px 20px rgba(0,0,0,0.5)",
              }}
            >
              {(isMe ? photo : theirPhoto) ? (
                <img
                  src={isMe ? photo : theirPhoto}
                  alt=""
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : row?.is_bot ? (
                initialOf(displayName)
              ) : (
                <SampleAvatar index={shownSample} size={84} />
              )}
            </span>
            {/* THE CAMERA BADGE, on your own card only. White, on the
                shoulder, drawn rather than typed — 📷 is a different
                object on every platform and a blank box on some. */}
            {isMe && (
              <>
                <button
                  type="button"
                  onClick={() => setPicking((v) => !v)}
                  aria-label={t("ludo.card.changePhoto")}
                  disabled={busy}
                  style={{
                    position: "absolute",
                    insetInlineEnd: -2,
                    bottom: -2,
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    border: "none",
                    background: "#FFFFFF",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
                    padding: 0,
                  }}
                >
                  <svg width="17" height="17" viewBox="0 0 20 20" aria-hidden="true">
                    <path
                      d="M3 6.5A1.5 1.5 0 0 1 4.5 5h1.7l.9-1.5h5.8L13.8 5h1.7A1.5 1.5 0 0 1 17 6.5v8A1.5 1.5 0 0 1 15.5 16h-11A1.5 1.5 0 0 1 3 14.5Z"
                      fill="#17203A"
                    />
                    <circle cx="10" cy="10.4" r="3.1" fill="#FFFFFF" />
                  </svg>
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept={ACCEPTED}
                  onChange={(e) => pickPhoto(e.target.files?.[0])}
                  style={{ display: "none" }}
                />
              </>
            )}
          </div>
        </div>

        {isMe ? (
          <>
            {/* ── Your name, and the colour you were dealt ── */}
            <label
              htmlFor="sb-card-name"
              style={{
                display: "block",
                fontSize: ts(14),
                fontWeight: 700,
                color: GAME.inkMuted,
                marginBottom: 6,
              }}
            >
              {t("ludo.card.nameLabel")}
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <input
                id="sb-card-name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setSaved(false);
                }}
                autoComplete="name"
                style={{
                  flex: "1 1 auto",
                  minWidth: 0,
                  minHeight: A11Y.minTapTargetPx,
                  padding: "0 14px",
                  borderRadius: 12,
                  border: `1px solid ${GAME.glassEdge}`,
                  background: "rgba(255,255,255,0.10)",
                  color: GAME.ink,
                  fontSize: ts(A11Y.minBodyPx),
                  fontFamily: "inherit",
                }}
              />
              {/* THE SWATCH IS A FACT. No border, no chevron, nothing
                  that suggests a tap — and the colour's NAME beside it,
                  because colour never carries meaning alone. */}
              <span
                style={{
                  flex: "0 0 auto",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  padding: "0 10px",
                  height: A11Y.minTapTargetPx,
                  borderRadius: 12,
                  background: "rgba(255,255,255,0.06)",
                  color: GAME.inkMuted,
                  fontSize: ts(14),
                  fontWeight: 700,
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 5,
                    background: colour,
                  }}
                />
                {t(`ludo.card.colour.${SEAT_COLOR_NAMES[seat]}`)}
              </span>
            </div>

            {error && (
              <p role="alert" style={{ color: "#E85141", fontSize: ts(15), margin: "0 0 10px" }}>
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={save}
              disabled={busy || !name.trim()}
              style={{
                width: "100%",
                minHeight: A11Y.minTapTargetPx + 4,
                borderRadius: 14,
                border: "none",
                background: GAME.you,
                color: GAME.youInk,
                fontSize: ts(A11Y.minBodyPx),
                fontWeight: 800,
                cursor: busy ? "default" : "pointer",
                opacity: busy || !name.trim() ? 0.55 : 1,
              }}
            >
              {saved ? t("ludo.card.saved") : t("ludo.card.save")}
            </button>
            {/* PICK A FACE, OR USE A REAL ONE. The badge opens both
                rather than going straight to the camera roll: most
                people will never upload a photo, and the ones who
                will are not stopped by one extra tap. */}
            {picking && (
              <div style={{ marginBottom: 16 }}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(6, 1fr)",
                    gap: 8,
                    marginBottom: 12,
                  }}
                >
                  {Array.from({ length: SAMPLE_COUNT }).map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        setSample(i);
                        setPhoto(null);
                        updateMyProfile(profileId, { avatar_sample: i }).catch(() => {});
                      }}
                      aria-label={t("ludo.card.sample", { n: i + 1 })}
                      style={{
                        padding: 0,
                        border:
                          shownSample === i
                            ? `2px solid ${GAME.you}`
                            : "2px solid transparent",
                        borderRadius: "50%",
                        background: "transparent",
                        cursor: "pointer",
                        lineHeight: 0,
                      }}
                    >
                      <SampleAvatar index={i} size={40} />
                    </button>
                  ))}
                </div>
                <GamePill
                  onClick={() => fileRef.current?.click()}
                  style={{ width: "100%", minHeight: 48, justifyContent: "center" }}
                >
                  {t("ludo.card.upload")}
                </GamePill>
              </div>
            )}
          </>
        ) : (
          <>
            <p
              style={{
                textAlign: "center",
                margin: "0 0 14px",
                fontSize: ts(22),
                fontWeight: 800,
                color: GAME.ink,
              }}
              dir="auto"
            >
              {displayName}
            </p>

            {/* A bot has nothing to mute and nobody to report. */}
            {row?.is_bot ? (
              <p style={{ textAlign: "center", color: GAME.inkMuted, fontSize: ts(A11Y.minBodyPx), margin: 0 }}>
                {t("ludo.card.botNote")}
              </p>
            ) : (
              <>
                {MUTE_KINDS.map((kind) => {
                  const muted = mutes[profileId]?.[kind] === true;
                  return (
                    <Row
                      key={kind}
                      onClick={() => toggle(kind)}
                      label={t(`ludo.card.${kind}`) + " — " + t(muted ? "ludo.card.muted" : "ludo.card.on")}
                    >
                      <span>{t(`ludo.card.${kind}`)}</span>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: ts(14), fontWeight: 700, color: GAME.inkMuted }}>
                          {t(muted ? "ludo.card.muted" : "ludo.card.on")}
                        </span>
                        <Switch on={!muted} />
                      </span>
                    </Row>
                  );
                })}

                <div style={{ height: 6 }} />
                <Row
                  onClick={reported ? undefined : report}
                  danger
                  label={t("ludo.card.report")}
                >
                  <span style={{ fontWeight: 800 }}>
                    {reported ? t("ludo.card.reported") : t("ludo.card.report")}
                  </span>
                </Row>
                <p style={{ margin: "2px 2px 0", fontSize: ts(14), color: GAME.inkMuted }}>
                  {t("ludo.card.reportNote")}
                </p>
              </>
            )}
            {error && (
              <p role="alert" style={{ color: "#E85141", fontSize: ts(15), margin: "10px 0 0" }}>
                {error}
              </p>
            )}
          </>
        )}
      </section>
    </>
  );
}
