/* ════════════════════════════════════════════════
   A group — Feed, Chat, and Members. Any member posts and chats;
   anyone leaves at any time; the creator invites connections and can
   remove a member (one tap, no notification — the circle's rule). Report
   the group or a post into the shared community queue. Blocks and hides
   are enforced at the database; this screen just reflects them.
   ════════════════════════════════════════════════ */

import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { useSession } from "../../lib/session.jsx";
import { Screen, H1, Card, BodyText, SectionLabel, Pill, PrimaryBtn, GhostBtn } from "./ui.jsx";
import { STRINGS } from "./groupsCopy.js";
import { pushToast, useFresh } from "../../lib/feedback.jsx";
import StickerPicker from "../../assets/stickers/StickerPicker.jsx";
import { Sticker, parseStickerRef, stickerRef } from "../../assets/stickers/stickers.jsx";
import {
  fetchGroup, fetchMembers, fetchPosts, addPost, fetchMessages, sendMessage,
  fetchConnections, inviteToGroup, removeMember, leaveGroup, reportTarget,
} from "./groupsStore.js";

const clock = (iso) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

export default function GroupPage() {
  const { id } = useParams();
  const { lang, ts, meta, t } = useI18n();
  const s = (STRINGS[lang] || STRINGS.en).group;
  const { profile } = useSession();
  const myId = profile?.id;
  const navigate = useNavigate();

  const [group, setGroup] = useState(undefined); // undefined loading, null gone
  const [tab, setTab] = useState("feed");
  const [stickersOpen, setStickersOpen] = useState(false);
  const [members, setMembers] = useState([]);
  const [posts, setPosts] = useState([]);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [chatDraft, setChatDraft] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [sharing, setSharing] = useState(false);
  const [chatting, setChatting] = useState(false);
  const [invitingId, setInvitingId] = useState(null);
  const fresh = useFresh();
  const [invitePanel, setInvitePanel] = useState(false);
  const [connections, setConnections] = useState(null);
  const [reportingPost, setReportingPost] = useState(null); // post id
  const [reportingGroup, setReportingGroup] = useState(false);
  const [reason, setReason] = useState("");
  const [confirmLeave, setConfirmLeave] = useState(false);

  const iAmCreator = group && group.created_by === myId;

  const loadCore = useCallback(async () => {
    try {
      const g = await fetchGroup(id);
      if (!g) { setGroup(null); return; }
      setGroup(g);
      setMembers(await fetchMembers(id));
    } catch { setError(s.loadError); }
  }, [id, s.loadError]);

  useEffect(() => { loadCore(); }, [loadCore]);

  useEffect(() => {
    if (!group) return;
    if (tab === "feed") fetchPosts(id).then(setPosts).catch(() => setError(s.loadError));
    if (tab === "chat") fetchMessages(id).then(setMessages).catch(() => setError(s.loadError));
  }, [tab, group, id, s.loadError]);

  if (group === undefined) return <Screen backTo="/app/groups" backLabel={s.back}><BodyText muted role="status">···</BodyText></Screen>;
  if (group === null) return <Screen backTo="/app/groups" backLabel={s.back}><BodyText muted>{s.loadError}</BodyText></Screen>;

  /* Optimistic in both directions: the words leave the box at once
     and return to it if the server refuses. */
  const share = async () => {
    if (!draft.trim() || sharing) return;
    const kept = draft;
    setDraft("");
    setSharing(true);
    try {
      const before = new Set(posts.map((p) => p.id));
      await addPost(id, kept);
      const rows = await fetchPosts(id);
      setPosts(rows);
      pushToast(t("feedback.groupPosted"));
      const added = rows.find((p) => !before.has(p.id));
      if (added) fresh.mark(added.id);
    } catch {
      setDraft(kept);
      setError(s.actionError);
      pushToast(t("feedback.somethingWrong"), { tone: "error" });
    } finally {
      setSharing(false);
    }
  };
  const chat = async () => {
    if (!chatDraft.trim() || chatting) return;
    const kept = chatDraft;
    setChatDraft("");
    setChatting(true);
    try {
      await sendMessage(id, kept);
      setMessages(await fetchMessages(id));
    } catch {
      setChatDraft(kept);
      setError(s.actionError);
      pushToast(t("feedback.dmFailed"), { tone: "error" });
    } finally {
      setChatting(false);
    }
  };
  /* STICKERS_WIRING: a sticker is an ordinary message whose body is
     :sticker/<id>: — no schema change. */
  const sendSticker = async (stickerId) => {
    setStickersOpen(false);
    try { await sendMessage(id, stickerRef(stickerId)); setMessages(await fetchMessages(id)); }
    catch { setError(s.actionError); }
  };
  const openInvite = async () => {
    setInvitePanel(true);
    if (connections === null) setConnections(await fetchConnections().catch(() => []));
  };
  /* Per-person pending: invite several friends in a row. */
  const invite = async (person) => {
    if (invitingId) return;
    setInvitingId(person.id);
    try {
      await inviteToGroup(id, person.id);
      setNotice(s.invited(person.full_name));
      pushToast(t("feedback.memberInvited", { name: (person.full_name || "").split(" ")[0] }));
    } catch {
      setError(s.inviteError);
      pushToast(s.inviteError, { tone: "error" });
    } finally {
      setInvitingId(null);
    }
  };
  const kick = async (m) => {
    try { await removeMember(id, m.member_id); setMembers(await fetchMembers(id)); }
    catch { setError(s.actionError); }
  };
  const doLeave = async () => {
    try {
      await leaveGroup(id);
      pushToast(t("feedback.groupLeft"), { tone: "info" });
      navigate("/app/groups", { replace: true });
    } catch {
      setError(s.actionError);
      pushToast(t("feedback.somethingWrong"), { tone: "error" });
    }
  };
  const sendReport = async () => {
    try {
      if (reportingGroup) {
        await reportTarget({ kind: "group", targetId: id, authorId: group.created_by, excerpt: group.name, reason });
      } else if (reportingPost) {
        const p = posts.find((x) => x.id === reportingPost);
        await reportTarget({ kind: "group_post", targetId: reportingPost, authorId: p?.author_id, excerpt: (p?.body || "").slice(0, 140), reason });
      }
      setReportingPost(null); setReportingGroup(false); setReason(""); setNotice(s.reported);
    } catch { setError(s.actionError); }
  };

  const Tab = ({ k }) => {
    const active = tab === k;
    return (
      <button type="button" aria-pressed={active} onClick={() => setTab(k)} style={{
        display: "inline-flex", alignItems: "center", gap: 8, minHeight: A11Y.minTapTargetPx, padding: "0 18px",
        borderRadius: 50, border: active ? `3px solid ${C.green}` : `1.5px solid ${C.warmGray}`,
        background: active ? C.white : "transparent", color: C.textMain, fontSize: ts(A11Y.minBodyPx), fontWeight: 600, fontFamily: "inherit", cursor: "pointer",
      }}>
        <span aria-hidden="true" style={{ color: C.green, visibility: active ? "visible" : "hidden" }}>✓</span>
        {s.tabs[k]}
      </button>
    );
  };

  return (
    <Screen backTo="/app/groups" backLabel={s.back}>
      <H1>{group.name}</H1>
      {group.description && <BodyText muted>{group.description}</BodyText>}

      {notice && <BodyText role="status" style={{ color: C.green, fontWeight: 600 }}>✓ {notice}</BodyText>}
      {error && <BodyText role="alert" style={{ color: C.error, fontWeight: 600 }}>{error}</BodyText>}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", margin: "8px 0 16px" }}>
        <Tab k="feed" /><Tab k="chat" /><Tab k="members" />
      </div>

      {tab === "feed" && (
        <>
          <Card>
            <textarea value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={s.composerPh} rows={3} maxLength={4000} style={{ resize: "vertical" }} />
            <div style={{ marginTop: 10 }}><PrimaryBtn onClick={share} disabled={!draft.trim()}>{s.post}</PrimaryBtn></div>
          </Card>
          {posts.length === 0 ? <BodyText muted>{s.feedEmpty}</BodyText> : posts.map((p) => (
            <Card key={p.id}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontWeight: 700, fontSize: ts(18), color: C.green }}>{p.authorName}</span>
                <span style={{ fontSize: ts(15), color: C.textMuted }}>{clock(p.created_at)}</span>
              </div>
              <BodyText style={{ margin: "8px 0 10px", whiteSpace: "pre-wrap" }}>{p.body}</BodyText>
              {reportingPost === p.id ? (
                <div>
                  <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={s.reportReasonPh} />
                  <div style={{ display: "flex", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
                    <PrimaryBtn onClick={sendReport}>{s.reportSend}</PrimaryBtn>
                    <GhostBtn onClick={() => { setReportingPost(null); setReason(""); }}>{(STRINGS[lang] || STRINGS.en).create.cancel}</GhostBtn>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => { setReportingPost(p.id); setReportingGroup(false); setReason(""); }} style={{ minHeight: A11Y.minTapTargetPx, background: "none", border: "none", color: C.textMuted, fontSize: ts(16), fontFamily: "inherit", textDecoration: "underline", cursor: "pointer" }}>
                  {s.reportPost}
                </button>
              )}
            </Card>
          ))}
        </>
      )}

      {tab === "chat" && (
        <Card>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14, maxHeight: 380, overflowY: "auto" }}>
            {messages.length === 0 ? <BodyText muted>{s.chatEmpty}</BodyText> : messages.map((m) => (
              <div key={m.id} style={{ background: m.sender_id === myId ? "#e8f0e6" : C.cream, borderRadius: 14, padding: "10px 14px", alignSelf: m.sender_id === myId ? "flex-end" : "flex-start", maxWidth: "85%" }}>
                <div style={{ fontSize: ts(15), color: C.textMuted, fontWeight: 600 }}>{m.sender_id === myId ? s.you : m.senderName} · {clock(m.created_at)}</div>
                {parseStickerRef(m.body) ? (
                  <Sticker id={parseStickerRef(m.body)} size={96} />
                ) : (
                  <div style={{ fontSize: ts(A11Y.minBodyPx), color: C.textMain, whiteSpace: "pre-wrap" }}>{m.body}</div>
                )}
              </div>
            ))}
          </div>
          {stickersOpen && (
            <div style={{ marginBottom: 10 }}>
              <StickerPicker label={s.stickers} onPick={sendSticker} />
            </div>
          )}
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
            <GhostBtn
              aria-expanded={stickersOpen}
              aria-label={s.stickers}
              onClick={() => setStickersOpen((o) => !o)}
              style={{ paddingInline: 12 }}
            >
              🌸
            </GhostBtn>
            <textarea value={chatDraft} onChange={(e) => setChatDraft(e.target.value)} placeholder={s.chatPh} rows={2} maxLength={2000} style={{ resize: "vertical" }} />
            <GhostBtn onClick={chat} disabled={!chatDraft.trim()} style={{ borderColor: C.green, color: C.green }}>{s.send}</GhostBtn>
          </div>
        </Card>
      )}

      {tab === "members" && (
        <>
          <SectionLabel>{s.membersLabel}</SectionLabel>
          {members.map((m) => (
            <Card key={m.member_id} style={{ padding: "14px 18px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ flex: "1 1 160px", fontWeight: 600, fontSize: ts(A11Y.minBodyPx) }}>
                  {m.person?.full_name || "A member"}
                  {m.member_id === myId && <span style={{ color: C.textMuted }}> ({s.you})</span>}
                </span>
                {m.role === "creator" && <Pill tone="brown">{s.creatorTag}</Pill>}
                {iAmCreator && m.member_id !== myId && (
                  <GhostBtn aria-label={s.removeLabel(m.person?.full_name || "")} onClick={() => kick(m)} style={{ color: C.error, borderColor: C.error }}>{s.remove}</GhostBtn>
                )}
              </div>
            </Card>
          ))}

          {/* Invite */}
          {!invitePanel ? (
            <GhostBtn onClick={openInvite} style={{ borderColor: C.green, color: C.green, marginTop: 6 }}>+ {s.invite}</GhostBtn>
          ) : (
            <Card>
              <p style={{ fontWeight: 700, fontSize: ts(20), color: C.brown, margin: "0 0 4px" }}>{s.inviteTitle}</p>
              <BodyText muted>{s.inviteHint}</BodyText>
              {connections === null ? <BodyText muted role="status">···</BodyText>
                : connections.length === 0 ? <BodyText muted>{s.noConnections}</BodyText>
                : connections.map((c) => (
                  <div key={c.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "8px 0", borderTop: `1px solid ${C.warmGray}` }}>
                    <span style={{ fontSize: ts(A11Y.minBodyPx) }}>{c.full_name}{c.city ? <span style={{ color: C.textMuted }}> · {c.city}</span> : null}</span>
                    <GhostBtn onClick={() => invite(c)}>{s.invite}</GhostBtn>
                  </div>
                ))}
              <div style={{ marginTop: 12 }}><GhostBtn onClick={() => setInvitePanel(false)}>{(STRINGS[lang] || STRINGS.en).create.cancel}</GhostBtn></div>
            </Card>
          )}

          {/* Report group + leave */}
          <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 12 }}>
            {reportingGroup ? (
              <Card>
                <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={s.reportReasonPh} />
                <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                  <PrimaryBtn onClick={sendReport}>{s.reportSend}</PrimaryBtn>
                  <GhostBtn onClick={() => { setReportingGroup(false); setReason(""); }}>{(STRINGS[lang] || STRINGS.en).create.cancel}</GhostBtn>
                </div>
              </Card>
            ) : (
              <button type="button" onClick={() => { setReportingGroup(true); setReportingPost(null); setReason(""); }} style={{ minHeight: A11Y.minTapTargetPx, background: "none", border: "none", color: C.textMuted, fontSize: ts(16), fontFamily: "inherit", textDecoration: "underline", cursor: "pointer", alignSelf: "flex-start" }}>
                {s.reportGroup}
              </button>
            )}

            {confirmLeave && iAmCreator ? (
              <Card style={{ background: C.cream }}>
                <BodyText>{/* creator leaving closes the group */}⚠ {group.name}: leaving closes this group for everyone.</BodyText>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <PrimaryBtn onClick={doLeave} style={{ background: C.error }}>{s.leave}</PrimaryBtn>
                  <GhostBtn onClick={() => setConfirmLeave(false)}>{(STRINGS[lang] || STRINGS.en).create.cancel}</GhostBtn>
                </div>
              </Card>
            ) : (
              <GhostBtn onClick={() => (iAmCreator ? setConfirmLeave(true) : doLeave())} style={{ color: C.error, borderColor: C.error, alignSelf: "flex-start" }}>
                {s.leave}
              </GhostBtn>
            )}
          </div>
        </>
      )}
    </Screen>
  );
}
