/* ════════════════════════════════════════════════
   Sharing a finished game — GAMES_BACKLOG A1.

   One sheet, several doors. The phone's own share sheet is the first
   of them, because that is what actually puts a picture in a WhatsApp
   thread — everything else here is a fallback or an in-app
   destination.

   WHAT EACH DOOR CAN CARRY, honestly, rather than pretending they are
   alike:

     phone sheet   image + text + link   (navigator.share with a file)
     save image    image                 (a download)
     copy link     link                  (clipboard)
     Community     image + text          (createPost takes a File)
     my people     a notification        (boastToPeople)
     a group       text + link           (addPost has no image column —
                                          so the card travels as a link
                                          rather than a picture, and the
                                          button says so)

   A door that cannot carry the picture says "link" on it. The
   alternative is a person tapping "send to a group", seeing nothing
   arrive but a URL, and concluding the app is broken.

   NOTHING HERE IS A SCORE. The text says who won and nothing about
   how often, how well, or against whom — the same rule the card and
   the celebration screen keep.
   ════════════════════════════════════════════════ */

import { useEffect, useRef, useState } from "react";
import { COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { useSession } from "../../lib/session.jsx";
import { pushToast } from "../../lib/feedback.jsx";
import { renderBoastCard, blobToUrl } from "./boastCard.js";
import { boastToPeople } from "../../lib/games.js";
import { createPost } from "../community/communityData.js";
import { fetchMyGroups, addPost } from "../groups/groupsStore.js";

/* The public page a shared link points at. Absolute, because it is
   going into somebody else's WhatsApp. */
export function resultUrl(sessionId) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/app/g/${sessionId}`;
}

function Row({ onClick, disabled, glyph, label, note, done }) {
  const { ts } = useI18n();
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        width: "100%",
        minHeight: 62,
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 14px",
        borderRadius: 16,
        border: `2px solid ${done ? C.green : C.warmGray}`,
        background: C.white,
        color: C.textMain,
        fontFamily: "inherit",
        fontSize: ts(A11Y.minBodyPx),
        fontWeight: 700,
        textAlign: "start",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.55 : 1,
      }}
    >
      <span aria-hidden="true" style={{ fontSize: ts(24), flexShrink: 0 }}>{done ? "✓" : glyph}</span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: "block" }}>{label}</span>
        {note && (
          <span style={{ display: "block", fontSize: ts(A11Y.minBodyPx), fontWeight: 400, color: C.textMuted }}>
            {note}
          </span>
        )}
      </span>
    </button>
  );
}

export default function BoastSheet({ open, onClose, sessionId, players, pieces, seatsInPlay }) {
  const { t, ts, meta, lang } = useI18n();
  const { profile } = useSession();
  const [card, setCard] = useState(null); // { blob, url }
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState({});
  const [groups, setGroups] = useState([]);
  const [pickGroup, setPickGroup] = useState(false);
  const madeFor = useRef(null);

  const winner = players.find((p) => p.isWinner) || null;
  const url = resultUrl(sessionId);
  const shareText = winner
    ? t("ludo.boast.shareText", { name: winner.name })
    : t("ludo.boast.shareTextNoName");

  /* The card is drawn once per game, when the sheet first opens —
     not on mount, because most people never tap share and a canvas
     nobody asked for is work nobody wanted. */
  useEffect(() => {
    if (!open || madeFor.current === sessionId) return;
    let alive = true;
    let objectUrl = null;
    (async () => {
      try {
        const blob = await renderBoastCard({
          players,
          pieces,
          seatsInPlay,
          fonts: meta.fonts,
          text: {
            title: t("ludo.boast.cardTitle"),
            winnerLine: t("ludo.boast.cardLine"),
            date: new Intl.DateTimeFormat(lang === "ur" ? "ur-PK" : "en-GB", {
              day: "numeric",
              month: "long",
              year: "numeric",
            }).format(new Date()),
            mark: t("ludo.boast.mark"),
          },
        });
        if (!alive) return;
        objectUrl = blobToUrl(blob);
        madeFor.current = sessionId; // claimed only now that one exists
        setCard({ blob, url: objectUrl });
      } catch {
        /* The card is the nice version of sharing, not the only one —
           a failed canvas still leaves the link and the in-app doors
           working, so say so quietly rather than closing the sheet. */
        if (alive) setError(true);
      }
    })();
    return () => {
      alive = false;
      /* Only revoke a URL this attempt created and never handed over —
         revoking the live card's URL would blank the preview. */
      if (objectUrl && madeFor.current !== sessionId) URL.revokeObjectURL(objectUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sessionId]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const fileOf = () =>
    card ? new File([card.blob], `saathban-ludo-${sessionId.slice(0, 8)}.png`, { type: "image/png" }) : null;

  const run = async (key, fn, msg) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      setDone((d) => ({ ...d, [key]: true }));
      if (msg) pushToast(msg);
    } catch {
      pushToast(t("ludo.boast.failed"), { tone: "error", key: "boast" });
    }
    setBusy(false);
  };

  /* navigator.share needs a user gesture and a secure context, and
     canShare({files}) is the only honest test of whether this phone
     will take the picture — plenty of browsers have share but refuse
     files. */
  const file = fileOf();
  const canShareFiles =
    typeof navigator !== "undefined" &&
    navigator.canShare &&
    file &&
    navigator.canShare({ files: [file] });

  const phoneShare = async () => {
    const payload = canShareFiles
      ? { files: [fileOf()], text: shareText, title: t("ludo.boast.cardTitle") }
      : { text: shareText, url, title: t("ludo.boast.cardTitle") };
    try {
      await navigator.share(payload);
    } catch (err) {
      // Dismissing the sheet is a decision, not a failure.
      if (err && err.name === "AbortError") return;
      throw err;
    }
  };

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, zIndex: 95, background: "rgba(45,36,24,0.4)" }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("ludo.boast.sheetTitle")}
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 96,
          background: C.cream,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          padding: "16px 14px calc(18px + env(safe-area-inset-bottom, 0px))",
          maxHeight: "88vh",
          overflowY: "auto",
          boxShadow: "0 -10px 34px rgba(45,36,24,0.3)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <h2
            style={{
              flex: 1,
              margin: 0,
              fontFamily: meta.fonts.heading,
              fontSize: ts(24),
              fontWeight: 700,
              color: C.green,
            }}
          >
            {t("ludo.boast.sheetTitle")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              minHeight: A11Y.minTapTargetPx,
              minWidth: A11Y.minTapTargetPx,
              borderRadius: 50,
              border: `2px solid ${C.warmGray}`,
              background: C.white,
              color: C.textMain,
              fontSize: ts(A11Y.minBodyPx),
              fontWeight: 700,
              fontFamily: "inherit",
              cursor: "pointer",
            }}
          >
            {t("ludo.quick.close")}
          </button>
        </div>

        {/* The card itself, so nobody sends a picture they have not seen */}
        <div style={{ textAlign: "center", marginBottom: 14 }}>
          {card ? (
            <img
              src={card.url}
              alt={t("ludo.boast.cardAlt")}
              style={{ width: "100%", maxWidth: 320, borderRadius: 18, border: `2px solid ${C.warmGray}` }}
            />
          ) : error ? (
            <p role="status" style={{ margin: 0, fontSize: ts(A11Y.minBodyPx), color: C.textMuted }}>
              {t("ludo.boast.cardFailed")}
            </p>
          ) : (
            <p role="status" style={{ margin: 0, fontSize: ts(A11Y.minBodyPx), color: C.textMuted }}>
              {t("ludo.boast.preparing")}
            </p>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {typeof navigator !== "undefined" && navigator.share && (
            <Row
              glyph="📲"
              label={t("ludo.boast.phone")}
              note={canShareFiles ? t("ludo.boast.withPicture") : t("ludo.boast.linkOnly")}
              disabled={busy}
              onClick={() => run("phone", phoneShare)}
            />
          )}

          {card && (
            <Row
              glyph="⬇️"
              label={t("ludo.boast.save")}
              disabled={busy}
              done={done.save}
              onClick={() =>
                run("save", async () => {
                  const a = document.createElement("a");
                  a.href = card.url;
                  a.download = `saathban-ludo-${sessionId.slice(0, 8)}.png`;
                  document.body.appendChild(a);
                  a.click();
                  a.remove();
                }, t("ludo.boast.saved"))
              }
            />
          )}

          <Row
            glyph="🔗"
            label={t("ludo.boast.copy")}
            note={url}
            disabled={busy}
            done={done.copy}
            onClick={() => run("copy", () => navigator.clipboard.writeText(url), t("ludo.boast.copied"))}
          />

          <Row
            glyph="🏘️"
            label={t("ludo.boast.community")}
            note={card ? t("ludo.boast.withPicture") : t("ludo.boast.linkOnly")}
            disabled={busy}
            done={done.community}
            onClick={() =>
              run("community", () =>
                createPost(
                  profile.id,
                  `${shareText}\n${url}`,
                  card ? new File([card.blob], "ludo.png", { type: "image/png" }) : null
                ), t("ludo.boast.postedCommunity"))
            }
          />

          <Row
            glyph="💚"
            label={t("ludo.boast.people")}
            note={t("ludo.boast.peopleNote")}
            disabled={busy}
            done={done.people}
            onClick={() =>
              run("people", () => boastToPeople("win", sessionId, { game: t("ludo.title"), link: `/app/games/ludo/${sessionId}` }),
                t("ludo.boast.toldPeople"))
            }
          />

          <Row
            glyph="👨‍👩‍👧"
            label={t("ludo.boast.group")}
            note={t("ludo.boast.linkOnly")}
            disabled={busy}
            done={done.group}
            onClick={async () => {
              if (!pickGroup) {
                setPickGroup(true);
                try {
                  setGroups(await fetchMyGroups());
                } catch {
                  setGroups([]);
                }
              }
            }}
          />

          {pickGroup && (
            <div style={{ paddingInlineStart: 12, display: "flex", flexDirection: "column", gap: 8 }}>
              {groups.length === 0 ? (
                <p style={{ margin: 0, fontSize: ts(A11Y.minBodyPx), color: C.textMuted }}>
                  {t("ludo.boast.noGroups")}
                </p>
              ) : (
                groups.map((g) => (
                  <Row
                    key={g.id}
                    glyph="›"
                    label={g.name}
                    disabled={busy}
                    done={done[`g:${g.id}`]}
                    onClick={() =>
                      run(`g:${g.id}`, () => addPost(g.id, `${shareText}\n${url}`), t("ludo.boast.sentGroup"))
                    }
                  />
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
