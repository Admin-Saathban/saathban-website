/* ════════════════════════════════════════════════
   Groups home — my groups, my pending invitations (one-tap accept),
   and a door to start one (Icons only; the RPC enforces it too).
   ════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { APP_COLORS as C } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { useSession } from "../../lib/session.jsx";
import { ROLE_DISPLAY } from "../../constants/roles.js";
import { Screen, H1, Card, BodyText, SectionLabel, Pill, PrimaryBtn, GhostBtn } from "./ui.jsx";
import { STRINGS } from "./groupsCopy.js";
import { fetchMyGroups, fetchMyGroupInvites, respondInvite } from "./groupsStore.js";
import { useToast, useToastThenGo, useFresh } from "../../lib/feedback.jsx";

export default function GroupsList() {
  const { lang, ts, meta, t } = useI18n();
  const s = (STRINGS[lang] || STRINGS.en).list;
  const { profile } = useSession();
  const navigate = useNavigate();

  const [groups, setGroups] = useState(null);
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
              <Link to={`/app/groups/${g.id}`} style={{ textDecoration: "none" }}>
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
