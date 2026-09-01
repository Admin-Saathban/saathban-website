/* ════════════════════════════════════════════════
   Groups home — my groups, my pending invitations (one-tap accept),
   and a door to start one (Icons only; the RPC enforces it too).
   ════════════════════════════════════════════════ */

import { useEffect, useRef, useState } from "react";
import Icon from "../../components/Icon.jsx";
import { Link, useNavigate } from "react-router-dom";
import { APP_COLORS as C, A11Y, MEANING } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { MotionStyles } from "../../lib/motion.jsx";
import { useSession } from "../../lib/session.jsx";
import { ROLE_DISPLAY } from "../../constants/roles.js";
import { Screen, H1, Card, BodyText, SectionLabel, PrimaryBtn, GhostBtn } from "./ui.jsx";
import { STRINGS } from "./groupsCopy.js";
import { fetchMyGroups, fetchMyGroupInvites, respondInvite, cachedGroups, archivedGroups, setGroupPref } from "./groupsStore.js";
import { useToast, useToastThenGo, useFresh } from "../../lib/feedback.jsx";

const SCROLL_KEY = "saathban.groups.scroll";

export default function GroupsList() {
  const { lang, ts, meta, t } = useI18n();
  const s = (STRINGS[lang] || STRINGS.en).list;
  const { profile } = useSession();
  const navigate = useNavigate();

  /* SEEDED FROM THE LAST VISIT, not from null. Remounting with null is
     what made returning from a group look like landing on "Create a
     group": no rows for ~600ms, and the create button is the only thing
     under the heading. The fetch below still runs and still wins; this
     only decides what is on screen while it does. */
  const [groups, setGroups] = useState(() => cachedGroups());
  const [invites, setInvites] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(null);
  const [sheetFor, setSheetFor] = useState(null);   // the group whose ⋯ sheet is open
  const [showArchived, setShowArchived] = useState(false);
  const pressTimer = useRef(null);
  const { toast } = useToast();
  const toastThenGo = useToastThenGo();
  const fresh = useFresh();

  const load = async () => {
    try {
      const [g, i] = await Promise.all([fetchMyGroups(), fetchMyGroupInvites()]);
      setGroups(g);
      setInvites(i);
      setError("");
    } catch {
      setError(s.loadError);
      setGroups([]);
    }
  };
  /* SCROLL COMES BACK TOO. Measured before the fix: 246 going in, 0 on
     return. Kept in module scope for the same reason as the rows — the
     component that knew it has been destroyed by the time it matters.
     Restored only once rows exist, or there is nothing to scroll to. */
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current || !groups || !groups.length) return;
    restored.current = true;
    const y = Number(sessionStorage.getItem(SCROLL_KEY) || 0);
    if (y > 0) window.scrollTo(0, y);
  }, [groups]);

  /* SAVED WHEN THE PERSON LEAVES, not on every scroll event.

     A scroll listener looked right and stored 0. Clicking a row starts a
     navigation, and the browser fires a scroll reset to 0 BEFORE the
     component unmounts — so the listener faithfully recorded that reset
     over the position the person actually left at. Measured: 246 on
     screen, "0" in storage.

     The moment of leaving is unambiguous and is the only moment worth
     recording, so the row records it. */
  const rememberScroll = () => {
    try { sessionStorage.setItem(SCROLL_KEY, String(window.scrollY)); } catch { /* fine */ }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const answer = async (invite, accept) => {
    if (busy) return; // double-tap guard: one answer per invitation
    setBusy(invite.id);
    try {
      const gid = await respondInvite(invite.id, accept);
      if (accept) {
        // Say it, then travel — the line survives the route change.
        toastThenGo(t("feedback.groupJoined", { name: invite.groupName }), `/app/groups/${gid}`);
      } else {
        await load();
        toast(t("feedback.requestDeclined"), { tone: "info" });
      }
    } catch {
      setError(s.loadError);
      toast(t("feedback.somethingWrong"), { tone: "error" });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen>
      <H1>{s.title}</H1>
      <BodyText muted>{s.intro}</BodyText>

      {error && <BodyText role="alert" style={{ color: C.error, fontWeight: 600 }}>{error}</BodyText>}

      {invites.length > 0 && (
        <>
          <SectionLabel>{s.invitesLabel}</SectionLabel>
          {invites.map((inv) => (
            <Card key={inv.id} style={{ background: C.cream, border: `1px dashed ${C.olive}` }}>
              <BodyText>{s.inviteLine(inv.inviterName, inv.groupName)}</BodyText>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <PrimaryBtn disabled={busy === inv.id} onClick={() => answer(inv, true)}>{s.accept}</PrimaryBtn>
                <GhostBtn disabled={busy === inv.id} onClick={() => answer(inv, false)}>{s.decline}</GhostBtn>
              </div>
            </Card>
          ))}
        </>
      )}

      {groups === null ? (
        <BodyText muted role="status">···</BodyText>
      ) : groups.length === 0 ? (
        <Card>
          <BodyText muted>
            {profile?.role === "saath_icon" ? s.empty : s.emptyOther(ROLE_DISPLAY.saath_icon)}
          </BodyText>
        </Card>
      ) : (
        groups.map((g) => (
          <Card
            key={g.id}
            {...fresh.props(g.id)}
            /* LONG PRESS opens the same sheet as the ⋯ button. Both are
               here because neither alone is enough: a dotted button is
               invisible to somebody who has never been taught it, and a
               long press is invisible to everybody. */
            onPointerDown={() => { pressTimer.current = setTimeout(() => setSheetFor(g), 550); }}
            onPointerUp={() => clearTimeout(pressTimer.current)}
            onPointerLeave={() => clearTimeout(pressTimer.current)}
            onContextMenu={(e) => { e.preventDefault(); setSheetFor(g); }}
          >
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <Link to={`/app/groups/${g.id}`} onClick={rememberScroll} style={{ textDecoration: "none", flex: 1, minWidth: 0 }}>
                <h2 style={{ fontFamily: meta.fonts.heading, fontSize: ts(23), fontWeight: 700, color: C.green, margin: 0 }}>
                  {g.name}
                  {g.pinned && (
                    <Icon name="pinned" size={17} style={{ display: "inline", verticalAlign: "-2px", marginInlineStart: 8, color: C.textMuted }} />
                  )}
                  {g.muted && (
                    <Icon name="sound" size={17} style={{ display: "inline", verticalAlign: "-2px", marginInlineStart: 6, color: C.textMuted, opacity: 0.55 }} />
                  )}
                </h2>
              </Link>
              {g.unread > 0 && (
                /* A count, not just a dot: "3 new messages" is a
                   different decision from "something happened". Never
                   colour alone — the number is the second signal and
                   the line below is the third. */
                <span style={{
                  minWidth: 26, padding: "2px 9px", borderRadius: 999,
                  background: MEANING.danger, color: C.white,
                  fontSize: ts(15), fontWeight: 800, textAlign: "center",
                }}>{g.unread}</span>
              )}
              <button
                type="button"
                aria-label={s.rowMenu}
                onClick={(e) => { e.preventDefault(); setSheetFor(g); }}
                style={{
                  minWidth: A11Y.minTapTargetPx, minHeight: A11Y.minTapTargetPx,
                  border: "none", background: "transparent", color: C.textMuted,
                  cursor: "pointer", borderRadius: 10, fontSize: ts(20),
                }}
              >⋯</button>
            </div>
            {g.unread > 0 && (
              <BodyText style={{ margin: "4px 0 0", fontWeight: 600, color: C.textMain }}>
                {g.unreadWho
                  ? s.newFrom.replace("{name}", g.unreadWho.split(" ")[0])
                  : s.newCount.replace("{n}", String(g.unread))}
              </BodyText>
            )}
            {g.description && <BodyText muted style={{ margin: "6px 0 12px" }}>{g.description}</BodyText>}
            {/* Ownership, said once and quietly, below everything that
                matters more: the name, what is new, and the
                description. Smaller than body text and muted, so it
                reads as a footnote rather than a badge. */}
            {g.isCreator && (
              <BodyText muted style={{ margin: "0 0 12px", fontSize: ts(15) }}>
                {s.creatorNote}
              </BodyText>
            )}
            <Link to={`/app/groups/${g.id}`} style={{ display: "inline-flex", alignItems: "center", minHeight: 48, padding: "0 22px", borderRadius: 50, border: `2px solid ${C.green}`, color: C.green, background: C.white, fontSize: ts(18), fontWeight: 600, textDecoration: "none" }}>
              {s.openCta}
            </Link>
          </Card>
        ))
      )}

      {profile?.role === "saath_icon" ? (
        <div style={{ marginTop: 12 }}>
          <PrimaryBtn onClick={() => navigate("/app/groups/new")}>✨ {s.createCta}</PrimaryBtn>
        </div>
      ) : (
        groups?.length > 0 && (
          <BodyText muted style={{ marginTop: 12 }}>
            {s.startIconOnly(ROLE_DISPLAY.saath_icon)}
          </BodyText>
        )
      )}
      {/* ARCHIVED — hidden from the list, never from the person. A group
          put away is still joined, still readable, and one tap from
          coming back. Archiving is not leaving. */}
      {archivedGroups().length > 0 && (
        <div style={{ marginTop: 22 }}>
          <GhostBtn onClick={() => setShowArchived((v) => !v)} style={{ width: "100%" }}>
            {s.archivedSection.replace("{n}", String(archivedGroups().length))}
          </GhostBtn>
          {showArchived && archivedGroups().map((g) => (
            <Card key={g.id} style={{ marginTop: 10, opacity: 0.85 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <Link to={`/app/groups/${g.id}`} onClick={rememberScroll} style={{ textDecoration: "none", flex: 1, minWidth: 0 }}>
                  <h2 style={{ fontFamily: meta.fonts.heading, fontSize: ts(20), fontWeight: 700, color: C.green, margin: 0 }}>{g.name}</h2>
                </Link>
                <GhostBtn onClick={async () => { await setGroupPref(g.id, "archived", false); load(); }}>
                  {s.unarchive}
                </GhostBtn>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* One sheet, reached two ways (⋯ and long press). Every switch is
          reversible and every one is only about this person: muting a
          group does not quieten it for anybody else, and archiving it
          does not remove it from anybody else's list. */}
      {sheetFor && (
        <div
          className="sb-dim"
          onClick={() => setSheetFor(null)}
          style={{ position: "fixed", inset: 0, zIndex: 90, background: "rgba(0,0,0,0.38)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}
        >
          <MotionStyles />
          <div
            className="sb-sheet"
            role="dialog"
            aria-modal="true"
            aria-label={sheetFor.name}
            onClick={(e) => e.stopPropagation()}
            style={{ width: "100%", maxWidth: 640, background: C.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: "18px 16px 24px" }}
          >
            <h2 style={{ fontSize: ts(21), fontWeight: 800, color: C.textMain, margin: "0 0 12px" }}>{sheetFor.name}</h2>
            {[
              ["muted", sheetFor.muted ? s.unmute : s.mute],
              ["pinned", sheetFor.pinned ? s.unpin : s.pin],
              ["archived", s.archive],
            ].map(([key, label]) => (
              <PrimaryBtn
                key={key}
                onClick={async () => {
                  const on = key === "archived" ? true : !sheetFor[key];
                  setSheetFor(null);
                  await setGroupPref(sheetFor.id, key, on);
                  load();
                }}
                style={{ width: "100%", marginBottom: 10, background: C.white, color: C.textMain, border: `1px solid ${C.warmGray}` }}
              >
                {label}
              </PrimaryBtn>
            ))}
            <GhostBtn onClick={() => setSheetFor(null)} style={{ width: "100%" }}>{s.sheetClose}</GhostBtn>
          </div>
        </div>
      )}
    </Screen>
  );
}
