/* ════════════════════════════════════════════════
   Community feed — /app/community.

   Chronological, nothing else (SPEC.md: no algorithm). Icons and the
   org account write; everyone else reads and may react. Report, mute,
   and block sit one tap away on every post and comment via the ⋯
   menu (SPEC.md: non-negotiable). RLS decides what arrives: a muted
   or blocked author's rows simply never come back after refetch.
   ════════════════════════════════════════════════ */

import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { claimOpenSeat } from "../../lib/games.js";
import { APP_COLORS as C, A11Y, MEANING } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import Icon from "../../components/Icon.jsx";
import { MotionStyles, MOTION } from "../../lib/motion.jsx";
import DiscardDialog from "./DiscardDialog.jsx";
import useBackToClose from "../../components/useBackToClose.js";
import { useSession } from "../../lib/session.jsx";
import { REACTIONS, REACTION_ICON, REACTION_LABEL, REACTION_TONE, HEART } from "./communityCopy.js";
import {
  canUseCommunity,
  canPostCommunity,
  fetchFeed,
  widenFeed,
  fetchGroupNeighbourIds,
  fetchAuthors,
  fetchReactions,
  fetchComments,
  createPost,
  deleteOwnPost,
  addComment,
  setReaction,
  clearReaction,
  fileReport,
  blockOrMute,
  unblock,
  sendDmRequest,
  imageUrl,
  fetchPlacesLite,
  shareActivity,
  joinActivity,
  fetchJoins,
  joinWalk,
  fetchConnections,
} from "./communityData.js";
import { CommunityScreen, Card, BodyText, PrimaryBtn, GhostBtn } from "./ui.jsx";
import Composer, { ComposerRow } from "./Composer.jsx";
import PostMenu from "./PostMenu.jsx";
import HelpStrip from "./HelpStrip.jsx";
import ReconnectRow from "./ReconnectRow.jsx";
import PlaySomethingSheet from "./PlaySomethingSheet.jsx";
import { fetchFeedGroupPosts } from "../groups/groupsStore.js";
import { pickReconnect, rowAllowed, markRowSeen, hushPerson } from "./reconnect.js";
import { fetchChats } from "../messages/messagesData.js";
import SayHelloSheet from "../messages/SayHelloSheet.jsx";
import { VoicePlayer } from "../people/VoiceNote.jsx";
import { openDmWith } from "../people/peopleStore.js";
import StickerPicker from "../../assets/stickers/StickerPicker.jsx";
import { Sticker, parseStickerRef, stickerRef } from "../../assets/stickers/stickers.jsx";
import {
  colourOf,
  postAudioUrl,
  fetchHelpExtras,
  offerHelp,
  reopenHelp,
  withdrawOffer,
  markHelpDone,
  closeHelp,
  helpStatusOf,
  toggleSave,
  toggleFollow,
  showLessFrom,
  copyLink,
  setVisibility as setPostVisibility,
  setRepliesOff,
  setPinned,
  removeTag,
  editBody,
  hidePost,
  unhidePost,
  fetchMyHiddenPostIds,
} from "./postsData.js";
import { useToast, useFresh } from "../../lib/feedback.jsx";
import RichText from "../../lib/richText.jsx";

/* §7 shows where a post came from as a small label — the area if the
   author has one, else the city. It is information, not a filter: there
   is nothing to tap and nothing to set. Saathban's own posts carry no
   origin, because the org is not somewhere. */
function OriginLabel({ author }) {
  const { ts } = useI18n();
  if (!author || author.is_org) return null;
  const where = (author.area || author.city || "").trim();
  if (!where) return null;
  return (
    <span style={{ fontSize: ts(14), color: C.textMuted }}>· {where}</span>
  );
}

function AuthorLine({ author, when, dateLocale }) {
  const { t, ts } = useI18n();
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
      <span style={{ fontSize: ts(19), fontWeight: 700, color: C.green }}>
        {author?.full_name || "…"}
      </span>
      <OriginLabel author={author} />
      {author?.is_org && (
        <span
          style={{
            fontSize: ts(14),
            fontWeight: 700,
            color: C.cream,
            background: C.green,
            borderRadius: 50,
            padding: "3px 12px",
          }}
        >
          {t("community.feed.announcement")}
        </span>
      )}
      <span style={{ fontSize: ts(15), color: C.textMuted }}>
        {new Date(when).toLocaleString(dateLocale, {
          day: "numeric",
          month: "short",
          hour: "numeric",
          minute: "2-digit",
        })}
      </span>
    </div>
  );
}

/* Inline report form — small, no prompt() dialogs. */
function ReportForm({ onSend, onCancel }) {
  const { t } = useI18n();
  const [reason, setReason] = useState("");
  return (
    <div style={{ marginTop: 12 }}>
      <BodyText muted style={{ marginBottom: 6 }}>{t("community.feed.reportPrompt")}</BodyText>
      <textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
      <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
        <PrimaryBtn onClick={() => onSend(reason)}>{t("community.feed.menuReport")}</PrimaryBtn>
        <GhostBtn onClick={onCancel}><Icon name="close" size={18} /></GhostBtn>
      </div>
    </div>
  );
}

/* The typed share block inside a post card (migration 0018). Renders
   entirely from the payload snapshot, localized at view time. */
function ShareBlock({ post, isIcon, own, dateLocale, joinInfo, onAction }) {
  const { t, ts, lang } = useI18n();
  const p = post.payload || {};
  /* THE LOCKED CARD LANGUAGE: a recessed surface and a hairline, not a
     heavy accent outline. This was C.selected inside a 2px C.green
     border — a treatment from the palette that has been replaced, and
     the loudest object in the feed for something that is only an
     embedded panel inside somebody's post.

     Ground rather than surface, because it sits INSIDE a post card that
     is already the surface; recessed is what an embedded panel is. */
  const box = {
    background: C.ground,
    /* warmGray, not navEdge. navEdge is the hairline for the DARK
       chrome and resolves to #3A4048 — on this light ground that
       measures 9.33:1, which is a rule, not a hairline. warmGray is
       1.22:1 and is what a card edge on a light surface is for.

       I chose navEdge by its NAME — "edge", therefore hairline — without
       checking what it paints on the ground I was putting it on. That is
       the week's mistake once more, and the only reason it did not ship
       is that I measured a card I had already looked at. */
    border: `1px solid ${C.warmGray}`,
    borderRadius: 14,
    padding: "14px 16px",
    marginBottom: 12,
  };
  const line = { fontSize: ts(A11Y.minBodyPx), lineHeight: 1.55, color: C.textMain, margin: 0 };

  if (post.post_type === "badge") {
    const name = (lang === "ur" ? p.name_ur : p.name_en) || p.name_en || "";
    return (
      <div style={box}>
        <p style={line}>
          <span aria-hidden="true" style={{ fontSize: ts(26), marginInlineEnd: 8 }}>
            {p.emoji || <Icon name="badge" size={18} style={{ display: "inline" }} />}
          </span>
          <strong>{t("community.shares.badgeLine", { badge: name })}</strong>
        </p>
      </div>
    );
  }

  if (post.post_type === "score") {
    return (
      <div style={box}>
        <p style={{ ...line, fontWeight: 700, color: C.green, marginBottom: 4 }}>
          <Icon name="grow" size={17} style={{ display: "inline", verticalAlign: "-3px", marginInlineEnd: 6 }} />{t("community.shares.scoreTitle")}
        </p>
        <p style={line}>
          {t("community.shares.scoreLine", { points: p.points, n: p.done, total: p.total })}
        </p>
      </div>
    );
  }

  if (post.post_type === "walk") {
    const when = p.starts_at ? new Date(p.starts_at) : null;
    const past = when && when.getTime() < Date.now();
    return (
      <div style={box}>
        <p style={{ ...line, fontWeight: 700, color: C.green, marginBottom: 4 }}>
          <Icon name="walk" size={17} style={{ display: "inline", verticalAlign: "-3px", marginInlineEnd: 6 }} />{t("community.shares.walkTitle")}
        </p>
        <p style={line}>
          {p.place_name}
          {when && (
            <>
              {" · "}
              {when.toLocaleString(dateLocale, {
                weekday: "long",
                day: "numeric",
                month: "short",
                hour: "numeric",
                minute: "2-digit",
              })}
            </>
          )}
        </p>
        {p.note && <p style={{ ...line, color: C.textMuted }}>{p.note}</p>}
        {past ? (
          <p style={{ ...line, color: C.textMuted, marginTop: 8 }}>
            {t("community.shares.walkPast")}
          </p>
        ) : (
          isIcon &&
          !own && (
            <div style={{ marginTop: 10 }}>
              <PrimaryBtn onClick={() => onAction("joinWalk", post)}>
                {t("community.shares.walkJoin")}
              </PrimaryBtn>
            </div>
          )
        )}
      </div>
    );
  }

  if (post.post_type === "event") {
    return (
      <div style={box}>
        <p style={line}>
          <Icon name="event" size={17} style={{ display: "inline", verticalAlign: "-3px", marginInlineEnd: 6 }} />{t("community.shares.eventLine")} <strong>{p.title}</strong>
          {p.event_date && ` · ${p.event_date}`}
        </p>
        <div style={{ marginTop: 10 }}>
          <Link
            /* TONIGHT §3.1 — /app/events redirects to /app/outdoor
               (§12's merge), so this button returned the reader to the
               feed's neighbour instead of the gathering. The list that
               renders is /app/events/all. */
            to="/app/events/all"
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
            }}
          >
            {t("community.shares.eventCta")}
          </Link>
        </div>
      </div>
    );
  }

  /* "Who's up for…?" (migration 0027): free-text activity, everything
     else optional. The join RPC is limit-aware and closes gracefully;
     the count shown includes only joiners (the host is implied). */
  if (post.post_type === "activity") {
    const when = p.starts_at ? new Date(p.starts_at) : null;
    const past = when && when.getTime() < Date.now();
    const count = joinInfo?.count ?? 0;
    const mine = joinInfo?.mine ?? false;
    const limit = p.limit ? Number(p.limit) : null;
    const full = limit != null && count + 1 >= limit;
    const rsvp = !!p.rsvp;
    const countLine =
      count === 1
        ? t(rsvp ? "community.shares.activityConfirmedOne" : "community.shares.activityComingOne")
        : t(rsvp ? "community.shares.activityConfirmed" : "community.shares.activityComing", {
            n: count,
          });
    return (
      <div style={box}>
        <p style={{ ...line, fontWeight: 700, color: C.green, marginBottom: 4 }}>
          <Icon name="activity" size={17} style={{ display: "inline", verticalAlign: "-3px", marginInlineEnd: 6 }} />{t("community.shares.activityTitle")}
        </p>
        <p style={{ ...line, fontSize: ts(21), fontWeight: 700 }}>{p.activity}</p>
        {(p.place_name || when) && (
          <p style={line}>
            {p.place_name}
            {p.place_name && when && " · "}
            {when &&
              when.toLocaleString(dateLocale, {
                weekday: "long",
                day: "numeric",
                month: "short",
                hour: "numeric",
                minute: "2-digit",
              })}
          </p>
        )}
        {p.note && <p style={{ ...line, color: C.textMuted }}>{p.note}</p>}
        {count > 0 && (
          <p style={{ ...line, color: C.textMuted, marginTop: 6 }}>{countLine}</p>
        )}
        {past ? (
          <p style={{ ...line, color: C.textMuted, marginTop: 8 }}>
            {t("community.shares.activityPast")}
          </p>
        ) : mine ? (
          <p style={{ ...line, fontWeight: 700, color: C.green, marginTop: 8 }}>
            <Icon name="check" size={17} style={{ display: "inline", verticalAlign: "-3px", marginInlineEnd: 6, color: MEANING.confirmed }} />{t("community.shares.activityJoined")}
          </p>
        ) : full ? (
          <p style={{ ...line, fontWeight: 600, color: C.textMuted, marginTop: 8 }}>
            {t("community.shares.activityClosed")}
          </p>
        ) : (
          !own && (
            <div style={{ marginTop: 10 }}>
              <PrimaryBtn onClick={() => onAction("joinActivity", post)}>
                {rsvp
                  ? t("community.shares.activityRsvpJoin")
                  : t("community.shares.activityJoin")}
              </PrimaryBtn>
            </div>
          )
        )}
      </div>
    );
  }

  /* Open game table (migration 0022): anyone eligible taps to take a
     seat; the session auto-starts when the last seat fills. */
  if (post.post_type === "game_open") {
    const name = (lang === "ur" ? p.name_ur : p.name_en) || p.game_key || "";
    return (
      <div style={box}>
        <p style={{ ...line, fontWeight: 700, color: C.green, marginBottom: 4 }}>
          <Icon name="gameOpen" size={17} style={{ display: "inline", verticalAlign: "-3px", marginInlineEnd: 6 }} />{t("community.shares.gameOpenLine", { game: name })}
        </p>
        <p style={line}>
          {t("community.shares.gameOpenSeats", {
            taken: p.seats_taken ?? "…",
            total: p.seats_total ?? "…",
          })}
        </p>
        {/* A WAY IN, WHOEVER IS LOOKING.

            This used to be `!own &&` and nothing else, so the person
            who opened the table saw their own card announcing "1 of 2
            seats taken" with no control on it at all. Correct that
            they cannot take a seat they are already sitting in —
            and a dead end, because the card is where they came back
            to find the table. Tapping it did nothing because there
            was nothing to tap. */}
        <div style={{ marginTop: 10 }}>
          {own ? (
            <PrimaryBtn onClick={() => onAction("openGameTable", post)}>
              {t("community.shares.gameOpenGo")}
            </PrimaryBtn>
          ) : (
            <PrimaryBtn onClick={() => onAction("claimGameSeat", post)}>
              {t("community.shares.gameOpenCta")}
            </PrimaryBtn>
          )}
        </div>
      </div>
    );
  }

  /* Daily Riddle result — number of guesses only, never the answer. */
  if (post.post_type === "puzzle_result") {
    return (
      <div style={box}>
        <p style={line}>
          <Icon name="riddle" size={17} style={{ display: "inline", verticalAlign: "-3px", marginInlineEnd: 6 }} />{" "}
          <strong>
            {p.guesses === 1
              ? t("community.shares.puzzleResultOne")
              : t("community.shares.puzzleResultLine", { n: p.guesses })}
          </strong>
        </p>
        <div style={{ marginTop: 10 }}>
          <Link
            to="/app/games/puzzle"
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
            }}
          >
            {t("community.shares.puzzleResultCta")}
          </Link>
        </div>
      </div>
    );
  }

  return null;
}

function PostCard({
  post,
  author,
  myId,
  isIcon,
  myReaction,
  counts,
  canWrite,
  dateLocale,
  joinInfo,
  onToggleReaction,
  onAction,
  helpStatus,
  taggedNames,
  iAmTagged,
  onUntag,
  helpNames,
  iOffered,
  onMenu,
  editing,
  onEditSave,
  onEditCancel,
}) {
  const { t, ts } = useI18n();
  const [reporting, setReporting] = useState(false);
  /* Seeded from the post each time editing opens, so cancelling and
     reopening starts from what is actually saved rather than from the
     last abandoned draft. */
  const [draft, setDraft] = useState(post.body || "");
  const [savingEdit, setSavingEdit] = useState(false);
  useEffect(() => { if (editing) setDraft(post.body || ""); }, [editing, post.body]);

  /* BACK CANCELS THE EDIT INSTEAD OF LEAVING COMMUNITY.

     This is an overlay that no audit for role="dialog" can see: there
     is no dialog, no menu, no scrim. Selecting Edit replaces the
     post's words with a textarea IN PLACE, so the only thing that says
     a surface is open is a boolean. Back therefore did what back does
     with no history entry to spend — it navigated off the feed
     entirely, and took the half-written edit with it.

     Worse than a menu for exactly that reason: a menu closed by
     accident costs a tap, an editor closed by accident costs the
     sentence somebody was part way through. Cancelling keeps them on
     the feed with the post intact, which is the smaller loss of the
     two that were on offer. */
  /* RESTORED. It was out for one commit, and the note is worth keeping
     because the reason it came out is the reason the hook is built the
     way it is now.

     I added one and it broke the thing it was protecting. This editor
     opens FROM the post menu, and that menu closes by unmounting;
     useBackToClose's cleanup calls history.back() to remove the menu's
     own entry, but history.back() is ASYNCHRONOUS. The editor pushes
     its entry in the same commit, so the queued back lands on the
     EDITOR'S entry instead — and the editor's own handler, seeing
     history below its depth, cancelled it. Measured: with the line in,
     the textarea is never present at any sample; with it out, it is
     there at +45ms.

     The hook no longer churns history per surface: there is ONE entry
     for however many are open, so a sheet closing as another opens
     hands the entry over instead of destroying one the replacement has
     already claimed. Nothing here has to know that.

     Removed rather than worked around, which was the right call — a
     150ms arming delay tested green and would have outlived the bug it
     was written for. */
  const askCancelEdit = () => {
    /* Back ASKS when the words have changed. Cancelling silently was
       better than navigating away and losing both, but only because
       those were the two things on offer. */
    if (draft.trim() !== (post.body || "").trim()) setConfirmEdit(true);
    else onEditCancel();
  };
  useBackToClose(editing, askCancelEdit);

  /* §7 — post-audio is private, so the card signs its own URL. Done
     here rather than for the whole feed so that a list of forty posts
     signs only the handful that actually carry a recording. */
  const [audioUrl, setAudioUrl] = useState(null);
  useEffect(() => {
    if (!post.audio_path) return undefined;
    let dead = false;
    postAudioUrl(post.audio_path).then((u) => { if (!dead) setAudioUrl(u); });
    return () => { dead = true; };
  }, [post.audio_path]);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState(null); // null = not loaded
  /* Separate from the list, because "nothing was said yet" invites a
     reply and "we could not fetch this" does not. */
  const [commentsError, setCommentsError] = useState("");
  const [commentAuthors, setCommentAuthors] = useState({});
  const [commentBody, setCommentBody] = useState("");
  /* §7 — replies to a post are text AND stickers, and never voice:
     "only the poster may use voice". A thread of twenty audio clips
     is unlistenable, unsearchable, and unscannable by a moderator, so
     there is deliberately no recorder here — the absence is the rule.
     A sticker travels as the body ':sticker/<id>:' on the wire that
     already exists (STICKERS_WIRING.md), so no column changed. */
  const [stickersOpen, setStickersOpen] = useState(false);
  const [commentReporting, setCommentReporting] = useState(null); // comment id
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [confirmEdit, setConfirmEdit] = useState(false);

  /* §3 — DOUBLE-TAP TO HEART.

     Two taps inside 300ms on the post itself. The pop is drawn at the
     point the finger landed, because a mark that appears somewhere else
     is not feedback for the thing you just did.

     IT ONLY EVER ADDS. Double-tap is a gesture people make without
     looking, and the standard everywhere else is that it hearts —
     making the second one take it back would mean a slightly slow
     double-tap silently undoes itself, and the person cannot tell
     whether they hearted or not. Already hearted stays hearted; the
     pop still plays, so the gesture is never silent.

     Single tap is untouched: the handler bails on anything inside a
     control, so buttons, links and the menu behave exactly as before. */
  const lastTapRef = useRef({ t: 0, x: 0, y: 0 });
  const [pop, setPop] = useState(null);

  const onCardPointerUp = (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (e.target.closest("button, a, input, textarea, [role='dialog']")) return;
    const now = Date.now();
    const prev = lastTapRef.current;
    const near = Math.abs(e.clientX - prev.x) < 40 && Math.abs(e.clientY - prev.y) < 40;
    if (now - prev.t < 300 && near) {
      lastTapRef.current = { t: 0, x: 0, y: 0 };
      const box = e.currentTarget.getBoundingClientRect();
      setPop({ id: now, x: e.clientX - box.left, y: e.clientY - box.top });
      if (myReaction !== HEART) onToggleReaction(post.id, HEART, false);
      return;
    }
    lastTapRef.current = { t: now, x: e.clientX, y: e.clientY };
  };

  useEffect(() => {
    if (!pop) return undefined;
    const h = setTimeout(() => setPop(null), MOTION.heartPop + 60);
    return () => clearTimeout(h);
  }, [pop]);
  useBackToClose(commentsOpen, () => askCloseComments());

  const askCloseComments = () => {
    if (commentBody.trim()) setConfirmDiscard(true);
    else setCommentsOpen(false);
  };
  const own = post.author_id === myId;

  /* HOLD THE FEED STILL. Without this the page behind the sheet keeps
     scrolling — a drag meant for the comments moves the feed instead,
     and closing lands somewhere the person never chose. Measured: open
     at 600, close at 68.

     The scroll position is captured when the sheet opens and restored
     when it goes, so "closing returns exactly to where you were" is a
     thing the code does rather than a thing it hopes for. */
  const feedYRef = useRef(0);
  useEffect(() => {
    if (!commentsOpen) return undefined;
    /* The position is taken at TAP time, in openComments, not here.
       Read in this effect it was already wrong: the effect runs after
       the sheet has mounted, and mounting had itself moved the page —
       opened at 600 it restored to 68, which is the number the effect
       saw rather than the number the person left behind.

       Body is pinned with position:fixed and a negative top rather than
       overflow:hidden, because the document scrolls on <html> here and
       hiding the body's overflow does not hold it. */
    const y = feedYRef.current;
    const b = document.body;
    const prev = { position: b.style.position, top: b.style.top, width: b.style.width };
    b.style.position = "fixed";
    b.style.top = `-${y}px`;
    b.style.width = "100%";
    return () => {
      b.style.position = prev.position;
      b.style.top = prev.top;
      b.style.width = prev.width;
      window.scrollTo(0, y);
    };
  }, [commentsOpen]);

  const openComments = async () => {
    const next = !commentsOpen;
    if (next) feedYRef.current = window.scrollY;
    setCommentsOpen(next);
    if (next && comments === null) {
      try {
        const rows = await fetchComments(post.id);
        setComments(rows);
        setCommentAuthors(await fetchAuthors(rows.map((r) => r.author_id)));
      } catch {
        setComments([]);
        setCommentsError(t("common.loadError"));
      }
    }
  };

  const sendComment = async (e) => {
    e.preventDefault();
    if (!commentBody.trim()) return;
    try {
      await addComment(post.id, myId, commentBody);
      setCommentBody("");
      const rows = await fetchComments(post.id);
      setComments(rows);
      setCommentAuthors(await fetchAuthors(rows.map((r) => r.author_id)));
    } catch {
      /* the composer keeps the text; nothing lost */
    }
  };

  const sendSticker = async (id) => {
    setStickersOpen(false);
    try {
      await addComment(post.id, myId, stickerRef(id));
      const rows = await fetchComments(post.id);
      setComments(rows);
      setCommentAuthors(await fetchAuthors(rows.map((r) => r.author_id)));
    } catch {
      /* nothing typed, nothing to lose */
    }
  };

  const menuItem = (label, act) => (
    <button
      type="button"
      onClick={() => {
        setMenuOpen(false);
        act();
      }}
      style={{
        display: "block",
        width: "100%",
        minHeight: A11Y.minTapTargetPx,
        padding: "0 18px",
        background: "none",
        border: "none",
        textAlign: "start",
        fontSize: ts(A11Y.minBodyPx),
        fontFamily: "inherit",
        color: C.textMain,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );

  return (
    <Card onPointerUp={onCardPointerUp} style={{ position: "relative" }}>
      {pop && (
        <span
          key={pop.id}
          aria-hidden="true"
          className="sb-heart-pop"
          style={{ left: pop.x, top: pop.y, color: MEANING.liked }}
        >
          <Icon name="heart" size={64} fill="currentColor" />
        </span>
      )}
      <MotionStyles />
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <AuthorLine author={author} when={post.created_at} dateLocale={dateLocale} />
        </div>
        <div style={{ position: "relative" }}>
          <GhostBtn
            aria-label={t("community.feed.menuAria")}
            onClick={() => onMenu(post)}
            style={{ padding: "0 14px" }}
          >
            ⋯
          </GhostBtn>

        </div>
      </div>

      {/* §4 — the tag the person chose, in their words. Separate from
          the colour: colour is how it looks, the tag is what kind of
          thing it is, and that separation is what lets a milestone
          earn a badge without the app inventing meaning. */}
      {post.style_tag && (
        <span style={{ display: "inline-block", marginTop: 8, padding: "3px 12px", borderRadius: 50, background: C.cream, border: `1.5px solid ${C.warmGray}`, fontSize: ts(15), fontWeight: 700, color: C.textMain }}>
          {t(`posts.tag.${post.style_tag}`)}
        </span>
      )}

      {/* THE EDITING STATE. Selecting Edit used to open a blank
          composer elsewhere on the screen; the words are here, so the
          editing happens here. */}
      {editing ? (
        <div style={{ margin: "10px 0 12px" }}>
          {confirmEdit && (
            <DiscardDialog
              onKeep={() => setConfirmEdit(false)}
              onDiscard={() => { setConfirmEdit(false); onEditCancel(); }}
            />
          )}
          <label
            htmlFor={`edit-${post.id}`}
            style={{ display: "block", fontSize: ts(16), fontWeight: 700, color: C.textMain, marginBottom: 6 }}
          >
            {t("posts.menu.editingTitle")}
          </label>
          <textarea
            id={`edit-${post.id}`}
            value={draft}
            autoFocus
            rows={5}
            onChange={(e) => setDraft(e.target.value)}
            style={{
              width: "100%", boxSizing: "border-box", fontFamily: "inherit",
              fontSize: ts(A11Y.minBodyPx), lineHeight: 1.6, color: C.textMain,
              background: C.white, border: `2px solid ${C.green}`, borderRadius: 14,
              padding: "10px 12px", textAlign: "start",
            }}
          />
          <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              disabled={savingEdit || !draft.trim() || draft === post.body}
              onClick={async () => {
                setSavingEdit(true);
                try { await onEditSave(draft); } finally { setSavingEdit(false); }
              }}
              style={{
                minHeight: A11Y.minTapTargetPx, padding: "0 22px", borderRadius: 50,
                border: "none", background: C.green, color: C.cream, fontFamily: "inherit",
                fontSize: ts(17), fontWeight: 700,
                opacity: savingEdit || !draft.trim() || draft === post.body ? 0.6 : 1,
                cursor: savingEdit || !draft.trim() || draft === post.body ? "default" : "pointer",
              }}
            >
              {savingEdit ? t("feedback.saving") : t("posts.menu.editSave")}
            </button>
            <button
              type="button"
              disabled={savingEdit}
              onClick={onEditCancel}
              style={{
                minHeight: A11Y.minTapTargetPx, padding: "0 22px", borderRadius: 50,
                border: `2px solid ${C.warmGray}`, background: C.white, color: C.textMain,
                fontFamily: "inherit", fontSize: ts(17), fontWeight: 700, cursor: "pointer",
              }}
            >
              {t("posts.menu.editCancel")}
            </button>
          </div>
        </div>
      ) : post.body && (colourOf(post) ? (
        /* §3 — short text only. colourOf() returns null once a post
           runs long or carries a photo, so a long post never becomes
           unreadable on yellow. */
        <div
          style={{
            margin: "10px 0 12px",
            padding: "28px 20px",
            borderRadius: 16,
            background: colourOf(post),
            textAlign: "center",
            fontSize: ts(23),
            fontWeight: 700,
            lineHeight: 1.45,
            color: C.textMain,
            whiteSpace: "pre-wrap",
          }}
        >
          <RichText text={post.body} />
        </div>
      ) : (
        /* A post body is somebody's words: selectable, so it can be
           copied or read out. Chrome is not text, but this is text.

           A PLAIN COMMENT, NOT THE BRACED JSX FORM. In JSX, braces are a
           child slot only where children are expected. Here the comment
           sits in a ternary's expression position, where braces are an
           object literal instead — so the braced comment form that is
           correct three lines above is a syntax error here, and it took
           the whole build down rather than this one card.

           (Written without the closing-block sequence in it: my first
           repair quoted the braced form literally, which ended this
           comment early and broke the file a second way.) */
        <BodyText className="sb-selectable" style={{ margin: "10px 0 12px", whiteSpace: "pre-wrap" }}><RichText text={post.body} /></BodyText>
      ))}

      {/* §5 — who is named on this post, and a way off it for the
          person named. Without this the tag existed only in the
          database: nobody could see it and the promise that you can
          remove it had nothing to attach to. */}
      {taggedNames && taggedNames.length > 0 && (
        <p style={{ margin: "6px 0 0", fontSize: ts(16), color: C.textMuted }}>
          <Icon name="people" size={17} style={{ display: "inline", verticalAlign: "-3px", marginInlineEnd: 6 }} />{t("posts.withNames", { names: taggedNames.join(", ") })}
          {iAmTagged && (
            <button
              type="button"
              onClick={onUntag}
              style={{
                marginInlineStart: 10, minHeight: A11Y.minTapTargetPx,
                border: "none", background: "none", color: C.brown,
                fontFamily: "inherit", fontSize: ts(16), fontWeight: 700,
                textDecoration: "underline", cursor: "pointer",
              }}
            >
              {t("posts.removeMe")}
            </button>
          )}
        </p>
      )}

      {/* §7 — a voice post: a card with a play button and its length,
          so nothing is downloaded until somebody decides to listen. */}
      {post.audio_path && (
        <div style={{ margin: "10px 0 12px" }}>
          <VoicePlayer url={audioUrl} seconds={post.audio_seconds} />
        </div>
      )}

      {/* §6 — Asked → Someone's coming → Done. */}
      {post.style_tag === "help" && helpStatus && (
        <HelpStrip
          status={helpStatus}
          authorName={author?.full_name}
          authorComplete={author?.profile_complete !== false}
          helperNames={helpNames}
          mine={post.author_id === myId}
          iOffered={iOffered}
          onOffer={() => onAction("offerHelp", post)}
          onWithdraw={() => onAction("withdrawHelp", post)}
          onDone={() => onAction("helpDone", post)}
          onReopen={() => onAction("reopenHelp", post)}
        />
      )}
      {post.post_type && post.post_type !== "text" && (
        <div style={{ marginTop: post.body ? 0 : 10 }}>
          <ShareBlock
            post={post}
            isIcon={isIcon}
            own={own}
            dateLocale={dateLocale}
            joinInfo={joinInfo}
            onAction={onAction}
          />
        </div>
      )}
      {post.image_path && (
        <img
          src={imageUrl(post.image_path)}
          alt=""
          style={{ maxWidth: "100%", borderRadius: 14, marginBottom: 12, display: "block" }}
        />
      )}

      {reporting && (
        <ReportForm
          onCancel={() => setReporting(false)}
          onSend={(reason) => {
            setReporting(false);
            onAction("report", post, reason);
          }}
        />
      )}

      {/* Reactions: one each, tap again to take it back. */}
      <div
        role="group"
        aria-label={t("community.feed.reactAria")}
        style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 4 }}
      >
        {REACTIONS.map((emoji) => {
          const mine = myReaction === emoji;
          const n = counts[emoji] || 0;
          /* At rest every reaction is grey line-art. On, it takes the
             colour of what it now means — the heart its own red, the
             rest the accent. */
          const tone = REACTION_TONE[emoji] || MEANING.confirmed;
          return (
            <button
              key={emoji}
              type="button"
              aria-pressed={mine}
              aria-label={t(REACTION_LABEL[emoji])}
              onClick={() => onToggleReaction(post.id, emoji, mine)}
              /* ONE LINE OF PLAIN ACTIONS — no pills, no boxes.

                 Four outlined pills under every post was four more
                 outlines than §4.1 allows, and on a feed of ten posts
                 that is forty boxes drawn around things whose meaning
                 is the glyph itself. The GLYPH is now drawn rather than
                 an emoji: four emoji in a row carry four line weights and
                 four palettes chosen by a font vendor, and no amount of
                 layout makes them sit together.

                 Mine is marked by weight and ink, not by a filled
                 capsule — and the count beside it says so in figures,
                 so it is never colour alone. */
              style={{
                minHeight: A11Y.minTapTargetPx,
                padding: "0 10px 0 0",
                border: "none",
                background: "none",
                fontSize: ts(17),
                fontFamily: "inherit",
                color: mine ? tone : MEANING.rest,
                fontWeight: mine ? 700 : 500,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              {/* Filled when it is yours, and the count says so in
                  figures besides: three signals, never colour alone. */}
              <Icon name={REACTION_ICON[emoji]} size={20} fill={mine ? tone : "none"} />
              {/* The count takes the reaction's colour when it is yours, and
                  stays ink when it is not — so the figure agrees with the
                  glyph instead of contradicting it. It is also the reason
                  this row is never colour alone: the number is the third
                  signal after the fill and the weight. */}
              {n > 0 && (
                <span style={{ fontWeight: 700, color: mine ? tone : C.textMain }}>{n}</span>
              )}
            </button>
          );
        })}
        <GhostBtn aria-expanded={commentsOpen} onClick={openComments} style={{ border: "none" }}>
          <Icon name="messages" size={17} style={{ display: "inline", verticalAlign: "-3px", marginInlineEnd: 6 }} />{t("community.feed.comments")}
        </GhostBtn>
      </div>

      {/* §1 — COMMENTS ARE A LAYER, NOT A STRIP IN THE FEED.

          They used to expand inside the post card, which scrolled the
          whole feed to reach them and left the person hunting for their
          place afterwards. Now the post is pinned at the top of a sheet
          that rises from the bottom (MOTION_SPEC §2), the comments
          scroll under it, and the box sits at the foot where a thumb is.

          Closing restores the feed EXACTLY — but NOT "by construction",
          which is what this comment claimed until I looked. A fixed
          overlay does not stop the page beneath it scrolling: opened at
          y=600 and closed, the feed came back at y=68. The position has
          to be held on purpose, so the effect below freezes the body
          while the sheet is up and puts the page back where it was. */}
      {commentsOpen && (
        <div
          className="sb-dim"
          onClick={askCloseComments}
          style={{
            position: "fixed", inset: 0, zIndex: 80,
            background: "rgba(0,0,0,0.38)",
            display: "flex", alignItems: "flex-end", justifyContent: "center",
          }}
        >
          <MotionStyles />
          {confirmDiscard && (
            <DiscardDialog
              onKeep={() => setConfirmDiscard(false)}
              onDiscard={() => { setConfirmDiscard(false); setCommentBody(""); setCommentsOpen(false); }}
            />
          )}
          <div
            className="sb-sheet"
            role="dialog"
            aria-modal="true"
            aria-label={t("community.feed.comments")}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%", maxWidth: 640, maxHeight: "92vh",
              background: C.bg,
              borderTopLeftRadius: 24, borderTopRightRadius: 24,
              display: "flex", flexDirection: "column", overflow: "hidden",
            }}
          >
            {/* THE POST, PINNED. Whose words are being replied to stays
                on screen however far the comments run. */}
            <div style={{ padding: "14px 16px 10px", background: C.white, flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <strong style={{ fontSize: ts(17), color: C.green }}>
                  {author?.full_name || "…"}
                </strong>
                <button
                  type="button"
                  onClick={askCloseComments}
                  aria-label={t("common.back")}
                  style={{
                    minWidth: A11Y.minTapTargetPx, minHeight: A11Y.minTapTargetPx,
                    border: "none", background: "transparent", color: C.textMuted,
                    cursor: "pointer", borderRadius: 10,
                  }}
                >
                  <Icon name="close" size={20} />
                </button>
              </div>
              {post.body ? (
                <BodyText style={{ margin: "6px 0 0", maxHeight: 96, overflow: "hidden" }}>
                  <RichText text={post.body} />
                </BodyText>
              ) : null}
            </div>

            {/* The comments themselves scroll; the post and the box do not. */}
            {/* C.tint, NOT C.cream. This band was written as a warm tint
                and a nine-line comment explains why a band beats a
                hairline — then cream was collapsed onto white in the
                palette flip and the band silently became the same white as
                the post. Nobody edited the line; the token under it changed
                meaning. C.tint is the name for "material attached to
                content", which is exactly what a comment is. */}
            {/* COOL, NOT WARM, and the distinction is the system's not mine:
                cool is another voice, warm is more of the same thing. A
                comment is somebody else speaking, so it leaves SURFACE.tint
                — which stays warm and still carries the help panel and the
                composer's helper count, neither of which is a reply. */}
            <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px", background: C.comment }}>
              {comments === null ? (
                <BodyText muted role="status">…</BodyText>
              ) : commentsError ? (
                /* "Be the first to say something" is an invitation. It
                   is the wrong thing to show somebody whose comments
                   simply did not arrive — they would be answering a
                   conversation they cannot see. */
                <BodyText role="alert" style={{ color: C.brown, fontWeight: 700 }}>⚠ {commentsError}</BodyText>
              ) : comments.length === 0 ? (
                <BodyText muted>{t("community.feed.noComments")}</BodyText>
              ) : (
                comments.map((cm) => (
                  /* The quoted-reply shape: a rule down the edge and a step
                     in. INLINE-start, not left, so it mirrors in Urdu — a
                     rule pinned to the left of right-to-left text sits on
                     the end of every line instead of the start.

                     Plain comment, not the braced form: this is inside a
                     map callback returning an expression, where a brace is
                     an object literal. Exactly the break I repaired in two
                     other lanes last night, made here by me. */
                  <div
                    key={cm.id}
                    style={{
                      marginBottom: 10,
                      borderInlineStart: `2.5px solid ${C.commentRule}`,
                      paddingInlineStart: 10,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                      <span style={{ fontSize: ts(17), fontWeight: 700, color: C.green }}>
                        {commentAuthors[cm.author_id]?.full_name || "…"}
                      </span>
                      {/* Report is a safety affordance: full 48px target,
                          full 18px text (QUALITY_REPORT §3 must-fix). */}
                      <button
                        type="button"
                        onClick={() => setCommentReporting(cm.id)}
                        style={{
                          minHeight: A11Y.minTapTargetPx,
                          background: "none",
                          border: "none",
                          color: C.textMuted,
                          fontSize: ts(18),
                          fontFamily: "inherit",
                          textDecoration: "underline",
                          cursor: "pointer",
                          padding: "0 8px",
                        }}
                      >
                        {t("community.feed.menuReport")}
                      </button>
                    </div>
                    {parseStickerRef(cm.body) && (
                      <Sticker id={parseStickerRef(cm.body)} size={96} />
                    )}
                    <BodyText style={{ margin: "2px 0 0" }}><RichText text={cm.body} /></BodyText>
                    {commentReporting === cm.id && (
                      <ReportForm
                        onCancel={() => setCommentReporting(null)}
                        onSend={(reason) => {
                          setCommentReporting(null);
                          onAction("reportComment", { ...cm, post_id: post.id }, reason);
                        }}
                      />
                    )}
                  </div>
                ))
              )}
            </div>

            <div style={{ padding: "10px 16px 16px", background: C.bg, flexShrink: 0 }}>
              {canWrite && (
                <>
                  {stickersOpen && (
                    <div style={{ marginTop: 8 }}>
                      <StickerPicker onPick={sendSticker} label={t("community.feed.stickerLabel")} />
                    </div>
                  )}
                  <form onSubmit={sendComment} style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <input
                      value={commentBody}
                      onChange={(e) => setCommentBody(e.target.value)}
                      placeholder={t("community.feed.commentPlaceholder")}
                      style={{ flex: 1 }}
                    />
                    <GhostBtn
                      onClick={() => setStickersOpen((v) => !v)}
                      aria-expanded={stickersOpen}
                      aria-label={t("community.feed.stickerLabel")}
                      style={{ padding: "0 14px" }}
                    >
                      <Icon name="good" size={19} />
                    </GhostBtn>
                    <GhostBtn type="submit" onClick={sendComment} style={{ borderColor: C.green, color: C.green }}>
                      {t("community.feed.commentCta")}
                    </GhostBtn>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

/* `composer` — Lane 38's contract. Home mounts <PostComposer /> above
   the log row (§4: header, composer, log, feed), so the Feed must not
   draw a second one. It still owns everything §11 asks for: it listens
   for the post landing, reloads, and marks the new row fresh. */
export default function Feed({ composer = true, embedded = false }) {
  const { t, ts, meta, lang } = useI18n();
  const { profile } = useSession();
  const navigate = useNavigate();
  const myId = profile?.id;
  /* The Feed renders at /app/community AND inside Home. Only the
     former is a page that needs naming — see the heading below. */
  const onHome = !useLocation().pathname.startsWith("/app/community");
  const dateLocale = lang === "ur" ? "ur-PK" : "en-GB";

  const [access, setAccess] = useState(null); // null loading | true | false
  const [canWrite, setCanWrite] = useState(false);
  const [posts, setPosts] = useState([]);

  /* NAVIGATION_SPEC §4.3 — the reconnect row. Null unless there is a
     person to offer AND the weekly cadence allows it. */
  /* §6 — posts from public groups you have joined. The RULE lives in
     the groups lane's store, not here: read-time evaluation means a
     group going private, a member leaving or a post being deleted all
     take effect on the next read, with no stamp to unstick. If §6 ever
     changes it changes there and this file does not move. */
  const [groupPosts, setGroupPosts] = useState([]);
  const [reconnect, setReconnect] = useState(null);
  const [helloWith, setHelloWith] = useState(null);
  const [playWith, setPlayWith] = useState(null);
  /* Which ring the feed had to reach for. Shown as a quiet line, never
     as a setting: §7 is explicit that the person never changes one. */
  const [radius, setRadius] = useState("area");
  const [authors, setAuthors] = useState({});
  const [reactions, setReactions] = useState([]);
  const [error, setError] = useState("");
  // Lane-local Toast retired — the shared host renders these now.
  const { toast: raiseToast } = useToast();
  const fresh = useFresh();
  // Posts on their way to the server: rendered at once, quietly marked.
  const [pendingPosts, setPendingPosts] = useState([]);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const rows = await fetchFeedGroupPosts();
        if (alive) setGroupPosts(rows || []);
      } catch { /* the community feed still stands without them */ }
    })();
    return () => { alive = false; };
  }, [myId]);

  /* §4.3. Deliberately its own effect and deliberately silent on
     failure: this is a courtesy, and a feed that refused to render
     because a reconnect suggestion could not be computed would be a
     bad trade. Cadence is checked BEFORE fetching, so a person who has
     seen the row this week costs nothing to load. */
  /* The role is read inline rather than through isIcon, which is declared
     a hundred lines below this: a dependency array is evaluated where it
     sits, so naming isIcon here threw "Cannot access before
     initialization" and took the whole feed down with it. Caught by
     looking at the screen — the page was blank and the console said so. */
  const iAmIcon = profile?.role === "saath_icon";
  useEffect(() => {
    if (!myId || !iAmIcon) return undefined;
    if (!rowAllowed()) return undefined;
    let alive = true;
    (async () => {
      try {
        const chats = await fetchChats(myId);
        if (!alive) return;
        const pick = pickReconnect(chats);
        if (pick) { setReconnect(pick); markRowSeen(); }
      } catch { /* no row, no noise */ }
    })();
    return () => { alive = false; };
  }, [myId, iAmIcon]);

  /* §1 — the composer is a screen now, opened from the row. */
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerStart, setComposerStart] = useState(null);
  /* §10 — one sheet for the whole feed, not one per card. */
  const [menuPost, setMenuPost] = useState(null);
  const [hiddenIds, setHiddenIds] = useState(() => new Set());
  /* Editing happens on the post, where the words already are. */
  const [editingId, setEditingId] = useState(null);
  /* §6/§10 — offers, saves and follows for what is on screen. */
  const [extras, setExtras] = useState({ offers: [], saves: [], follows: [], tags: [] });

  /* §11 stays intact with the composer anywhere on the page: the
     optimistic row appears on "posting", and the reload plus the
     highlight happen on "posted". Only registered when the composer
     is external — otherwise share() below already does both and the
     feed would load twice. */
  useEffect(() => {
    if (composer) return undefined;
    const onPosting = (ev) => {
      const { key, body: b, hasPhoto } = ev.detail || {};
      if (key) setPendingPosts((cur) => [...cur, { key, body: b, hasPhoto }]);
    };
    const onPosted = async (ev) => {
      const { id, key, tagsFailed } = ev.detail || {};
      await load();
      setPendingPosts((cur) => cur.filter((x) => x.key !== key));
      if (tagsFailed) raiseToast(t("posts.tagFailed"), { tone: "error", key: "tag" });
      setTimeout(() => { if (id) fresh.mark(id); }, 0);
    };
    const onFailed = (ev) => {
      const { key } = ev.detail || {};
      setPendingPosts((cur) => cur.filter((x) => x.key !== key));
    };
    window.addEventListener("saath:posting", onPosting);
    window.addEventListener("saath:posted", onPosted);
    window.addEventListener("saath:post-failed", onFailed);
    return () => {
      window.removeEventListener("saath:posting", onPosting);
      window.removeEventListener("saath:posted", onPosted);
      window.removeEventListener("saath:post-failed", onFailed);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [composer]);

  const openComposer = (start) => {
    setComposerStart(start);
    setComposerOpen(true);
  };

  const [body, setBody] = useState("");
  const [file, setFile] = useState(null);
  const [posting, setPosting] = useState(false);
  const fileRef = useRef(null);

  /* Connections are no longer a FILTER (§4.2 deleted the pills) —
     they are the first band of the feed's ordering rule. */
  const [connections, setConnections] = useState(null); // Set | null
  const [walkOpen, setWalkOpen] = useState(false);
  const [walkPlaces, setWalkPlaces] = useState([]);
  const [walkActivity, setWalkActivity] = useState("");
  // Free-text place; the id rides along only when a known outdoor
  // place was tapped from the suggestions (park boards need it).
  const [walkPlaceText, setWalkPlaceText] = useState("");
  const [walkPlaceId, setWalkPlaceId] = useState("");
  const [walkWhen, setWalkWhen] = useState("");
  const [walkNote, setWalkNote] = useState("");
  const [walkLimit, setWalkLimit] = useState("");
  const [walkRsvp, setWalkRsvp] = useState(false);
  const [joins, setJoins] = useState({}); // postId → {count, mine}
  const isIcon = profile?.role === "saath_icon";

  const showToast = (text, actionLabel, onAction) => {
    raiseToast(text, actionLabel ? { actionLabel, onAction } : undefined);
  };


  const openWalkComposer = async () => {
    setWalkOpen(true);
    if (walkPlaces.length === 0) {
      try {
        setWalkPlaces(await fetchPlacesLite());
      } catch {
        /* the select just stays empty; the share button disables */
      }
    }
  };

  const submitActivity = async (e) => {
    e.preventDefault();
    if (!walkActivity.trim()) return;
    setError("");
    try {
      await shareActivity(myId, {
        activity: walkActivity,
        placeText: walkPlaceText,
        placeId: walkPlaceId || null,
        startsAtIso: walkWhen ? new Date(walkWhen).toISOString() : null,
        note: walkNote,
        limit: walkLimit ? Number(walkLimit) : null,
        rsvp: walkRsvp,
      });
      setWalkOpen(false);
      setWalkActivity("");
      setWalkPlaceText("");
      setWalkPlaceId("");
      setWalkWhen("");
      setWalkNote("");
      setWalkLimit("");
      setWalkRsvp(false);
      showToast(t("community.shares.activityShared"));
      await load();
    } catch {
      setError(t("community.feed.postError"));
    }
  };

  const load = useCallback(async () => {
    try {
      const ok = await canUseCommunity();
      setAccess(ok);
      if (!ok) return;
      setCanWrite(await canPostCommunity());
      const rows = await fetchFeed();
      /* §7: the feed shows the neighbourhood first and widens on its own
         until there is something to read. Authors have to be resolved
         BEFORE the radius can be decided, because the band is a fact
         about the author rather than about the post. */
      const authorsForBand = await fetchAuthors(rows.map((p) => p.author_id));
      const neighbours = await fetchGroupNeighbourIds(myId).catch(() => new Set());
      const widened = widenFeed(rows, authorsForBand, profile, neighbours);
      /* 0116. A post hidden by this reader is gone for this reader
         only — the author is never told and nobody else is affected. */
      const hidden = await fetchMyHiddenPostIds().catch(() => new Set());
      setHiddenIds(hidden);
      setPosts(widened.posts.filter((p) => !hidden.has(p.id)));
      setRadius(widened.radius);
      const joinable = rows.filter((p) => p.post_type === "walk" || p.post_type === "activity");
      const [a, r, j] = await Promise.all([
        fetchAuthors(rows.map((p) => p.author_id)),
        fetchReactions(rows.map((p) => p.id)),
        fetchJoins(joinable.map((p) => p.id), myId).catch(() => ({})),
      ]);
      setAuthors(a);
      setReactions(r);
      setJoins(j);
      // Connections are the first band of §4.2's order; a failure just
      // means everybody sorts into the later bands, never an error.
      fetchConnections(myId)
        .then(setConnections)
        .catch(() => setConnections(new Set()));
    } catch {
      setError(t("community.feed.loadError"));
      setAccess(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Latest posts, so the highlight can find the row that just landed.
  const postsRef = useRef(posts);
  postsRef.current = posts;

  /* Offers, saves and follows for the posts currently in the feed.
     Failures are silent: a help post still reads without knowing who
     has offered, and a feed that will not render because a nicety did
     not load is the worse trade. */
  useEffect(() => {
    let dead = false;
    const ids = (posts || []).map((p) => p.id);
    if (!ids.length) return undefined;
    fetchHelpExtras(ids)
      .then(async (x) => {
        if (dead) return;
        setExtras(x);
        /* Names for the people tagged and the people offering — they
           are not post authors, so they are not in `authors` yet, and
           a tag that renders as an empty string is worse than none. */
        const extraIds = [
          ...x.tags.map((r) => r.person_id),
          ...x.offers.map((r) => r.helper_id),
        ].filter(Boolean);
        if (extraIds.length) {
          const more = await fetchAuthors(extraIds).catch(() => ({}));
          if (!dead) setAuthors((cur) => ({ ...more, ...cur }));
        }
      })
      .catch(() => {});
    return () => { dead = true; };
  }, [posts]);

  /* Optimistic share: the words appear the instant they are sent,
     marked "sending", and are replaced by the real row on confirm. A
     refusal puts the draft back in the box with a kind line + Retry —
     nothing a person wrote is ever silently lost. */
  /* §11 — SHARING LANDS ON THE POST. The feed reloads, scrolls to the
     new post and marks it fresh, which draws the coloured bar down its
     left edge for about three seconds and then lets it go.

     THERE IS NO LONGER A TOAST. AUDIT_11 found that most of the app
     already lands on its result and fires one anyway, and that the fix
     is usually deleting the toast rather than adding navigation — this
     is that finding applied to the composer. The post being there is
     the confirmation; "Shared ✓" three inches below it said nothing
     the screen was not already showing.

     THE FAILURE TOAST STAYS. §11 does not touch errors: a refusal has
     no result and no home to land on, so it keeps its line, its Retry,
     and the words coming back to the composer (FEEDBACK.md §11.2).

     The highlight is tied to the action and never stored — coming back
     to the app later must not show a still-highlighted post. */
  const share = async (opts) => {
    const draftBody = (opts?.body || "").trim();
    /* §7 — a voice post may carry no words at all. Refusing on an empty
       body would have made the recorder a decoration on a button that
       could never be pressed. */
    if ((!draftBody && !opts?.audio) || posting) return false;
    const draftFile = opts.file || null;
    const key = `pending-${Date.now()}`;
    setPendingPosts((cur) => [...cur, { key, body: draftBody, hasPhoto: !!draftFile }]);
    setPosting(true);
    setError("");
    try {
      const row = await createPost(myId, draftBody, draftFile, {
        visibility: opts.visibility,
        colour: opts.colour,
        styleTag: opts.styleTag,
        helpWanted: opts.helpWanted,
        tagged: opts.tagged || [],
        audio: opts.audio || null,
      });
      await load();
      setPendingPosts((cur) => cur.filter((p) => p.key !== key));
      /* The post is kept whatever happens to the names on it, but a
         refused tag is said out loud rather than swallowed — that
         silence is what hid the 0077 policy bug. */
      if (row?.tagsFailed) {
        raiseToast(t("posts.tagFailed"), { tone: "error", key: "tag" });
      }
      setTimeout(() => {
        if (row?.id) fresh.mark(row.id);
      }, 0);
      return true;
    } catch {
      setPendingPosts((cur) => cur.filter((p) => p.key !== key));
      raiseToast(t("feedback.postFailed"), {
        tone: "error",
        actionLabel: t("feedback.retry"),
        onAction: () => share(opts),
      });
      return false;
    } finally {
      setPosting(false);
    }
  };

  /* Reactions land instantly and reconcile: a tap that the server
     refuses rolls back rather than lying. */
  /* ── ACT NOW, CONFIRM BEHIND ──

     Every menu action used to await the network BEFORE touching the
     screen, and several then awaited a full feed reload on top. Measured
     on the deployed build at 300ms latency: pressing "Pin to your
     profile" showed nothing for 373ms, and from Karachi to a Singapore
     region that is comfortably the second the owner reports. The sheet
     sat open and frozen the whole time, which reads as a dead app.

     `act` inverts it: the sheet closes and the change appears at once,
     the request goes behind, and a failure PUTS IT BACK and says so.
     Nothing here waits on a round trip to show that it happened.

     The reload afterwards is deliberately NOT awaited — it reconciles
     with the server in the background. Awaiting it was the second half
     of the delay: an action that had already succeeded still held the
     screen while the whole feed came down again. */
  /* The post leaves at once and the line offers the way back, which is
     the only honest form of a one-tap destructive-ish action: undoing
     it must not require finding the post again, because it is gone. */
  const hideOne = async (p) => {
    setPosts((ps) => ps.filter((x) => x.id !== p.id));
    setHiddenIds((h) => new Set(h).add(p.id));
    try {
      await hidePost(p.id, myId);
      showToast(t("feedback.postHidden"), t("community.feed.undo"), async () => {
        await unhidePost(p.id, myId);
        setHiddenIds((h) => { const n = new Set(h); n.delete(p.id); return n; });
        await load();
      });
    } catch {
      setPosts((ps) => (ps.some((x) => x.id === p.id) ? ps : [p, ...ps]));
      setHiddenIds((h) => { const n = new Set(h); n.delete(p.id); return n; });
      raiseToast(t("feedback.somethingWrong"), { tone: "error", key: "postaction" });
    }
  };

  const act = (apply, request, undo) => {
    setMenuPost(null);
    apply();
    request()
      .then(() => load())
      .catch(() => {
        undo?.();
        raiseToast(t("feedback.somethingWrong"), { tone: "error", key: "postaction" });
      });
  };

  const toggleReaction = async (postId, emoji, mine) => {
    const prior = reactions;
    setReactions((rs) => {
      const withoutMine = rs.filter((r) => !(r.post_id === postId && r.profile_id === myId));
      return mine ? withoutMine : [...withoutMine, { post_id: postId, profile_id: myId, emoji }];
    });
    try {
      if (mine) await clearReaction(postId, myId);
      else await setReaction(postId, myId, emoji);
      /* NO REFETCH ON SUCCESS, and this is the reaction lag.

         Measured, 27 posts, phone-speed CPU: the tap painted in 54ms,
         and then the feed re-rendered every card AGAIN a full second
         later when this refetch came back. The screen moving a second
         after you let go is what reads as lag — not the tap, which was
         never slow.

         And the second wave changed nothing. We already know the
         answer: it is the reaction we just wrote. Twenty-six of those
         cards were handed data identical to what they held. Somebody
         tapping four hearts while scrolling bought four delayed blocks
         of the main thread for no new information.

         Other people's reactions still arrive — on the next feed load,
         which is where every other person's activity arrives too. */
    } catch {
      setReactions(prior);
      raiseToast(t("feedback.somethingWrong"), { tone: "error", key: "reaction" });
    }
  };

  const onAction = async (kind, target, reason) => {
    try {
      /* §6.2 — the offer is a BUTTON, separate from the talk, and it
         lands as a row rather than a comment. Nothing here announces
         itself with a toast: the strip above the button changes to
         name whoever is coming, which is the result. */
      if (kind === "offerHelp") {
        await offerHelp(target.id, myId);
        setExtras(await fetchHelpExtras((posts || []).map((p) => p.id)));
        /* §6.2 — AN OFFER OPENS A CHAT. The offer was landing as a row
           and stopping there, so the two people had agreed to meet and
           had nowhere to speak. Everything that follows — when, which
           door, is tomorrow alright — has to happen somewhere, and the
           spec is explicit that it is a chat and that no phone number
           moves unless a person hands it over themselves.

           MOTION §7: this lands you IN the conversation rather than
           telling you it exists. The offer is already recorded above,
           so a chat that fails to open costs the offer nothing — the
           row stands either way, which is why this is not awaited into
           the same try. */
        try {
          const requestId = await openDmWith(target.author_id);
          if (requestId) navigate(`/app/people/${target.author_id}/chat`);
        } catch {
          /* No chat is a smaller failure than a lost offer. The offer
             is saved; they can open the conversation from the person. */
        }
      } else if (kind === "withdrawHelp") {
        await withdrawOffer(target.id, myId);
        setExtras(await fetchHelpExtras((posts || []).map((p) => p.id)));
      } else if (kind === "reopenHelp") {
        await reopenHelp(target.id);
        await load();
      } else if (kind === "helpDone") {
        await markHelpDone(target.id);
        await load();
      } else if (kind === "report") {
        /* A reported voice post carries its recording. No copy is
           needed: post-audio is readable by admins, because a post is
           not a private thread. A DM is, which is why that path takes
           a copy instead (communityData.copyToEvidence). */
        await fileReport(
          /* A voice post IS a post — community_reports.target_kind is
             constrained to a fixed set and "voice_post" is not in it, so
             inventing a kind made every report of a recording fail the
             CHECK and vanish into a caught error. What makes it audio is
             target_media_kind, which is what the queue reads anyway. */
          myId, "post",
          target.id, target.author_id, target.body, reason,
          target.audio_path
            ? { bucket: "post-audio", path: target.audio_path, kind: "audio" }
            : null
        );
        showToast(t("community.feed.reportedToast"));
      } else if (kind === "reportComment") {
        await fileReport(myId, "comment", target.id, target.author_id, target.body, reason);
        showToast(t("community.feed.reportedToast"));
      } else if (kind === "mute" || kind === "block") {
        await blockOrMute(myId, target.author_id, kind);
        await load();
        showToast(kind === "mute" ? t("community.feed.mutedToast") : t("community.feed.blockedToast"), t("community.feed.undo"), async () => {
          await unblock(myId, target.author_id, kind);
          setToast(null);
          await load();
        });
      } else if (kind === "delete") {
        /* RESPONSIVENESS.md rule 2. This awaited the delete AND a full
           feed reload before anything moved — the same shape as the
           pin measurement (373ms → 6ms), and worse here, because the
           person is watching the thing they asked to remove sit there.
           The card goes now; the request follows; a refusal puts it
           back exactly as it was. */
        const prior = posts;
        setPosts((ps) => (ps || []).filter((x) => x.id !== target.id));
        showToast(t("feedback.postDeleted"));
        deleteOwnPost(target.id)
          .then(() => load())
          .catch(() => {
            setPosts(prior);
            /* Sticky, and deliberately: the card has already gone from
               the screen, so somebody may have looked away or closed
               the app believing the post deleted. A line that fades
               after four seconds would leave them believing it. */
            raiseToast(t("feedback.deleteFailedStay"), { tone: "error", key: "postaction", sticky: true });
          });
      } else if (kind === "dm") {
        try {
          await sendDmRequest(target.author_id);
          showToast(t("community.feed.dmRequestedToast"));
        } catch {
          showToast(t("community.feed.dmRequestFailed"));
        }
      } else if (kind === "joinWalk") {
        try {
          await joinWalk(myId, target);
          showToast(t("community.shares.walkJoined"));
        } catch {
          showToast(t("community.shares.walkJoinFailed"));
        }
      } else if (kind === "joinActivity") {
        try {
          const r = await joinActivity(target.id);
          if (r.joined) {
            showToast(
              t(
                target.payload?.rsvp
                  ? "community.shares.activityRsvpJoined"
                  : "community.shares.activityJoined"
              )
            );
            /* Walks with a place + time also land the joiner's outing
               on the park board (the pre-0027 behaviour), best-effort
               and Icons-only — RLS refuses the rest. */
            if (isIcon && target.payload?.place_id && target.payload?.starts_at) {
              joinWalk(myId, target).catch(() => {});
            }
          } else {
            showToast(t("community.shares.activityFull"));
          }
          await load();
        } catch {
          showToast(t("community.shares.walkJoinFailed"));
        }
      } else if (kind === "openGameTable") {
        /* Already seated: the table itself, not the seat RPC. */
        navigate(`/app/games/s/${target.ref_id}`);
      } else if (kind === "claimGameSeat") {
        /* ref_id is the game session; the RPC is idempotent for
           someone already seated and auto-starts on the last seat. */
        try {
          await claimOpenSeat(target.ref_id);
          showToast(t("community.shares.gameOpenTaken"));
          navigate(`/app/games/s/${target.ref_id}`);
        } catch {
          showToast(t("community.shares.gameOpenFull"));
        }
      }
    } catch {
      setError(t("community.feed.loadError"));
    }
  };

  const mineByPost = {};
  const countsByPost = {};
  for (const r of reactions) {
    countsByPost[r.post_id] = countsByPost[r.post_id] || {};
    countsByPost[r.post_id][r.emoji] = (countsByPost[r.post_id][r.emoji] || 0) + 1;
    if (r.profile_id === myId) mineByPost[r.post_id] = r.emoji;
  }

  const menuAuthor = menuPost ? authors[menuPost.author_id] : null;

  return (
    <CommunityScreen embedded={embedded}>
      {/* §1 — full screen, opened from the row in the feed. */}
      <Composer
        open={composer && composerOpen}
        startWith={composerStart}
        busy={posting}
        onClose={() => setComposerOpen(false)}
        onShare={share}
      />

      {/* §4.3 -> §9.1. Sending closes the sheet and opens the chat with
          the message in it; SayHelloSheet owns that, so this is only the
          mount point. */}
      {helloWith && (
        <SayHelloSheet person={helloWith} onClose={() => setHelloWith(null)} />
      )}

      {/* §9.2 — one tap holds her seat, sends the invite and opens the board. */}
      {playWith && (
        <PlaySomethingSheet person={playWith} onClose={() => setPlayWith(null)} />
      )}

      {/* §10 — one sheet, growing from whichever three dots was tapped. */}
      {menuPost && (
        <PostMenu
          post={menuPost}
          mine={menuPost.author_id === myId}
          authorName={(menuAuthor?.full_name || "").split(" ")[0]}
          saved={extras.saves.some((x) => x.post_id === menuPost.id && x.profile_id === myId)}
          following={extras.follows.some((x) => x.post_id === menuPost.id && x.profile_id === myId)}
          onClose={() => setMenuPost(null)}
          actions={{
            pin: (on) => {
              const p = menuPost;
              act(
                () => setPosts((ps) => ps.map((x) => (x.id === p.id ? { ...x, pinned_at: on ? new Date().toISOString() : null } : x))),
                () => setPinned(p.id, on),
                () => setPosts((ps) => ps.map((x) => (x.id === p.id ? { ...x, pinned_at: p.pinned_at } : x)))
              );
            },
            changeVisibility: () => {
              /* Cycles through the three in §2's order. This one keeps
                 the sheet OPEN on purpose — the row shows the current
                 value, so the change has to be visible where it was
                 made, and closing would hide the answer. */
              const order = ["public", "friends", "private"];
              const p = menuPost;
              const was = p.visibility || "public";
              const next = order[(order.indexOf(was) + 1) % 3];
              setMenuPost({ ...p, visibility: next });
              setPosts((ps) => ps.map((x) => (x.id === p.id ? { ...x, visibility: next } : x)));
              setPostVisibility(p.id, next)
                .then(() => load())
                .catch(() => {
                  setMenuPost((m) => (m && m.id === p.id ? { ...m, visibility: was } : m));
                  setPosts((ps) => ps.map((x) => (x.id === p.id ? { ...x, visibility: was } : x)));
                  raiseToast(t("feedback.somethingWrong"), { tone: "error", key: "postaction" });
                });
            },
            /* Edit opened a BLANK composer: Composer's startWith prop
               was declared and never read, so the words being edited
               were nowhere on screen. The post itself becomes editable
               instead — the editing state IS the acknowledgement. */
            edit: () => { const p = menuPost; setMenuPost(null); setEditingId(p.id); },
            setReplies: (off) => {
              const p = menuPost;
              act(
                () => setPosts((ps) => ps.map((x) => (x.id === p.id ? { ...x, replies_off: off } : x))),
                () => setRepliesOff(p.id, off),
                () => setPosts((ps) => ps.map((x) => (x.id === p.id ? { ...x, replies_off: p.replies_off } : x)))
              );
            },
            /* Nothing on screen changes when a link is copied, so the
               line is the only evidence — and it reports which of the
               two things happened, because a clipboard write can be
               refused. */
            copyLink: async () => {
              const ok = await copyLink(menuPost.id);
              setMenuPost(null);
              showToast(t(ok ? "feedback.linkCopied" : "feedback.linkNotCopied"));
            },
            closeHelp: (note) => {
              const p = menuPost;
              act(() => {}, () => closeHelp(p.id, note));
            },
            remove: async () => { const p = menuPost; setMenuPost(null); await onAction("delete", p); },
            /* Saved and followed are lists of {post_id, profile_id}, so
               the local change is adding or dropping one row — the same
               shape the server will confirm. */
            save: (on) => {
              const p = menuPost;
              const was = extras.saves;
              act(
                () => setExtras((x) => ({
                  ...x,
                  saves: on
                    ? x.saves.filter((r) => !(r.post_id === p.id && r.profile_id === myId))
                    : [...x.saves, { post_id: p.id, profile_id: myId }],
                })),
                () => toggleSave(p.id, myId, !on),
                () => setExtras((x) => ({ ...x, saves: was }))
              );
            },
            follow: (on) => {
              const p = menuPost;
              const was = extras.follows;
              act(
                () => setExtras((x) => ({
                  ...x,
                  follows: on
                    ? x.follows.filter((r) => !(r.post_id === p.id && r.profile_id === myId))
                    : [...x.follows, { post_id: p.id, profile_id: myId }],
                })),
                () => toggleFollow(p.id, myId, !on),
                () => setExtras((x) => ({ ...x, follows: was }))
              );
            },
            hide: async () => { const p = menuPost; setMenuPost(null); await hideOne(p); },
            showLess: async () => {
              const name = (menuAuthor?.full_name || "").split(" ")[0];
              await showLessFrom(myId, menuPost.author_id);
              setMenuPost(null);
              await load();
              showToast(t("feedback.showLessDone", { name }));
            },
            report: async () => { const p = menuPost; setMenuPost(null); await onAction("report", p, ""); },
          }}
        />
      )}
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        {/* "Community" is a heading for the /app/community screen and
           noise on Home, where §4 allows the header, the composer, the
           log row and the feed and nothing else. A 32px display line
           costs about 50px to name the thing a person is already
           looking at — and Home has no tab called Community to be
           consistent with any more, since §1 merged it in.

           Kept on its own route, where it is the page title and the
           only thing saying where you are. */}
        {!onHome && (
          <h1
            style={{
              fontFamily: meta.fonts.heading,
              fontSize: ts(32),
              fontWeight: 700,
              color: C.green,
              margin: "0 0 8px",
              flex: 1,
            }}
          >
            {t("community.feed.title")}
          </h1>
        )}
        {/* Doors only for those the surfaces will actually admit — a
            suspended Buddy keeps the page's gentle no-access note, not
            two links that refuse on arrival (PARITY.md). */}
        {/* THE TWO PILLS ARE GONE — §3 and §2.1.

           Messages moved to the header, where it is on every screen
           rather than only this one, so a pill here was a second door
           costing a row of vertical space on the screen §4 is trying
           to give back to the feed.

           "Connect with Saath-Icons" is deleted with the People tab.
           Its label promised finding people and it landed on the
           Requests inbox — people who had already found you. Finding
           people is unified search now (§5), which is in the header
           beside Messages. */}
      </div>
      {/* The "What people are sharing, newest first…" line is deleted
         (§4). That sentence was the product describing itself to
         itself: a person looking at posts from their neighbours can
         see what it is. */}

      {/* NO FILTERS (§4.2). One feed, ordered by a rule set. Two pills
         asked a person to choose between two feeds before they had
         seen either, and the answer for almost everybody was "both". */}

      {error && (
        <BodyText role="alert" style={{ fontWeight: 700, color: C.brown }}>
          <Icon name="warn" size={17} style={{ display: "inline", verticalAlign: "-3px", marginInlineEnd: 6, color: MEANING.warning }} />{error}
        </BodyText>
      )}

      {access === null ? (
        <BodyText muted role="status">…</BodyText>
      ) : access === false ? (
        <Card>
          <BodyText muted style={{ margin: 0 }}>{t("community.feed.noAccess")}</BodyText>
        </Card>
      ) : (
        <>
          {canWrite && (
            <Card>
              {/* §1 — one row, not a form permanently sitting in the
                  place a post should be. No avatar: the header already
                  carries that face, and two of the same face on one
                  screen is noise. */}
              {composer && <ComposerRow onOpen={openComposer} />}
              {isIcon && (
                <GhostBtn onClick={openWalkComposer} aria-expanded={walkOpen}>
                  <Icon name="activity" size={17} style={{ display: "inline", verticalAlign: "-3px", marginInlineEnd: 6 }} />{t("community.shares.activityCta")}
                </GhostBtn>
              )}

              {walkOpen && (
                <form
                  onSubmit={submitActivity}
                  style={{ borderTop: `1.5px solid ${C.warmGray}`, marginTop: 14, paddingTop: 14 }}
                >
                  <label style={{ display: "block", fontSize: ts(A11Y.minBodyPx), fontWeight: 600, marginBottom: 14 }}>
                    {t("community.shares.activityLabel")}
                    <input
                      value={walkActivity}
                      onChange={(e) => setWalkActivity(e.target.value)}
                      placeholder={t("community.shares.activityPlaceholder")}
                      maxLength={120}
                      style={{ marginTop: 6 }}
                    />
                  </label>
                  <label style={{ display: "block", fontSize: ts(A11Y.minBodyPx), fontWeight: 600, marginBottom: 8 }}>
                    {t("community.shares.activityPlace")}
                    <input
                      value={walkPlaceText}
                      onChange={(e) => {
                        setWalkPlaceText(e.target.value);
                        setWalkPlaceId(""); // typing means it's no longer a picked place
                      }}
                      placeholder={t("community.shares.activityPlacePh")}
                      maxLength={120}
                      style={{ marginTop: 6 }}
                    />
                  </label>
                  {/* Tappable suggestions: common answers first, then
                      matching outdoor places (those carry an id so the
                      outing reaches the park board). Free text always
                      wins — these only fill the field. */}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
                    {[
                      t("community.shares.placePark"),
                      t("community.shares.placeHome"),
                      t("community.shares.placeCall"),
                    ]
                      .filter(
                        (c) =>
                          !walkPlaceText.trim() ||
                          c.toLowerCase().includes(walkPlaceText.trim().toLowerCase())
                      )
                      .map((c) => (
                        <GhostBtn
                          key={c}
                          onClick={() => {
                            setWalkPlaceText(c);
                            setWalkPlaceId("");
                          }}
                          style={{ minHeight: A11Y.minTapTargetPx, padding: "0 14px" }}
                        >
                          {c}
                        </GhostBtn>
                      ))}
                    {walkPlaces
                      .filter(
                        (p) =>
                          !walkPlaceText.trim() ||
                          `${p.name} ${p.city}`
                            .toLowerCase()
                            .includes(walkPlaceText.trim().toLowerCase())
                      )
                      .slice(0, 5)
                      .map((p) => (
                        <GhostBtn
                          key={p.id}
                          onClick={() => {
                            setWalkPlaceText(p.name);
                            setWalkPlaceId(p.id);
                          }}
                          aria-pressed={walkPlaceId === p.id}
                          style={
                            walkPlaceId === p.id
                              ? {
                                  minHeight: A11Y.minTapTargetPx,
                                  padding: "0 14px",
                                  borderColor: C.green,
                                }
                              : { minHeight: A11Y.minTapTargetPx, padding: "0 14px" }
                          }
                        >
                          <Icon name="park" size={16} style={{ display: "inline", verticalAlign: "-3px", marginInlineEnd: 5 }} />{p.name} · {p.city}
                        </GhostBtn>
                      ))}
                  </div>
                  <label style={{ display: "block", fontSize: ts(A11Y.minBodyPx), fontWeight: 600, marginBottom: 14 }}>
                    {t("community.shares.activityWhen")}
                    <input
                      type="datetime-local"
                      value={walkWhen}
                      onChange={(e) => setWalkWhen(e.target.value)}
                      style={{ marginTop: 6 }}
                    />
                  </label>
                  <label style={{ display: "block", fontSize: ts(A11Y.minBodyPx), fontWeight: 600, marginBottom: 14 }}>
                    {t("outdoor.place.outingNote")}
                    <input
                      value={walkNote}
                      onChange={(e) => setWalkNote(e.target.value)}
                      placeholder={t("outdoor.place.outingNotePh")}
                      maxLength={300}
                      style={{ marginTop: 6 }}
                    />
                  </label>
                  <label style={{ display: "block", fontSize: ts(A11Y.minBodyPx), fontWeight: 600, marginBottom: 14 }}>
                    {t("community.shares.activityLimit")}
                    <select
                      value={walkLimit}
                      onChange={(e) => setWalkLimit(e.target.value)}
                      style={{ marginTop: 6 }}
                    >
                      <option value="">{t("community.shares.activityNoLimit")}</option>
                      {[2, 3, 4, 5, 6, 8, 10].map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 12,
                      fontSize: ts(A11Y.minBodyPx),
                      fontWeight: 600,
                      marginBottom: 14,
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={walkRsvp}
                      onChange={(e) => setWalkRsvp(e.target.checked)}
                      style={{
                        width: 28,
                        height: 28,
                        minHeight: 0,
                        marginTop: 2,
                        accentColor: C.green,
                        flex: "0 0 auto",
                      }}
                    />
                    <span>
                      {t("community.shares.rsvpLabel")}
                      <span
                        style={{
                          display: "block",
                          fontWeight: 400,
                          color: C.textMuted,
                          fontSize: ts(16),
                        }}
                      >
                        {t("community.shares.rsvpHint")}
                      </span>
                    </span>
                  </label>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <PrimaryBtn type="submit" onClick={submitActivity} disabled={!walkActivity.trim()}>
                      {t("community.feed.composerCta")}
                    </PrimaryBtn>
                    <GhostBtn onClick={() => setWalkOpen(false)}>
                      {t("outdoor.place.formCancel")}
                    </GhostBtn>
                  </div>
                </form>
              )}
            </Card>
          )}

          {pendingPosts.map((p) => (
            <Card key={p.key} style={{ opacity: 0.72, borderStyle: "dashed" }}>
              <BodyText style={{ margin: 0 }}>{p.body}</BodyText>
              {p.hasPhoto && (
                <BodyText muted style={{ margin: "6px 0 0", fontSize: ts(16) }}>
                  {t("community.feed.photoSending")}
                </BodyText>
              )}
              <BodyText muted role="status" style={{ margin: "8px 0 0", fontSize: ts(16), fontWeight: 600 }}>
                · {t("feedback.sending")}
              </BodyText>
            </Card>
          ))}

          {(() => {
            /* §4.2 — ONE FEED, ORDERED BY A RULE SET, NOT A MODEL.

               Friends first, then your neighbourhood, then your city,
               then everyone else — and within each band, newest
               first. That is the whole rule, and it fits in one
               sentence on purpose: §4.2 requires it stay explainable
               to any person who asks why they are seeing this.

               IT MUST NEVER BECOME AN ENGAGEMENT RANKING. A model
               that learns who you click is a popularity ranking of
               human beings, which is principle 4. Nothing here reads
               a click, a dwell or a reaction; the bands are facts
               about where two people live and whether they are
               connected, and nothing is ever buried — the last band
               is still on the same page.

               A stable sort keeps equal posts in the order the query
               returned them, which is already newest first. */
            /* THE GEOGRAPHY IS widenFeed's, NOT RECOMPUTED HERE.

               communityData.widenFeed already decides WHO is shown —
               it starts at your area and widens to city, then further,
               until there are at least a few posts — and it tags every
               post it returns with the band it came from. What it does
               not do is ORDER by that band: it finishes with a single
               newest-first sort across all of them, because inclusion
               was the question it was written to answer.

               So this adds the ordering §4.2 asks for and nothing
               else. Recomputing area and city here would have been a
               second geography rule beside theirs — and mine compared
               the strings raw where theirs trims and lowercases, so
               "Model Town" and "model town" would have banded
               differently on two screens reading one database.

               Friends are the one band widenFeed has no notion of,
               and they are §4.2's first. Array.prototype.sort is
               stable, so inside every band the newest-first order
               widenFeed produced survives untouched. */
            const RANK = { always: 1, area: 1, city: 2, far: 3 };
            const rankOf = (p) => (connections?.has(p.author_id) ? 0 : RANK[p.band] ?? 3);
            const visible = [...posts].sort((x, y) => rankOf(x) - rankOf(y));
            /* ONE ORDERING, NOT TWO. The first draft of this said group
               posts "join by recency" while community posts stayed banded
               by §4.2 — which cannot both be true of one list, and would
               have shipped as whichever the sort happened to win.

               So group posts are given a band rather than exempted from
               banding: rank 1, the same as area. A group you chose to join
               is an expressed affinity at least as strong as sharing a
               neighbourhood, and ranking it below strangers who merely live
               closer would be the wrong call. §4.2 does not settle this
               because it did not contemplate a second source; flagged in
               the report as mine rather than the spec's. */
            const GROUP_RANK = 1;
            const stream = [
              ...visible.map((p) => ({ kind: "post", key: `p-${p.id}`, rank: rankOf(p), at: p.created_at, p })),
              ...groupPosts.map((gp) => ({ kind: "group", key: `g-${gp.id}`, rank: GROUP_RANK, at: gp.created_at, gp })),
            ].sort((a, b) => (a.rank - b.rank) || (new Date(b.at) - new Date(a.at)));
            if (visible.length === 0) {
              return (
                <BodyText muted>
                  {isIcon
                    ? t("community.feed.emptyFeed")
                    : t("community.feed.emptyFeedReader")}
                </BodyText>
              );
            }
            /* §4.3 INLINE, not pinned. Placed after the third post so it
               sits inside the feed a person is already reading rather
               than displacing the newest thing their neighbours said —
               and on a short feed it simply lands at the end. */
            const RECONNECT_AT = 3;
            return stream.flatMap((item, i) => {
              /* A group post is not a community post: no reactions here
                 (they belong in the group), and it says WHICH group it came
                 from. A post surfacing in the main feed with no sign it is
                 from a group is the confusing half of §6. */
              if (item.kind === "group") {
                const gp = item.gp;
                return (
                  <Card
                    key={item.key}
                    onClick={() => navigate(`/app/groups/${gp.group_id}`)}
                    style={{ marginBottom: 14, cursor: "pointer" }}
                  >
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 6 }}>
                      <span style={{
                        fontSize: 13, fontWeight: 600, color: C.green,
                        background: C.ground, borderRadius: 999, padding: "3px 10px",
                      }}>{gp.groupName}</span>
                      <span style={{ fontSize: 14, color: C.textMuted }}>{gp.authorName}</span>
                    </div>
                    <BodyText style={{ margin: 0 }}>{gp.body}</BodyText>
                  </Card>
                );
              }
              const p = item.p;
              const card = (
              <div key={`w-${p.id}`} {...fresh.props(p.id)}>
              <PostCard
                key={p.id}
                post={p}
                author={authors[p.author_id]}
                myId={myId}
                isIcon={isIcon}
                myReaction={mineByPost[p.id] || null}
                counts={countsByPost[p.id] || {}}
                canWrite={canWrite}
                dateLocale={dateLocale}
                joinInfo={joins[p.id]}
                onToggleReaction={toggleReaction}
                onAction={onAction}
                editing={editingId === p.id}
                onEditCancel={() => setEditingId(null)}
                onEditSave={async (text) => {
                  try {
                    await editBody(p.id, text);
                    setPosts((ps) => ps.map((x) => (x.id === p.id ? { ...x, body: text.trim() } : x)));
                    setEditingId(null);
                    /* Said as soon as it is true, not after the feed
                       has finished reloading — the write has already
                       succeeded by here, and on a slow connection the
                       reload is seconds of silence after the fact. */
                    showToast(t("feedback.postUpdated"));
                    /* Not awaited: the caller keeps the button on
                       "Saving…" until this resolves, so awaiting the
                       reconcile held the editor open for a second
                       round trip after the words were already saved
                       and on screen. */
                    load();
                  } catch {
                    raiseToast(t("feedback.somethingWrong"), { tone: "error", key: "postaction" });
                  }
                }}
                taggedNames={extras.tags
                  .filter((x) => x.post_id === p.id)
                  .map((x) => authors[x.person_id]?.full_name || "")
                  .filter(Boolean)}
                iAmTagged={extras.tags.some((x) => x.post_id === p.id && x.person_id === myId)}
                onUntag={async () => {
                  await removeTag(p.id, myId);
                  setExtras(await fetchHelpExtras((posts || []).map((x) => x.id)));
                }}
                helpStatus={
                  p.style_tag === "help"
                    ? {
                        ...helpStatusOf(p, extras.offers),
                        note: p.help_note,
                      }
                    : null
                }
                helpNames={extras.offers
                  .filter((o) => o.post_id === p.id)
                  .map((o) => authors[o.helper_id]?.full_name || "")}
                iOffered={extras.offers.some((o) => o.post_id === p.id && o.helper_id === myId)}
                onMenu={setMenuPost}
              />
              </div>
              );
              if (reconnect && i === Math.min(RECONNECT_AT, stream.length - 1)) {
                return [
                  card,
                  <ReconnectRow
                    key="reconnect-row"
                    person={reconnect.person}
                    onHello={() => setHelloWith(reconnect.person)}
                    onPlay={() => setPlayWith(reconnect.person)}
                    onDismiss={() => { hushPerson(reconnect.otherId); setReconnect(null); }}
                  />,
                ];
              }
              return card;
            });
          })()}
        </>
      )}

    </CommunityScreen>
  );
}
