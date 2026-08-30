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
import { COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { useSession } from "../../lib/session.jsx";
import { REACTIONS } from "./communityCopy.js";
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
import { VoicePlayer } from "../people/VoiceNote.jsx";
import StickerPicker from "../../assets/stickers/StickerPicker.jsx";
import { Sticker, parseStickerRef, stickerRef } from "../../assets/stickers/stickers.jsx";
import {
  colourOf,
  postAudioUrl,
  fetchHelpExtras,
  offerHelp,
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
} from "./postsData.js";
import { useToast, useFresh } from "../../lib/feedback.jsx";

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
        <GhostBtn onClick={onCancel}>✕</GhostBtn>
      </div>
    </div>
  );
}

/* The typed share block inside a post card (migration 0018). Renders
   entirely from the payload snapshot, localized at view time. */
function ShareBlock({ post, isIcon, own, dateLocale, joinInfo, onAction }) {
  const { t, ts, lang } = useI18n();
  const p = post.payload || {};
  const box = {
    background: "#f4f7f1",
    border: `2px solid ${C.sage}`,
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
            {p.emoji || "🏅"}
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
          🌱 {t("community.shares.scoreTitle")}
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
          🚶 {t("community.shares.walkTitle")}
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
          🗓️ {t("community.shares.eventLine")} <strong>{p.title}</strong>
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
          🙌 {t("community.shares.activityTitle")}
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
            ✓ {t("community.shares.activityJoined")}
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
                  ? `✋ ${t("community.shares.activityRsvpJoin")}`
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
          🎲 {t("community.shares.gameOpenLine", { game: name })}
        </p>
        <p style={line}>
          {t("community.shares.gameOpenSeats", {
            taken: p.seats_taken ?? "…",
            total: p.seats_total ?? "…",
          })}
        </p>
        {!own && (
          <div style={{ marginTop: 10 }}>
            <PrimaryBtn onClick={() => onAction("claimGameSeat", post)}>
              {t("community.shares.gameOpenCta")}
            </PrimaryBtn>
          </div>
        )}
      </div>
    );
  }

  /* Daily Riddle result — number of guesses only, never the answer. */
  if (post.post_type === "puzzle_result") {
    return (
      <div style={box}>
        <p style={line}>
          🧩{" "}
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
}) {
  const { t, ts } = useI18n();
  const [reporting, setReporting] = useState(false);
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
  const own = post.author_id === myId;

  const openComments = async () => {
    const next = !commentsOpen;
    setCommentsOpen(next);
    if (next && comments === null) {
      try {
        const rows = await fetchComments(post.id);
        setComments(rows);
        setCommentAuthors(await fetchAuthors(rows.map((r) => r.author_id)));
      } catch {
        setComments([]);
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
    <Card>
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

      {post.body && (colourOf(post) ? (
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
          {post.body}
        </div>
      ) : (
        <BodyText style={{ margin: "10px 0 12px", whiteSpace: "pre-wrap" }}>{post.body}</BodyText>
      ))}

      {/* §5 — who is named on this post, and a way off it for the
          person named. Without this the tag existed only in the
          database: nobody could see it and the promise that you can
          remove it had nothing to attach to. */}
      {taggedNames && taggedNames.length > 0 && (
        <p style={{ margin: "6px 0 0", fontSize: ts(16), color: C.textMuted }}>
          🫶 {t("posts.withNames", { names: taggedNames.join(", ") })}
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
          return (
            <button
              key={emoji}
              type="button"
              aria-pressed={mine}
              onClick={() => onToggleReaction(post.id, emoji, mine)}
              style={{
                minHeight: A11Y.minTapTargetPx,
                minWidth: A11Y.minTapTargetPx + 12,
                padding: "0 12px",
                borderRadius: 50,
                border: `2px solid ${mine ? C.green : C.warmGray}`,
                background: mine ? "#eef3ea" : C.white,
                fontSize: ts(18),
                fontFamily: "inherit",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span aria-hidden="true">{emoji}</span>
              {n > 0 && <span style={{ fontWeight: 700, color: C.textMain }}>{n}</span>}
            </button>
          );
        })}
        <GhostBtn aria-expanded={commentsOpen} onClick={openComments} style={{ border: "none" }}>
          💬 {t("community.feed.comments")}
        </GhostBtn>
      </div>

      {commentsOpen && (
        <div style={{ borderTop: `1.5px solid ${C.warmGray}`, marginTop: 10, paddingTop: 12 }}>
          {comments === null ? (
            <BodyText muted role="status">…</BodyText>
          ) : comments.length === 0 ? (
            <BodyText muted>{t("community.feed.noComments")}</BodyText>
          ) : (
            comments.map((cm) => (
              <div key={cm.id} style={{ marginBottom: 10 }}>
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
                <BodyText style={{ margin: "2px 0 0" }}>{cm.body}</BodyText>
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
                  🌸
                </GhostBtn>
                <GhostBtn type="submit" onClick={sendComment} style={{ borderColor: C.green, color: C.green }}>
                  {t("community.feed.commentCta")}
                </GhostBtn>
              </form>
            </>
          )}
        </div>
      )}
    </Card>
  );
}

export default function Feed() {
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
  /* §1 — the composer is a screen now, opened from the row. */
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerStart, setComposerStart] = useState(null);
  /* §10 — one sheet for the whole feed, not one per card. */
  const [menuPost, setMenuPost] = useState(null);
  /* §6/§10 — offers, saves and follows for what is on screen. */
  const [extras, setExtras] = useState({ offers: [], saves: [], follows: [], tags: [] });

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
      setPosts(widened.posts);
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
  const toggleReaction = async (postId, emoji, mine) => {
    const prior = reactions;
    setReactions((rs) => {
      const withoutMine = rs.filter((r) => !(r.post_id === postId && r.profile_id === myId));
      return mine ? withoutMine : [...withoutMine, { post_id: postId, profile_id: myId, emoji }];
    });
    try {
      if (mine) await clearReaction(postId, myId);
      else await setReaction(postId, myId, emoji);
      setReactions(await fetchReactions(posts.map((p) => p.id)));
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
      } else if (kind === "withdrawHelp") {
        await withdrawOffer(target.id, myId);
        setExtras(await fetchHelpExtras((posts || []).map((p) => p.id)));
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
        await deleteOwnPost(target.id);
        await load();
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
    <CommunityScreen>
      {/* §1 — full screen, opened from the row in the feed. */}
      <Composer
        open={composerOpen}
        startWith={composerStart}
        busy={posting}
        onClose={() => setComposerOpen(false)}
        onShare={share}
      />

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
            pin: async (on) => { await setPinned(menuPost.id, on); setMenuPost(null); await load(); },
            changeVisibility: async () => {
              /* Cycles through the three in §2's order — the sheet
                 shows the current value on the row, so the change is
                 visible where it was made. */
              const order = ["public", "friends", "private"];
              const next = order[(order.indexOf(menuPost.visibility || "public") + 1) % 3];
              await setPostVisibility(menuPost.id, next);
              setMenuPost({ ...menuPost, visibility: next });
              await load();
            },
            edit: () => { setMenuPost(null); openComposer(null); },
            setReplies: async (off) => { await setRepliesOff(menuPost.id, off); setMenuPost(null); await load(); },
            copyLink: async () => { await copyLink(menuPost.id); setMenuPost(null); },
            closeHelp: async (note) => { await closeHelp(menuPost.id, note); setMenuPost(null); await load(); },
            remove: async () => { const p = menuPost; setMenuPost(null); await onAction("delete", p); },
            save: async (on) => {
              await toggleSave(menuPost.id, myId, !on);
              setExtras(await fetchHelpExtras((posts || []).map((x) => x.id)));
              setMenuPost(null);
            },
            follow: async (on) => {
              await toggleFollow(menuPost.id, myId, !on);
              setExtras(await fetchHelpExtras((posts || []).map((x) => x.id)));
              setMenuPost(null);
            },
            hide: async () => { const p = menuPost; setMenuPost(null); await onAction("hide", p); },
            showLess: async () => {
              await showLessFrom(myId, menuPost.author_id);
              setMenuPost(null);
              await load();
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
          ⚠ {error}
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
              <ComposerRow onOpen={openComposer} />
              {isIcon && (
                <GhostBtn onClick={openWalkComposer} aria-expanded={walkOpen}>
                  🙌 {t("community.shares.activityCta")}
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
                          🌳 {p.name} · {p.city}
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
            if (visible.length === 0) {
              return (
                <BodyText muted>
                  {isIcon
                    ? t("community.feed.emptyFeed")
                    : t("community.feed.emptyFeedReader")}
                </BodyText>
              );
            }
            return visible.map((p) => (
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
            ));
          })()}
        </>
      )}

    </CommunityScreen>
  );
}
