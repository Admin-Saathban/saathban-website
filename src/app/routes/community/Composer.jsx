/* ════════════════════════════════════════════════
   The composer — POSTS_SPEC.md §1–§5.

   It did not exist. There was no visible way to write a post from
   Home: an always-open textarea Card sat in the feed, which is a form
   permanently occupying the place a post should be.

   ON HOME it is now ONE ROW — "Say something to your neighbours" and a
   photo glyph. No avatar (the header already carries that face, and
   two of the same face on one screen is noise). It scrolls away with
   the feed; there is no floating button (MOTION_SPEC §5).

   OPENED it is full screen: Close · New post · Share, then the
   visibility line in plain words, the text, the colours, the tags, and
   the three attachments.

   THE VISIBILITY LINE IS A SENTENCE, NOT A TOGGLE. §2: "For Icons who
   do not know what public means, the line under the composer says what
   it does rather than naming a mode." So it reads "Anyone on Saathban
   can see this", and the picker is a sheet of three plain choices.

   COLOUR IS SEPARATE FROM TAG (§3, §4). Colour is how it looks; the
   tag is what kind of thing it is. That separation is what lets "A
   milestone" earn a badge without Saathban inventing meaning — the
   person declared it themselves, which keeps principle 10 intact.

   "ASKING FOR HELP" IS NOT A VIOLATION OF PRINCIPLE 1 (§4). Principle
   1 forbids THE APP framing an Icon as needing help. A person choosing
   to say "I can't manage the ladder" is the opposite of that, and it
   is the most valuable post a neighbourhood app can carry.
   ════════════════════════════════════════════════ */

import { useEffect, useRef, useState } from "react";
import { APP_COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import Icon from "../../components/Icon.jsx";
import { useSession } from "../../lib/session.jsx";
import { MotionStyles } from "../../lib/motion.jsx";
import DiscardDialog from "./DiscardDialog.jsx";
import { SWATCHES, STYLE_TAGS, VISIBILITIES } from "./postsData.js";
import { fetchMyPeople } from "../people/myPeopleStore.js";
import { VoiceRecorder, VoicePlayer } from "../people/VoiceNote.jsx";
/* PostComposer only — see the block at the foot of this file. */
import { createPost } from "./communityData.js";
import { useToast } from "../../lib/feedback.jsx";
import useBackToClose from "../../components/useBackToClose";

/* ── The row that lives in the feed ── */
export function ComposerRow({ onOpen }) {
  const { t, ts } = useI18n();
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        background: C.white,
        border: `1px solid ${C.warmGray}`,
        borderRadius: 50,
        padding: "6px 8px 6px 18px",
        marginBottom: 16,
      }}
    >
      <button
        type="button"
        onClick={() => onOpen(null)}
        style={{
          flex: 1,
          minHeight: A11Y.minTapTargetPx,
          border: "none",
          background: "transparent",
          color: C.textMuted,
          fontFamily: "inherit",
          fontSize: ts(A11Y.minBodyPx),
          textAlign: "start",
          cursor: "pointer",
        }}
      >
        {t("posts.rowPlaceholder")}
      </button>
      <button
        type="button"
        onClick={() => onOpen("photo")}
        aria-label={t("posts.addPhoto")}
        style={{
          minWidth: A11Y.minTapTargetPx,
          minHeight: A11Y.minTapTargetPx,
          borderRadius: 50,
          border: "none",
          background: "transparent",
          fontSize: ts(22),
          cursor: "pointer",
        }}
      >
        <Icon name="camera" size={20} style={{ color: C.textMuted }} />
      </button>
    </div>
  );
}

/* ── The full screen ── */
export default function Composer({ open, startWith, onClose, onShare, busy }) {
  const { t, ts, meta } = useI18n();
  const { profile } = useSession();
  const fileRef = useRef(null);

  const [body, setBody] = useState("");
  const [file, setFile] = useState(null);
  const [visibility, setVisibility] = useState("public");
  const [colour, setColour] = useState(null);
  const [styleTag, setStyleTag] = useState(null);
  const [helpWanted, setHelpWanted] = useState(1);
  const [pickVis, setPickVis] = useState(false);
  const [pickPeople, setPickPeople] = useState(false);
  const [tagged, setTagged] = useState([]);
  const [people, setPeople] = useState(null);
  /* §7 — one minute, and only the poster ever records. Replies to a
     voice post are text and stickers; there is deliberately no
     recorder on the comment box. */
  const [voice, setVoice] = useState(null);   // { blob, seconds, mime, url }
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  /* A RECORDING COUNTS. It is the draft that cannot be retyped from
     memory, and the person who chose the microphone over the keyboard
     is usually the one for whom typing it again is the hard part. */
  const hasDraft = () => !!body.trim() || !!file || !!voice;

  const askClose = () => { if (hasDraft()) setConfirmDiscard(true); else { reset(); onClose(); } };

  /* Back ASKS. It does not discard, and it does not leave the
     screen underneath — both of which it did before. */
  useBackToClose(open, askClose);

  /* Only fetched when the picker is actually opened — a list of names
     loaded for a post that mentions nobody is a query nobody asked
     for. */
  useEffect(() => {
    if (!pickPeople || people !== null) return;
    fetchMyPeople().then(setPeople).catch(() => setPeople([]));
  }, [pickPeople, people]);

  if (!open) return null;

  /* §3 — the swatches stop applying once it runs long or carries a
     photo, and the screen SHOWS that rather than silently dropping it
     later: the preview goes plain in front of the person. */
  const colourApplies = !file && body.trim().length <= 180;
  const bg = colour != null && colourApplies ? SWATCHES[colour] : C.white;

  const reset = () => {
    setBody(""); setFile(null); setVisibility("public");
    setColour(null); setStyleTag(null); setHelpWanted(1); setPickVis(false);
    setTagged([]); setPickPeople(false);
    if (voice?.url) URL.revokeObjectURL(voice.url);
    setVoice(null);
  };

  const share = async () => {
    /* A voice post may carry no words at all — that is the point of
       it — so Share is live when there is EITHER something written or
       something recorded. */
    if ((!body.trim() && !voice) || busy) return;
    const ok = await onShare({
      body, file, visibility, colour, styleTag, helpWanted, tagged,
      audio: voice ? { blob: voice.blob, seconds: voice.seconds, mime: voice.mime } : null,
    });
    if (ok) { reset(); onClose(); }
  };

  const chip = (on) => ({
    minHeight: A11Y.minTapTargetPx,
    padding: "0 16px",
    borderRadius: 50,
    border: on ? `2.5px solid ${C.green}` : `1.5px solid ${C.warmGray}`,
    background: on ? C.selected : C.white,
    color: on ? C.green : C.textMain,
    fontFamily: "inherit",
    fontSize: ts(A11Y.minBodyPx),
    fontWeight: on ? 700 : 600,
    cursor: "pointer",
  });

  return (
    <div
      dir={meta.dir}
      className="sb-push"
      /* A FULL-SCREEN SURFACE IS A DIALOG OR IT IS NOTHING.

         This covers the entire feed and takes the typing, and it was
         an anonymous <div> — so a screen reader announced no change of
         context, gave the surface no name, and left every post behind
         it still reachable underneath. Someone using the app by voice
         or by keyboard was writing into a box the app had not told
         them about, over a feed it had not told them was gone.

         It is also why no audit found it: Lane 2's scan keyed on
         role="dialog", and the one role in this file is on the
         visibility picker further down, not on the surface itself.
         The thing most in need of being announced was the thing least
         visible to the tool looking for it. */
      role="dialog"
      aria-modal="true"
      aria-label={t("posts.newPost")}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 70,
        background: C.bg,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <MotionStyles />

      {confirmDiscard && (
        <DiscardDialog
          onKeep={() => setConfirmDiscard(false)}
          onDiscard={() => { setConfirmDiscard(false); reset(); onClose(); }}
        />
      )}

      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 12px",
          borderBottom: `1px solid ${C.warmGray}`,
          background: C.white,
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          onClick={askClose}
          style={{ minWidth: A11Y.minTapTargetPx, minHeight: A11Y.minTapTargetPx, border: "none", background: "transparent", color: C.textMain, fontSize: ts(22), cursor: "pointer" }}
        >
          {t("posts.close")}
        </button>
        <h1 style={{ flex: 1, margin: 0, textAlign: "center", fontSize: ts(20), fontWeight: 800, color: C.textMain }}>
          {t("posts.newPost")}
        </h1>
        <button
          type="button"
          onClick={share}
          disabled={busy || (!body.trim() && !voice)}
          style={{
            minHeight: A11Y.minTapTargetPx,
            padding: "0 22px",
            borderRadius: 50,
            border: "none",
            background: C.green,
            color: C.cream,
            fontFamily: "inherit",
            fontSize: ts(A11Y.minBodyPx),
            fontWeight: 800,
            opacity: busy || (!body.trim() && !voice) ? 0.5 : 1,
            cursor: busy || (!body.trim() && !voice) ? "default" : "pointer",
          }}
        >
          {busy ? "…" : t("posts.share")}
        </button>
      </header>

      <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px 24px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <p style={{ margin: "0 0 2px", fontSize: ts(19), fontWeight: 700, color: C.textMain }}>
            {profile?.full_name}
          </p>
          {/* §2 — plain words, and a chevron into the choice. */}
          <button
            type="button"
            onClick={() => setPickVis(true)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              minHeight: A11Y.minTapTargetPx, padding: "0 14px 0 0",
              border: "none", background: "transparent", color: C.textMuted,
              fontFamily: "inherit", fontSize: ts(16), cursor: "pointer",
            }}
          >
            <Icon name="globe" size={18} style={{ color: C.textMuted }} />
            {t(`posts.vis.${visibility}Line`)}
            <span aria-hidden="true">›</span>
          </button>

          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={6}
            maxLength={4000}
            autoFocus
            placeholder={t("posts.rowPlaceholder")}
            dir={meta.dir}
            style={{
              width: "100%",
              boxSizing: "border-box",
              marginTop: 10,
              fontFamily: "inherit",
              fontSize: ts(colour != null && colourApplies ? 22 : A11Y.minBodyPx),
              lineHeight: 1.5,
              fontWeight: colour != null && colourApplies ? 700 : 400,
              textAlign: colour != null && colourApplies ? "center" : "start",
              color: C.textMain,
              background: bg,
              border: `2px solid ${C.warmGray}`,
              borderRadius: 16,
              padding: "14px",
              resize: "vertical",
            }}
          />

          {/* Said in front of the person, not discovered afterwards. */}
          {colour != null && !colourApplies && (
            <p style={{ margin: "6px 0 0", fontSize: ts(15), color: C.textMuted }}>
              {t("posts.colourDropped")}
            </p>
          )}

          {/* §3 colours */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
            <button
              type="button"
              onClick={() => setColour(null)}
              aria-pressed={colour === null}
              aria-label={t("posts.plain")}
              style={{ ...chip(colour === null), minWidth: 52 }}
            >
              Aa
            </button>
            {SWATCHES.map((sw, i) => (
              <button
                key={sw}
                type="button"
                onClick={() => setColour(i)}
                aria-pressed={colour === i}
                aria-label={t("posts.swatch", { n: i + 1 })}
                style={{
                  minWidth: A11Y.minTapTargetPx,
                  minHeight: A11Y.minTapTargetPx,
                  borderRadius: 50,
                  background: sw,
                  border: colour === i ? `3px solid ${C.green}` : `1.5px solid ${C.warmGray}`,
                  cursor: "pointer",
                }}
              >
                {/* Never colour alone: the chosen swatch carries a tick. */}
                <span aria-hidden="true" style={{ color: C.green, fontWeight: 900 }}>
                  {colour === i ? <Icon name="check" size={16} /> : null}
                </span>
              </button>
            ))}
          </div>

          {/* §4 style tags */}
          <p style={{ margin: "18px 0 8px", fontSize: ts(16), fontWeight: 700, color: C.textMuted }}>
            {t("posts.tagLabel")}
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {STYLE_TAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setStyleTag(styleTag === tag ? null : tag)}
                aria-pressed={styleTag === tag}
                style={chip(styleTag === tag)}
              >
                {t(`posts.tag.${tag}`)}
              </button>
            ))}
          </div>

          {/* §6.2 — the poster sets how many helpers they want. */}
          {styleTag === "help" && (
            <div style={{ marginTop: 14, padding: "12px 14px", borderRadius: 14, background: C.tint, border: `1.5px solid ${C.navEdge}` }}>
              <p style={{ margin: "0 0 8px", fontSize: ts(16), color: C.textMain, fontWeight: 600 }}>
                {t("posts.help.wanted")}
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                {[1, 2, 3].map((n) => (
                  <button key={n} type="button" onClick={() => setHelpWanted(n)} aria-pressed={helpWanted === n} style={chip(helpWanted === n)}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* §1's three attachments */}
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            style={{ position: "absolute", width: 1, height: 1, opacity: 0 }}
          />
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 18 }}>
            <button type="button" onClick={() => fileRef.current?.click()} style={chip(!!file)}>
              <Icon name="camera" size={18} />{" "}
              {file ? t("posts.photoChosen") : t("posts.photo")}
            </button>
            <button type="button" onClick={() => setPickPeople((v) => !v)} style={chip(tagged.length > 0)}>
              <Icon name="people" size={18} />{" "}
              {tagged.length ? t("posts.withCount", { n: tagged.length }) : t("posts.withSomeone")}
            </button>
            {/* §7 — one minute maximum, enforced in the recorder. */}
            {!voice && (
              <VoiceRecorder
                maxSeconds={60}
                label={t("posts.voice")}
                onRecorded={(blob, seconds, mime) =>
                  setVoice({ blob, seconds, mime, url: URL.createObjectURL(blob) })
                }
              />
            )}
          </div>

          {/* Heard back before it is sent. A voice post is the one thing
              in the composer a person cannot check by looking at it. */}
          {voice && (
            <div style={{ marginTop: 12 }}>
              <VoicePlayer url={voice.url} seconds={voice.seconds} />
              <button
                type="button"
                onClick={() => { URL.revokeObjectURL(voice.url); setVoice(null); }}
                style={{
                  marginTop: 8, minHeight: A11Y.minTapTargetPx, padding: "0 18px",
                  borderRadius: 50, border: `2px solid ${C.warmGray}`, background: C.white,
                  color: C.textMain, fontFamily: "inherit", fontSize: ts(16),
                  fontWeight: 700, cursor: "pointer",
                }}
              >
                {t("posts.voiceAgain")}
              </button>
            </div>
          )}

          {/* §5 — "With someone". The tagged person is ASKED, never
              assumed: the row lands unaccepted, they are told, they can
              remove it, and they can turn tagging off altogether. For
              an event they become a co-host only AFTER they accept —
              Fam-proposes-Icon-disposes, applied to everyone. */}
          {pickPeople && (
            <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: 14, background: C.white, border: `1.5px solid ${C.warmGray}` }}>
              {people === null ? (
                <p style={{ margin: 0, color: C.textMuted, fontSize: ts(16) }}>···</p>
              ) : people.length === 0 ? (
                <p style={{ margin: 0, color: C.textMuted, fontSize: ts(16) }}>{t("posts.withNobody")}</p>
              ) : (
                people.map((person) => {
                  const on = tagged.includes(person.id);
                  return (
                    <button
                      key={person.id}
                      type="button"
                      onClick={() =>
                        setTagged((cur) => (on ? cur.filter((x) => x !== person.id) : [...cur, person.id]))
                      }
                      aria-pressed={on}
                      style={{
                        display: "flex", alignItems: "center", gap: 10, width: "100%",
                        minHeight: A11Y.minTapTargetPx, padding: "8px 6px",
                        border: "none", background: "transparent", fontFamily: "inherit",
                        fontSize: ts(A11Y.minBodyPx), color: C.textMain, textAlign: "start", cursor: "pointer",
                      }}
                    >
                      <span aria-hidden="true" style={{ color: on ? C.green : C.textMuted, fontWeight: 800 }}>
                        <Icon name={on ? "check" : "close"} size={16} />
                      </span>
                      {person.full_name}
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>

      {/* §2 — the visibility sheet: three plain choices, one decision. */}
      {pickVis && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t("posts.vis.title")}
          onClick={() => setPickVis(false)}
          className="sb-dim"
          style={{ position: "fixed", inset: 0, zIndex: 90, background: "rgba(45,36,24,0.45)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="sb-sheet"
            style={{ width: "100%", maxWidth: 640, background: C.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: "18px 16px calc(18px + env(safe-area-inset-bottom))" }}
          >
            <h2 style={{ margin: "0 0 12px", fontSize: ts(20), fontWeight: 800, color: C.green }}>
              {t("posts.vis.title")}
            </h2>
            {VISIBILITIES.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => { setVisibility(v); setPickVis(false); }}
                style={{
                  display: "flex", alignItems: "flex-start", gap: 12, width: "100%",
                  minHeight: 62, padding: "12px 14px", marginBottom: 10,
                  borderRadius: 14,
                  border: visibility === v ? `3px solid ${C.green}` : `2px solid ${C.warmGray}`,
                  background: visibility === v ? C.selected : C.white,
                  fontFamily: "inherit", textAlign: "start", cursor: "pointer",
                }}
              >
                <span aria-hidden="true" style={{ fontSize: ts(20), fontWeight: 800, color: visibility === v ? C.green : C.textMuted }}>
                  <Icon name={visibility === v ? "check" : "close"} size={16} />
                </span>
                <span>
                  <span style={{ display: "block", fontSize: ts(A11Y.minBodyPx), fontWeight: 700, color: C.textMain }}>
                    {t(`posts.vis.${v}`)}
                  </span>
                  <span style={{ display: "block", fontSize: ts(16), color: C.textMuted, marginTop: 2 }}>
                    {t(`posts.vis.${v}Line`)}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════
   PostComposer — the composer, mountable anywhere.

   NAVIGATION_SPEC §4 orders Home as header, composer, today's log row,
   then feed. The composer lived inside Feed, and the log row belongs to
   IconHub, so on Home it drew BELOW the log — content second. The owner
   ruled twice that it must be above.

   The seam is Lane 38's design and their words: a self-contained
   component that needs no props, and a `saath:posted` CustomEvent so
   that whatever is showing the feed can react to a successful post
   without owning the composer. Written here rather than by them only
   because they offered it explicitly while their own night was
   elsewhere — the contract is theirs unchanged.

   WHY AN EVENT AND NOT A CALLBACK. §11 requires sharing to LAND on the
   post: the feed reloads, scrolls to the new row and highlights it. If
   the composer is mounted in IconHub and the feed in Feed, a callback
   would have to be threaded through a component that renders neither.
   An event is how lib/sound.js already does this, so it is the pattern
   the repo has rather than a new one.

   Two events, not one, because losing the optimistic row would be a
   real regression on a slow connection:
     saath:posting  {key, body, hasPhoto}  — a row to show at once
     saath:posted   {id, key, tagsFailed}  — it landed; reload and mark

   THE FAILURE STAYS HERE, deliberately, and that is Lane 38's rule
   preserved: a refusal has no result and no home to land on, so it
   keeps its line, its Retry, and the words coming back to the composer.
   The composer is the only thing that still holds those words.
   ════════════════════════════════════════════════ */
export function PostComposer() {
  const { t } = useI18n();
  const { profile } = useSession();
  const { toast: raiseToast } = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const share = async (opts) => {
    const draftBody = (opts?.body || "").trim();
    /* §7 — a voice post may carry no words at all. */
    if ((!draftBody && !opts?.audio) || busy) return false;
    const key = `pending-${Date.now()}`;
    setBusy(true);
    window.dispatchEvent(
      new CustomEvent("saath:posting", {
        detail: { key, body: draftBody, hasPhoto: !!opts.file },
      })
    );
    try {
      const row = await createPost(profile.id, draftBody, opts.file || null, {
        visibility: opts.visibility,
        colour: opts.colour,
        styleTag: opts.styleTag,
        helpWanted: opts.helpWanted,
        tagged: opts.tagged || [],
        audio: opts.audio || null,
      });
      window.dispatchEvent(
        new CustomEvent("saath:posted", {
          detail: { id: row?.id, key, tagsFailed: !!row?.tagsFailed },
        })
      );
      return true;
    } catch {
      window.dispatchEvent(new CustomEvent("saath:post-failed", { detail: { key } }));
      raiseToast(t("feedback.postFailed"), {
        tone: "error",
        actionLabel: t("feedback.retry"),
        onAction: () => share(opts),
      });
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (!profile) return null;
  return (
    <>
      <ComposerRow onOpen={() => setOpen(true)} />
      <Composer
        open={open}
        startWith={null}
        onClose={() => setOpen(false)}
        onShare={share}
        busy={busy}
      />
    </>
  );
}
