/* ════════════════════════════════════════════════
   Groups home — my groups, my pending invitations (one-tap accept),
   and a door to start one (Icons only; the RPC enforces it too).
   ════════════════════════════════════════════════ */

import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { APP_COLORS as C } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { useSession } from "../../lib/session.jsx";
import { ROLE_DISPLAY } from "../../constants/roles.js";
import { Screen, H1, Card, BodyText, SectionLabel, Pill, PrimaryBtn, GhostBtn } from "./ui.jsx";
import { STRINGS } from "./groupsCopy.js";
import { fetchMyGroups, fetchMyGroupInvites, respondInvite, cachedGroups } from "./groupsStore.js";
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
          <Card key={g.id} {...fresh.props(g.id)}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <Link to={`/app/groups/${g.id}`} onClick={rememberScroll} style={{ textDecoration: "none" }}>
                <h2 style={{ fontFamily: meta.fonts.heading, fontSize: ts(23), fontWeight: 700, color: C.green, margin: 0 }}>{g.name}</h2>
              </Link>
              {g.isCreator && <Pill tone="brown">{s.creatorBadge}</Pill>}
            </div>
            {g.description && <BodyText muted style={{ margin: "6px 0 12px" }}>{g.description}</BodyText>}
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
    </Screen>
  );
}
