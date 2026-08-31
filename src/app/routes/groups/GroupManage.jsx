/* ════════════════════════════════════════════════
   Managing a group — GROUPS_SPEC §7.

   Reached from the group's own three dots. "MEMBERS SEE NONE OF IT."
   So this screen refuses at the top rather than hiding its buttons: a
   member who reaches the URL is told plainly it is not theirs, not
   shown an empty version of it.

   The six sections, in §7's order:
     1. Member requests   approve or decline
     2. People            the member list, with remove
     3. Co-admins         promote a member, demote a co-admin
     4. Group settings    name, description, privacy
     5. Reported content  reports raised inside this group
     6. Help centre       a box that says WHO reads it and WHEN

   ── On item 6, which is where most apps lie ──

   §7: the placeholder "must say who receives it and roughly when.
   'We'll get back to you soon' with no name is what every dead form
   says." So it names the Saathban team and states a real window, and
   if we cannot honour that window the fix is to change the number
   here, not to soften it into "soon".

   ── On items 1 and 3 being different powers ──

   Approving members and appointing co-admins are not the same job.
   Any admin (creator, co-admin, or platform admin — 0068) can approve
   a member. Only the OWNER can promote or demote a co-admin, and only
   the owner can delete the group or hand it over (§7.3). The screen
   shows the co-admin controls to the owner alone, and the database
   refuses everyone else regardless of what the screen shows.
   ════════════════════════════════════════════════ */

import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { APP_COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { useSession } from "../../lib/session.jsx";
import { Screen, H1, Card, BodyText, SectionLabel, Pill, PrimaryBtn, GhostBtn } from "./ui.jsx";
import {
  fetchGroup, fetchMembers, amIGroupAdmin,
  fetchJoinRequests, respondJoinRequest,
  setCoAdmin, removeMember, updateGroup, fetchGroupReports,
  deleteGroup, transferGroupOwnership, setGroupCover, uploadGroupCover,
} from "./groupsStore.js";
import ReportedMedia from "../admin/ReportedMedia.jsx";
import GroupCover, { COVER_PRESETS, coverMark } from "./GroupCover.jsx";
import Icon from "../../components/Icon.jsx";

export default function GroupManage() {
  const { id } = useParams();
  const { t, ts, meta } = useI18n();
  const { profile } = useSession();
  const navigate = useNavigate();
  const myId = profile?.id;

  const [group, setGroup] = useState(undefined);
  const [isAdmin, setIsAdmin] = useState(null); // null = still asking
  const [members, setMembers] = useState([]);
  const [requests, setRequests] = useState([]);
  const [reports, setReports] = useState([]);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [privacy, setPrivacy] = useState("invite_only");
  const [saved, setSaved] = useState(false);
  const [help, setHelp] = useState("");
  const [helpSent, setHelpSent] = useState(false);
  /* §7.3 is the one destructive control in this screen, so it is the
     one place a confirm step is warranted — everything else here is
     reversible. */
  const [closeGroup, setCloseGroup] = useState(false);
  const [handOver, setHandOver] = useState(false);

  const iAmOwner = group && group.created_by === myId;

  const load = useCallback(async () => {
    try {
      const g = await fetchGroup(id);
      if (!g) { setGroup(null); return; }
      setGroup(g);
      setName(g.name || "");
      setDescription(g.description || "");
      setPrivacy(g.privacy || "invite_only");

      const admin = await amIGroupAdmin(id);
      setIsAdmin(admin);
      if (!admin) return;

      setMembers(await fetchMembers(id).catch(() => []));
      /* Lane 2's table (0086). If their migration is not in the
         environment this screen is running against, the section is
         simply absent rather than an error — the other five sections
         are not held hostage by it. */
      setRequests(await fetchJoinRequests(id).catch(() => []));
      setReports(await fetchGroupReports(id).catch(() => []));
    } catch (e) {
      setError(String(e?.message || e));
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const act = async (fn, key) => {
    if (busy) return;
    setBusy(key);
    setError("");
    try { await fn(); await load(); }
    catch (e) { setError(String(e?.message || e)); }
    setBusy(null);
  };

  if (group === undefined || isAdmin === null) {
    return <Screen backTo={`/app/groups/${id}`}><BodyText muted role="status">…</BodyText></Screen>;
  }
  if (group === null) {
    return <Screen backTo="/app/groups"><Card><BodyText>{t("groups.manage.gone")}</BodyText></Card></Screen>;
  }
  /* §7: "Members see none of it." Said, not hidden. */
  if (!isAdmin) {
    return (
      <Screen backTo={`/app/groups/${id}`}>
        <Card>
          <BodyText style={{ margin: 0 }}>{t("groups.manage.notYours")}</BodyText>
        </Card>
      </Screen>
    );
  }

  const row = {
    display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
    padding: "10px 0", borderBottom: `1px solid ${C.warmGray}`,
  };

  return (
    <Screen backTo={`/app/groups/${id}`} backLabel={group.name}>
      <H1>{t("groups.manage.title")}</H1>

      {error && <BodyText role="alert" style={{ color: C.error, fontWeight: 700 }}>{error}</BodyText>}

      {/* ── 1. Member requests ── */}
      <SectionLabel>{t("groups.manage.requests")}</SectionLabel>
      <Card>
        {requests.length === 0 ? (
          <BodyText muted style={{ margin: 0 }}>{t("groups.manage.noRequests")}</BodyText>
        ) : (
          requests.map((r) => (
            <div key={r.id} style={row}>
              <span style={{ flex: "1 1 160px", minWidth: 0 }}>
                <span style={{ display: "block", fontSize: ts(A11Y.minBodyPx), fontWeight: 700 }}>
                  {r.person?.full_name || t("groups.manage.someone")}
                </span>
                {r.message && (
                  <span style={{ display: "block", fontSize: ts(16), color: C.textMuted }}>{r.message}</span>
                )}
              </span>
              <PrimaryBtn
                disabled={busy === r.id}
                onClick={() => act(() => respondJoinRequest(r.id, true), r.id)}
              >
                {t("groups.manage.approve")}
              </PrimaryBtn>
              <GhostBtn
                disabled={busy === r.id}
                onClick={() => act(() => respondJoinRequest(r.id, false), r.id)}
              >
                {t("groups.manage.decline")}
              </GhostBtn>
            </div>
          ))
        )}
      </Card>

      {/* ── 2 & 3. People, and who helps run it ── */}
      <SectionLabel>{t("groups.manage.people")}</SectionLabel>
      <Card>
        {members.map((m) => {
          const isOwner = m.member_id === group.created_by;
          const isCo = m.role === "co_admin";
          return (
            <div key={m.member_id} style={row}>
              <span style={{ flex: "1 1 150px", minWidth: 0, fontSize: ts(A11Y.minBodyPx), fontWeight: 600 }}>
                {m.person?.full_name || t("groups.manage.someone")}
              </span>
              {isOwner && <Pill tone="brown">{t("groups.manage.owner")}</Pill>}
              {isCo && <Pill tone="green">{t("groups.manage.coAdmin")}</Pill>}

              {/* §7.3 — only the owner changes who runs the group. The
                  database refuses anyone else too (set_group_co_admin
                  checks is_group_creator), so this is the polite half
                  of a rule that is enforced properly. */}
              {iAmOwner && !isOwner && (
                <GhostBtn
                  disabled={busy === m.member_id}
                  onClick={() => act(() => setCoAdmin(id, m.member_id, !isCo), m.member_id)}
                >
                  {isCo ? t("groups.manage.demote") : t("groups.manage.promote")}
                </GhostBtn>
              )}
              {!isOwner && (
                <GhostBtn
                  disabled={busy === m.member_id}
                  onClick={() => act(() => removeMember(id, m.member_id), m.member_id)}
                >
                  {t("groups.manage.remove")}
                </GhostBtn>
              )}
            </div>
          );
        })}
      </Card>

      {/* ── 4. Group settings ── */}
      <SectionLabel>{t("groups.manage.settings")}</SectionLabel>
      <Card>
        {/* §1: the type already gave this group a cover, so this is
            never an empty slot demanding a photograph — it is a
            choice between covers that already work. The upload is
            offered second, for people who want their own. */}
        <label style={{ display: "block", fontSize: ts(16), fontWeight: 700, marginBottom: 6 }}>
          {t("groups.cover.title")}
        </label>
        <GroupCover group={group} height={96} />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
          {COVER_PRESETS.map((k) => (
            <button
              key={k}
              type="button"
              disabled={busy === "cover"}
              onClick={() => act(() => setGroupCover(id, `preset:${k}`), "cover")}
              aria-label={t(`groups.type.${k}.name`)}
              style={{
                width: 52, height: 40, borderRadius: 10, cursor: "pointer",
                border: group.cover === `preset:${k}` ? `3px solid ${C.green}` : `2px solid ${C.warmGray}`,
                background: "none", padding: 0,
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                color: C.textMain,
              }}
            >
              <Icon name={coverMark(k)} size={20} />
            </button>
          ))}
        </div>
        <label
          style={{
            display: "inline-flex", alignItems: "center", minHeight: A11Y.minTapTargetPx,
            color: C.green, fontSize: ts(16), fontWeight: 600,
            textDecoration: "underline", cursor: "pointer", marginBottom: 16,
          }}
        >
          {t("groups.cover.upload")}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) act(() => uploadGroupCover(id, f), "cover");
              e.target.value = "";
            }}
          />
        </label>

        <label style={{ display: "block", fontSize: ts(16), fontWeight: 700, marginBottom: 6 }}>
          {t("groups.new.nameTitle")}
        </label>
        <input
          value={name}
          onChange={(e) => { setName(e.target.value); setSaved(false); }}
          maxLength={80}
          dir={meta.dir}
          style={{ width: "100%", minHeight: A11Y.minTapTargetPx, fontSize: ts(A11Y.minBodyPx), marginBottom: 14 }}
        />
        <label style={{ display: "block", fontSize: ts(16), fontWeight: 700, marginBottom: 6 }}>
          {t("groups.manage.description")}
        </label>
        <textarea
          value={description}
          onChange={(e) => { setDescription(e.target.value); setSaved(false); }}
          rows={3}
          dir={meta.dir}
          style={{
            width: "100%", fontFamily: "inherit", fontSize: ts(A11Y.minBodyPx),
            padding: 10, borderRadius: 12, border: `2px solid ${C.warmGray}`, marginBottom: 14,
          }}
        />

        {/* Privacy, worded as consequences here too — the same two
            sentences as §1 screen 3, because changing it later is the
            same decision as making it. */}
        <label style={{ display: "block", fontSize: ts(16), fontWeight: 700, marginBottom: 6 }}>
          {t("groups.new.privacyTitle")}
        </label>
        {[
          ["anyone", "groups.new.anyoneName", "groups.new.anyoneWhat"],
          ["invite_only", "groups.new.inviteName", "groups.new.inviteWhat"],
        ].map(([key, nameKey, whatKey]) => (
          <button
            key={key}
            type="button"
            onClick={() => { setPrivacy(key); setSaved(false); }}
            aria-pressed={privacy === key}
            style={{
              display: "block", width: "100%", textAlign: "start", marginBottom: 10,
              padding: "12px 14px", borderRadius: 14, minHeight: A11Y.minTapTargetPx,
              border: privacy === key ? `3px solid ${C.green}` : `2px solid ${C.warmGray}`,
              background: privacy === key ? "#EEF3E8" : C.white,
              fontFamily: "inherit", cursor: "pointer",
            }}
          >
            <span style={{ display: "block", fontSize: ts(A11Y.minBodyPx), fontWeight: 700, color: C.textMain }}>
              {t(nameKey)}
            </span>
            <span style={{ display: "block", fontSize: ts(16), color: C.textMuted }}>{t(whatKey)}</span>
          </button>
        ))}

        <PrimaryBtn
          disabled={busy === "save" || !name.trim()}
          onClick={() =>
            act(async () => {
              await updateGroup(id, {
                name: name.trim(),
                description: description.trim() || null,
                privacy,
              });
              setSaved(true);
            }, "save")
          }
        >
          {t("groups.manage.save")}
        </PrimaryBtn>
        {saved && (
          <BodyText muted style={{ margin: "10px 0 0" }}>{t("groups.manage.saved")}</BodyText>
        )}
      </Card>

      {/* ── 5. Reported content ── */}
      <SectionLabel>{t("groups.manage.reported")}</SectionLabel>
      <Card>
        {reports.length === 0 ? (
          <BodyText muted style={{ margin: 0 }}>{t("groups.manage.noReports")}</BodyText>
        ) : (
          reports.map((r) => (
            <div key={r.id} style={{ ...row, alignItems: "flex-start" }}>
              <span style={{ flex: 1, minWidth: 0, fontSize: ts(16) }}>
                {r.target_excerpt || r.target_kind}
                {r.reason ? ` — ${r.reason}` : ""}
                {/* A reported voice note is otherwise a silent row with
                    nothing to judge. Only post-audio is offered here:
                    report-evidence holds copies of reported DM audio and
                    is admins-only (0078), and a group admin is not
                    necessarily a platform admin — rendering a player
                    that cannot sign its own URL would be a control that
                    fails in the hand. A DM has no business on a
                    group-scoped screen in any case. */}
                {r.target_media_path && r.target_media_bucket === "post-audio" && (
                  <ReportedMedia
                    bucket={r.target_media_bucket}
                    path={r.target_media_path}
                    kind={r.target_media_kind}
                  />
                )}
              </span>
              <Pill tone={r.status === "open" ? "brown" : "green"}>{r.status}</Pill>
            </div>
          ))
        )}
      </Card>

      {/* ── 6. Help centre ── */}
      <SectionLabel>{t("groups.manage.help")}</SectionLabel>
      <Card>
        {/* §7: it must say WHO receives it and roughly WHEN. */}
        <BodyText muted style={{ marginTop: 0 }}>{t("groups.manage.helpWho")}</BodyText>
        {helpSent ? (
          <BodyText style={{ fontWeight: 700, margin: 0 }}>{t("groups.manage.helpSent")}</BodyText>
        ) : (
          <>
            <textarea
              value={help}
              onChange={(e) => setHelp(e.target.value)}
              rows={3}
              dir={meta.dir}
              placeholder={t("groups.manage.helpPlaceholder")}
              style={{
                width: "100%", fontFamily: "inherit", fontSize: ts(A11Y.minBodyPx),
                padding: 10, borderRadius: 12, border: `2px solid ${C.warmGray}`, marginBottom: 10,
              }}
            />
            <PrimaryBtn
              disabled={!help.trim() || busy === "help"}
              onClick={() =>
                act(async () => {
                  const { reportTarget } = await import("./groupsStore.js");
                  await reportTarget({
                    kind: "group",
                    targetId: id,
                    authorId: null,
                    excerpt: group.name,
                    reason: help.trim(),
                  });
                  setHelp("");
                  setHelpSent(true);
                }, "help")
              }
            >
              {t("groups.manage.helpSend")}
            </PrimaryBtn>
          </>
        )}
      </Card>

      {/* ── §7.3 — owner only ──
          "The OWNER is the only one who can delete the group or hand
           ownership over." A co-admin helps run it; they do not get
           to end it, and the database refuses them too (0069 uses
           is_group_creator, deliberately NOT is_group_admin).

          Placed last on purpose: somebody scrolling to the help box
          should not pass "close this group" to reach it. */}
      {iAmOwner && (
        <>
          <SectionLabel>{t("groups.manage.ownerOnly")}</SectionLabel>
          <Card>
            {/* Handing over: only to somebody already in the group,
                since making a stranger responsible for a room they
                have never been in is not a hand-over. */}
            {handOver ? (
              <>
                <BodyText style={{ marginTop: 0 }}>{t("groups.manage.handOverWho")}</BodyText>
                {members.filter((m) => m.member_id !== myId).length === 0 ? (
                  <BodyText muted style={{ margin: 0 }}>{t("groups.manage.handOverNobody")}</BodyText>
                ) : (
                  members.filter((m) => m.member_id !== myId).map((m) => (
                    <GhostBtn
                      key={m.member_id}
                      disabled={busy === m.member_id}
                      onClick={() =>
                        act(async () => {
                          await transferGroupOwnership(id, m.member_id);
                          setHandOver(false);
                        }, m.member_id)
                      }
                      style={{ display: "block", marginBottom: 8 }}
                    >
                      {m.person?.full_name || t("groups.manage.someone")}
                    </GhostBtn>
                  ))
                )}
                <GhostBtn onClick={() => setHandOver(false)}>{t("groups.manage.notNow")}</GhostBtn>
              </>
            ) : (
              <GhostBtn onClick={() => setHandOver(true)}>{t("groups.manage.handOver")}</GhostBtn>
            )}

            <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${C.warmGray}` }}>
              {closeGroup ? (
                <>
                  {/* Says what actually happens, and to whom. "Are you
                      sure?" tells a person nothing about what they are
                      about to lose. */}
                  <BodyText style={{ marginTop: 0, fontWeight: 700 }}>
                    {t("groups.manage.closeSure", { name: group.name, n: members.length })}
                  </BodyText>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <PrimaryBtn
                      disabled={busy === "close"}
                      onClick={() =>
                        act(async () => {
                          await deleteGroup(id);
                          navigate("/app/groups", { replace: true });
                        }, "close")
                      }
                      style={{ background: C.error, borderColor: C.error }}
                    >
                      {t("groups.manage.closeConfirm")}
                    </PrimaryBtn>
                    <GhostBtn onClick={() => setCloseGroup(false)}>{t("groups.manage.notNow")}</GhostBtn>
                  </div>
                </>
              ) : (
                <GhostBtn
                  onClick={() => setCloseGroup(true)}
                  style={{ color: C.error, borderColor: C.error }}
                >
                  {t("groups.manage.close")}
                </GhostBtn>
              )}
            </div>
          </Card>
        </>
      )}
    </Screen>
  );
}
