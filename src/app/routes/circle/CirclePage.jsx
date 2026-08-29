/* ════════════════════════════════════════════════
   My Circle — the Icon-facing screen (SPEC.md, My Circle).

   Real data via useCircle(iconId): members with per-member permission
   toggles (all default OFF), one-tap removal (no confirmation maze),
   SOS designation with ordering, incoming join-request approval (one
   tap), and an empty state written as a door, never a scoreboard.

   The grant is the Icon's alone — nothing here is on by default, and
   turning a permission off is always one tap away.
   ════════════════════════════════════════════════ */

import { useState } from "react";
import { COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { useSession } from "../../lib/session.jsx";
import { useCircle } from "./circleStore.js";
import { COPY } from "./copy.js";
import {
  Card,
  SectionLabel,
  BodyText,
  Pill,
  PrimaryBtn,
  GhostBtn,
  Toggle,
  Segmented,
} from "./ui.jsx";

function personName(person, fallback) {
  return person?.full_name || fallback || "A member";
}

function MemberCard({ m, sosCount, busy, actions }) {
  const { ts, meta } = useI18n();
  const name = personName(m.person);
  const c = COPY.member;

  return (
    <Card>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 10 }}>
        <h3 style={{ fontFamily: meta.fonts.heading, fontSize: ts(23), fontWeight: 700, color: C.green, margin: 0 }}>
          {name}
        </h3>
        {m.person?.city && <BodyText muted style={{ margin: 0 }}>{m.person.city}</BodyText>}
        {m.is_sos_contact && (
          <Pill tone="brown">🆘 {COPY.member.sosOrder(m.sos_order)}</Pill>
        )}
      </div>

      <SectionLabel>{c.permissionsLabel}</SectionLabel>

      {/* SOS — a permission plus, when on, ordering among SOS contacts */}
      <Toggle
        checked={m.is_sos_contact}
        busy={busy}
        onChange={() => actions.toggleSos(m.id)}
        label={COPY.perms.sos.label}
        hint={COPY.perms.sos.hint}
      />
      {m.is_sos_contact && sosCount > 1 && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", margin: "2px 0 6px" }}>
          <span style={{ fontSize: ts(16), color: C.textMuted }}>{COPY.member.sosOrder(m.sos_order)}</span>
          <GhostBtn
            aria-label={c.moveEarlier}
            disabled={busy || m.sos_order <= 1}
            onClick={() => actions.moveSos(m.id, -1)}
            style={{ minWidth: A11Y.minTapTargetPx, padding: "0 14px" }}
          >
            ↑
          </GhostBtn>
          <GhostBtn
            aria-label={c.moveLater}
            disabled={busy || m.sos_order >= sosCount}
            onClick={() => actions.moveSos(m.id, 1)}
            style={{ minWidth: A11Y.minTapTargetPx, padding: "0 14px" }}
          >
            ↓
          </GhostBtn>
        </div>
      )}

      <div style={{ borderTop: `1px solid ${C.warmGray}` }} />
      <Toggle
        checked={m.can_see_mood}
        busy={busy}
        onChange={() => actions.setPermission(m.id, "can_see_mood", !m.can_see_mood)}
        label={COPY.perms.mood.label}
        hint={COPY.perms.mood.hint}
      />
      <div style={{ borderTop: `1px solid ${C.warmGray}` }} />
      <Toggle
        checked={m.can_see_health}
        busy={busy}
        onChange={() => actions.setPermission(m.id, "can_see_health", !m.can_see_health)}
        label={COPY.perms.health.label}
        hint={COPY.perms.health.hint}
      />
      <div style={{ borderTop: `1px solid ${C.warmGray}` }} />
      <Toggle
        checked={m.can_manage_reminders}
        busy={busy}
        onChange={() => actions.setPermission(m.id, "can_manage_reminders", !m.can_manage_reminders)}
        label={COPY.perms.reminders.label}
        hint={COPY.perms.reminders.hint}
      />
      <div style={{ borderTop: `1px solid ${C.warmGray}` }} />
      <Segmented
        label={COPY.perms.location.label}
        hint={COPY.perms.location.hint}
        value={m.location_access}
        onChange={(v) => actions.setLocation(m.id, v)}
        options={[
          { value: "never", label: COPY.perms.location.never },
          { value: "sos_only", label: COPY.perms.location.sosOnly },
        ]}
      />

      {/* One tap, no confirmation maze, no notice to the removed person. */}
      <div style={{ marginTop: 12 }}>
        <GhostBtn
          disabled={busy}
          aria-label={c.removeLabel(name)}
          onClick={() => actions.removeMember(m.id)}
          style={{ color: C.error, borderColor: C.error }}
        >
          {c.remove}
        </GhostBtn>
      </div>
    </Card>
  );
}

function RequestCard({ r, busy, onApprove }) {
  const { ts, meta } = useI18n();
  const name = personName(r.person, null);
  const body = r.person ? COPY.requests.body(name) : COPY.requests.byEmail(r.invitee_email);
  return (
    <Card style={{ background: C.cream, border: `1px dashed ${C.olive}` }}>
      <h3 style={{ fontFamily: meta.fonts.heading, fontSize: ts(22), fontWeight: 700, color: C.brown, margin: "0 0 6px" }}>
        {r.person ? name : (r.invitee_email || "Someone")}
      </h3>
      <BodyText>{body}</BodyText>
      <PrimaryBtn disabled={busy} onClick={() => onApprove(r.id)}>
        {busy ? COPY.requests.approving : COPY.requests.approve}
      </PrimaryBtn>
    </Card>
  );
}

/* The empty state's door: create a real invite code (one token, 48h,
   single-use) the Icon can read aloud. */
function InvitePanel({ createInvite }) {
  const { ts, meta } = useI18n();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState(null);
  const [busy, setBusy] = useState(false);
  const c = COPY.invite;

  const generate = async () => {
    setBusy(true);
    const result = await createInvite({});
    setBusy(false);
    if (result) setCode(result);
  };

  if (!open) {
    return (
      <PrimaryBtn onClick={() => setOpen(true)}>{c.open}</PrimaryBtn>
    );
  }
  return (
    <Card>
      <BodyText muted>{c.intro}</BodyText>
      {code ? (
        <>
          <p style={{ fontSize: ts(15), color: C.textMuted, margin: "4px 0" }}>{c.codeLabel}</p>
          <p
            dir="ltr"
            style={{
              fontFamily: meta.fonts.heading,
              fontSize: ts(46),
              fontWeight: 700,
              letterSpacing: "0.14em",
              color: C.green,
              margin: "2px 0 8px",
            }}
          >
            {code.replace(/(\d{3})(\d{3})/, "$1 $2")}
          </p>
          <BodyText muted>{c.codeSpoken}</BodyText>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <GhostBtn onClick={generate} disabled={busy}>{c.another}</GhostBtn>
            <GhostBtn onClick={() => setOpen(false)}>{c.close}</GhostBtn>
          </div>
        </>
      ) : (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <PrimaryBtn onClick={generate} disabled={busy}>
            {busy ? c.generating : c.generate}
          </PrimaryBtn>
          <GhostBtn onClick={() => setOpen(false)}>{c.close}</GhostBtn>
        </div>
      )}
    </Card>
  );
}

export default function CirclePage() {
  const { ts, meta } = useI18n();
  const { profile } = useSession();
  const iconId = profile?.id ?? null;
  const { members, requests, loading, error, busyIds, actions } = useCircle(iconId);
  const sosCount = members.filter((m) => m.is_sos_contact).length;

  return (
    <main style={{ minHeight: "100vh", background: C.bg, color: C.textMain, padding: "20px 16px 64px" }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <h1 style={{ fontFamily: meta.fonts.heading, fontSize: ts(32), fontWeight: 700, color: C.green, margin: "4px 0 8px" }}>
          {COPY.title}
        </h1>
        <BodyText muted style={{ marginBottom: 8 }}>{COPY.intro}</BodyText>

        {error && (
          <Card style={{ background: "#f8ece9", border: `1px solid ${C.error}` }}>
            <BodyText style={{ color: C.error, margin: 0 }} role="alert">{COPY.error}</BodyText>
          </Card>
        )}

        {/* Incoming requests first — a one-tap yes shouldn't be buried. */}
        {requests.length > 0 && (
          <>
            <SectionLabel>{COPY.requests.heading}</SectionLabel>
            {requests.map((r) => (
              <RequestCard key={r.id} r={r} busy={busyIds.has(r.id)} onApprove={actions.approveRequest} />
            ))}
          </>
        )}

        {loading ? (
          <BodyText muted aria-busy="true">···</BodyText>
        ) : members.length === 0 ? (
          <Card>
            <h2 style={{ fontFamily: meta.fonts.heading, fontSize: ts(24), fontWeight: 700, color: C.brown, margin: "0 0 8px" }}>
              {COPY.empty.heading}
            </h2>
            <BodyText muted style={{ marginBottom: 16 }}>{COPY.empty.body}</BodyText>
            <InvitePanel createInvite={actions.createInvite} />
          </Card>
        ) : (
          <>
            <SectionLabel>
              {members.length === 1 ? "1 person" : `${members.length} people`}
            </SectionLabel>
            {members.map((m) => (
              <MemberCard
                key={m.id}
                m={m}
                sosCount={sosCount}
                busy={busyIds.has(m.id)}
                actions={actions}
              />
            ))}
            <Card style={{ textAlign: "center", background: "transparent", border: "none", padding: "8px 0" }}>
              <InvitePanel createInvite={actions.createInvite} />
            </Card>
          </>
        )}
      </div>
    </main>
  );
}
