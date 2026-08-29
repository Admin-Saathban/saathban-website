/* ════════════════════════════════════════════════
   Community feed — /app/community.

   Chronological, nothing else (SPEC.md: no algorithm). Icons and the
   org account write; everyone else reads and may react. Report, mute,
   and block sit one tap away on every post and comment via the ⋯
   menu (SPEC.md: non-negotiable). RLS decides what arrives: a muted
   or blocked author's rows simply never come back after refetch.
   ════════════════════════════════════════════════ */

import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { useSession } from "../../lib/session.jsx";
import { REACTIONS } from "./communityCopy.js";
import {
  canUseCommunity,
  canPostCommunity,
  fetchFeed,
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
  shareWalk,
  joinWalk,
  fetchConnections,
} from "./communityData.js";
import { CommunityScreen, Card, BodyText, PrimaryBtn, GhostBtn, Toast } from "./ui.jsx";

function AuthorLine({ author, when, dateLocale }) {
  const { t, ts } = useI18n();
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
      <span style={{ fontSize: ts(19), fontWeight: 700, color: C.green }}>
        {author?.full_name || "…"}
      </span>
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
function ShareBlock({ post, isIcon, own, dateLocale, onAction }) {
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
            to="/app/events"
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
  onToggleReaction,
  onAction,
}) {
  const { t, ts } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState(null); // null = not loaded
  const [commentAuthors, setCommentAuthors] = useState({});
  const [commentBody, setCommentBody] = useState("");
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
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(!menuOpen)}
            style={{ padding: "0 14px" }}
          >
            ⋯
          </GhostBtn>
          {menuOpen && (
            <div
              style={{
                position: "absolute",
                insetInlineEnd: 0,
                top: "110%",
                zIndex: 30,
                background: C.white,
                border: `1.5px solid ${C.warmGray}`,
                borderRadius: 14,
                boxShadow: "0 6px 20px rgba(45,36,24,0.18)",
                minWidth: 240,
                padding: "6px 0",
              }}
            >
              {menuItem(t("community.feed.menuReport"), () => setReporting(true))}
              {!own && menuItem(t("community.feed.menuMessage"), () => onAction("dm", post))}
              {!own && menuItem(t("community.feed.menuMute"), () => onAction("mute", post))}
              {!own && menuItem(t("community.feed.menuBlock"), () => onAction("block", post))}
              {own && menuItem(t("community.feed.menuDeleteOwn"), () => onAction("delete", post))}
            </div>
          )}
        </div>
      </div>

      {post.body && (
        <BodyText style={{ margin: "10px 0 12px", whiteSpace: "pre-wrap" }}>{post.body}</BodyText>
      )}
      {post.post_type && post.post_type !== "text" && (
        <div style={{ marginTop: post.body ? 0 : 10 }}>
          <ShareBlock
            post={post}
            isIcon={isIcon}
            own={own}
            dateLocale={dateLocale}
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
            <form onSubmit={sendComment} style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <input
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value)}
                placeholder={t("community.feed.commentPlaceholder")}
                style={{ flex: 1 }}
              />
              <GhostBtn type="submit" onClick={sendComment} style={{ borderColor: C.green, color: C.green }}>
                {t("community.feed.commentCta")}
              </GhostBtn>
            </form>
          )}
        </div>
      )}
    </Card>
  );
}

export default function Feed() {
  const { t, ts, meta, lang } = useI18n();
  const { profile } = useSession();
  const myId = profile?.id;
  const dateLocale = lang === "ur" ? "ur-PK" : "en-GB";

  const [access, setAccess] = useState(null); // null loading | true | false
  const [canWrite, setCanWrite] = useState(false);
  const [posts, setPosts] = useState([]);
  const [authors, setAuthors] = useState({});
  const [reactions, setReactions] = useState([]);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null); // { text, actionLabel, onAction }
  const toastTimer = useRef(null);

  const [body, setBody] = useState("");
  const [file, setFile] = useState(null);
  const [posting, setPosting] = useState(false);
  const fileRef = useRef(null);

  // Friends tab (circle connections) + the walk share composer.
  const [tab, setTab] = useState("all"); // "all" | "friends"
  const [connections, setConnections] = useState(null); // Set | null
  const [walkOpen, setWalkOpen] = useState(false);
  const [walkPlaces, setWalkPlaces] = useState([]);
  const [walkPlaceId, setWalkPlaceId] = useState("");
  const [walkWhen, setWalkWhen] = useState("");
  const [walkNote, setWalkNote] = useState("");
  const isIcon = profile?.role === "saath_icon";

  const showToast = (text, actionLabel, onAction) => {
    window.clearTimeout(toastTimer.current);
    setToast({ text, actionLabel, onAction });
    toastTimer.current = window.setTimeout(() => setToast(null), 6000);
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

  const submitWalk = async (e) => {
    e.preventDefault();
    const place = walkPlaces.find((p) => p.id === walkPlaceId);
    if (!place || !walkWhen) return;
    setError("");
    try {
      await shareWalk(myId, place, new Date(walkWhen).toISOString(), walkNote);
      setWalkOpen(false);
      setWalkPlaceId("");
      setWalkWhen("");
      setWalkNote("");
      showToast(t("community.shares.walkShared"));
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
      setPosts(rows);
      const [a, r] = await Promise.all([
        fetchAuthors(rows.map((p) => p.author_id)),
        fetchReactions(rows.map((p) => p.id)),
      ]);
      setAuthors(a);
      setReactions(r);
      // Connections power the Friends tab; a failure just leaves the
      // tab empty-with-a-door rather than erroring the feed.
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

  const share = async (e) => {
    e.preventDefault();
    if (!body.trim()) return;
    setPosting(true);
    setError("");
    try {
      await createPost(myId, body, file);
      setBody("");
      setFile(null);
      await load();
    } catch {
      setError(t("community.feed.postError"));
    } finally {
      setPosting(false);
    }
  };

  const toggleReaction = async (postId, emoji, mine) => {
    try {
      if (mine) await clearReaction(postId, myId);
      else await setReaction(postId, myId, emoji);
      setReactions(await fetchReactions(posts.map((p) => p.id)));
    } catch {
      /* reaction is a nicety; stay quiet */
    }
  };

  const onAction = async (kind, target, reason) => {
    try {
      if (kind === "report") {
        await fileReport(myId, "post", target.id, target.author_id, target.body, reason);
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

  return (
    <CommunityScreen>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
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
        <Link
          to="messages"
          style={{
            display: "inline-flex",
            alignItems: "center",
            minHeight: A11Y.minTapTargetPx,
            padding: "0 18px",
            borderRadius: 50,
            border: `2px solid ${C.green}`,
            color: C.green,
            fontSize: ts(A11Y.minBodyPx),
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          ✉️ {t("community.feed.messagesCta")}
        </Link>
      </div>
      <BodyText muted style={{ marginBottom: 14 }}>{t("community.feed.intro")}</BodyText>

      {/* Everyone | Friends — same feed, the second filtered to the
          viewer's circle connections. */}
      <div role="tablist" style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        {[
          ["all", t("community.shares.allTab")],
          ["friends", t("community.shares.friendsTab")],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              minHeight: A11Y.minTapTargetPx,
              padding: "0 20px",
              borderRadius: 50,
              border: tab === id ? `3px solid ${C.green}` : `1.5px solid ${C.warmGray}`,
              background: tab === id ? C.white : "transparent",
              color: C.textMain,
              fontSize: ts(A11Y.minBodyPx),
              fontWeight: 600,
              fontFamily: "inherit",
              cursor: "pointer",
            }}
          >
            <span aria-hidden="true" style={{ color: C.green, visibility: tab === id ? "visible" : "hidden" }}>
              ✓
            </span>
            {label}
          </button>
        ))}
      </div>

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
              <form onSubmit={share}>
                <textarea
                  rows={3}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder={t("community.feed.composerPlaceholder")}
                  maxLength={4000}
                />
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  style={{ position: "absolute", width: 1, height: 1, opacity: 0 }}
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
                <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                  <GhostBtn onClick={() => fileRef.current?.click()}>
                    📷 {file ? t("community.feed.composerImageChosen") : t("community.feed.composerImage")}
                  </GhostBtn>
                  {isIcon && (
                    <GhostBtn onClick={openWalkComposer} aria-expanded={walkOpen}>
                      🚶 {t("community.shares.walkCta")}
                    </GhostBtn>
                  )}
                  <PrimaryBtn type="submit" onClick={share} disabled={posting || !body.trim()}>
                    {posting ? t("community.feed.posting") : t("community.feed.composerCta")}
                  </PrimaryBtn>
                </div>
              </form>

              {walkOpen && (
                <form
                  onSubmit={submitWalk}
                  style={{ borderTop: `1.5px solid ${C.warmGray}`, marginTop: 14, paddingTop: 14 }}
                >
                  <label style={{ display: "block", fontSize: ts(A11Y.minBodyPx), fontWeight: 600, marginBottom: 14 }}>
                    {t("community.shares.walkPlace")}
                    <select
                      value={walkPlaceId}
                      onChange={(e) => setWalkPlaceId(e.target.value)}
                      style={{ marginTop: 6 }}
                    >
                      <option value="">…</option>
                      {walkPlaces.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} · {p.city}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label style={{ display: "block", fontSize: ts(A11Y.minBodyPx), fontWeight: 600, marginBottom: 14 }}>
                    {t("outdoor.place.outingWhen")}
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
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <PrimaryBtn type="submit" onClick={submitWalk} disabled={!walkPlaceId || !walkWhen}>
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

          {(() => {
            const visible =
              tab === "friends"
                ? posts.filter((p) => connections?.has(p.author_id))
                : posts;
            if (visible.length === 0) {
              return (
                <BodyText muted>
                  {tab === "friends"
                    ? t("community.shares.friendsEmpty")
                    : t("community.feed.emptyFeed")}
                </BodyText>
              );
            }
            return visible.map((p) => (
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
                onToggleReaction={toggleReaction}
                onAction={onAction}
              />
            ));
          })()}
        </>
      )}

      {toast && <Toast text={toast.text} actionLabel={toast.actionLabel} onAction={toast.onAction} />}
    </CommunityScreen>
  );
}
