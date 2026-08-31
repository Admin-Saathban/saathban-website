/* ════════════════════════════════════════════════
   My Circle — the Icon-facing screen (SPEC.md, My Circle).

   Real data via useCircle(iconId): members with per-member permission
   toggles, one-tap removal (no confirmation maze), SOS designation
   with ordering, incoming join-request approval (one tap), and an
   empty state written as a door, never a scoreboard.

   Since 0037 a NEW membership arrives with sharing ON — the people
   who join an Icon's circle are their daughter, their son, the
   neighbour of thirty years, and meeting them with five switches set
   to "no" served nobody (SPEC.md §My Circle). The Icon is told in
   plain words what that means, at the moment it happens, and every
   switch below is theirs to turn off. Existing memberships were never
   touched: whatever was granted before stays exactly as it was.
   ════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { APP_COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { useSession } from "../../lib/session.jsx";
import { useCircle } from "./circleStore.js";
import { useToast, useFresh, pushToast } from "../../lib/feedback.jsx";
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

function personName(person, t) {
  return person?.full_name || t("circle.member.unknownFallback");
}

function sosOrderLabel(t, n) {
  if (n === 1) return t("circle.member.sosFirst");
  if (n === 2) return t("circle.member.sosSecond");
  return t("circle.member.sosNth", { n });
}

function MemberCard({ m, sosCount, busy, actions, freshProps }) {
  const { t, ts, meta } = useI18n();
  const { toast } = useToast();
  const name = personName(m.person, t);
  /* Every grant says what it now is, in words — a toggle that only
     changes colour leaves a person guessing. */
  const flip = (column, next, labelKey) => {
    actions.setPermission(m.id, column, next);
    toast(t(next ? "feedback.permissionOn" : "feedback.permissionOff", { what: t(labelKey) }), {
      tone: "info",
      key: `perm-${m.id}-${column}`,
    });
  };

  return (
    <Card {...(freshProps || {})}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 10 }}>
        {/* The member is tappable: name → their profile page (people lane),
            with the connection, granted permissions, and the Message door. */}
        <h3 style={{ fontFamily: meta.fonts.heading, fontSize: ts(23), fontWeight: 700, margin: 0 }}>
          <Link
            to={`/app/people/${m.member_id}`}
            aria-label={t("circle.member.viewProfile", { name })}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              minHeight: A11Y.minTapTargetPx,
              color: C.green,
              textDecoration: "none",
            }}
          >
            {name}
            <span aria-hidden="true" style={{ fontSize: ts(18), color: C.greenMuted }}>
              {meta.dir === "rtl" ? "‹" : "›"}
            </span>
          </Link>
        </h3>
        {m.person?.city && <BodyText muted style={{ margin: 0 }}>{m.person.city}</BodyText>}
        {m.is_sos_contact && (
          <Pill tone="brown">🆘 {sosOrderLabel(t, m.sos_order)}</Pill>
        )}
      </div>

      <SectionLabel>{t("circle.member.permissionsLabel")}</SectionLabel>

      {/* SOS — a permission plus, when on, ordering among SOS contacts */}
      <Toggle
        checked={m.is_sos_contact}
        busy={busy}
        onChange={() => actions.toggleSos(m.id)}
        label={t("circle.perms.sos.label")}
        hint={t("circle.perms.sos.hint")}
      />
      {m.is_sos_contact && sosCount > 1 && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", margin: "2px 0 6px" }}>
          {/* Ordering is status text — floored at 18 (QUALITY_REPORT §3). */}
          <span style={{ fontSize: ts(18), color: C.textMuted }}>{sosOrderLabel(t, m.sos_order)}</span>
          <GhostBtn
            aria-label={t("circle.member.moveEarlier")}
            disabled={busy || m.sos_order <= 1}
            onClick={() => actions.moveSos(m.id, -1)}
            style={{ minWidth: A11Y.minTapTargetPx, padding: "0 14px" }}
          >
            ↑
          </GhostBtn>
          <GhostBtn
            aria-label={t("circle.member.moveLater")}
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
        onChange={() => flip("can_see_mood", !m.can_see_mood, "circle.perms.mood.label")}
        label={t("circle.perms.mood.label")}
        hint={t("circle.perms.mood.hint")}
      />
      <div style={{ borderTop: `1px solid ${C.warmGray}` }} />
      <Toggle
        checked={m.can_see_health}
        busy={busy}
        onChange={() => flip("can_see_health", !m.can_see_health, "circle.perms.health.label")}
        label={t("circle.perms.health.label")}
        hint={t("circle.perms.health.hint")}
      />
      <div style={{ borderTop: `1px solid ${C.warmGray}` }} />
      <Toggle
        checked={m.can_manage_reminders}
        busy={busy}
        onChange={() => flip("can_manage_reminders", !m.can_manage_reminders, "circle.perms.reminders.label")}
        label={t("circle.perms.reminders.label")}
        hint={t("circle.perms.reminders.hint")}
      />
      <div style={{ borderTop: `1px solid ${C.warmGray}` }} />
      {/* 0033: a distinct grant — setting the log up is not the same as
          adding reminders. Default off like everything else. */}
      <Toggle
        checked={m.can_configure_daily_log}
        busy={busy}
        onChange={() => flip("can_configure_daily_log", !m.can_configure_daily_log, "circle.perms.configure.label")}
        label={t("circle.perms.configure.label")}
        hint={t("circle.perms.configure.hint")}
      />
      <div style={{ borderTop: `1px solid ${C.warmGray}` }} />
      {/* 0037: off by default even in the open model — being told that
          someone has gone quiet is a different thing from seeing their
          day, and it is the Icon's to offer. */}
      <Toggle
        checked={m.quiet_days_notice}
        busy={busy}
        onChange={() => flip("quiet_days_notice", !m.quiet_days_notice, "circle.perms.quietDays.label")}
        label={t("circle.perms.quietDays.label")}
        hint={t("circle.perms.quietDays.hint")}
      />
      <div style={{ borderTop: `1px solid ${C.warmGray}` }} />
      <Segmented
        label={t("circle.perms.location.label")}
        hint={t("circle.perms.location.hint")}
        value={m.location_access}
        onChange={(v) => actions.setLocation(m.id, v)}
        options={[
          { value: "never", label: t("circle.perms.location.never") },
          { value: "sos_only", label: t("circle.perms.location.sosOnly") },
        ]}
      />

      {/* One tap, no confirmation maze, no notice to the removed person. */}
      <div style={{ marginTop: 12 }}>
        <GhostBtn
          disabled={busy}
          aria-label={t("circle.member.removeLabel", { name })}
          onClick={() => {
            actions.removeMember(m.id);
            toast(t("feedback.memberRemoved", { name }), { tone: "info" });
          }}
          style={{ color: C.error, borderColor: C.error }}
        >
          {t("circle.member.remove")}
        </GhostBtn>
      </div>
    </Card>
  );
}

function RequestCard({ r, busy, onApprove }) {
  const { t, ts, meta } = useI18n();
  const name = personName(r.person, t);
  const body = r.person
    ? t("circle.requests.body", { name })
    : t("circle.requests.byEmail", { email: r.invitee_email });
  return (
    <Card style={{ background: C.cream, border: `1px dashed ${C.olive}` }}>
      <h3 style={{ fontFamily: meta.fonts.heading, fontSize: ts(22), fontWeight: 700, color: C.brown, margin: "0 0 6px" }}>
        {r.person ? name : (r.invitee_email || t("circle.requests.unknownFallback"))}
      </h3>
      <BodyText>{body}</BodyText>
      <PrimaryBtn disabled={busy} onClick={() => onApprove(r.id)}>
        {busy ? t("circle.requests.approving") : t("circle.requests.approve")}
      </PrimaryBtn>
    </Card>
  );
}

/* The empty state's door: create a real invite code (one token, 48h,
   single-use) the Icon can read aloud. */
function InvitePanel({ createInvite }) {
  const { t, ts, meta } = useI18n();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState(null);
  const [busy, setBusy] = useState(false);
  const k = (key) => t(`circle.invite.${key}`);

  const generate = async () => {
    if (busy) return; // one code at a time
    setBusy(true);
    const result = await createInvite({});
    setBusy(false);
    if (result) {
      /* §11: the code IS the result and setCode has just put it on
         the screen, large enough to read down a phone line. A toast
         over the top of it announced something the person was
         already looking at. */
      setCode(result);
    } else {
      pushToast(t("feedback.somethingWrong"), { tone: "error" });
    }
  };

  if (!open) {
    return (
      <PrimaryBtn onClick={() => setOpen(true)}>{k("open")}</PrimaryBtn>
    );
  }
  return (
    <Card>
      <BodyText muted>{k("intro")}</BodyText>
      {code ? (
        <>
          <p style={{ fontSize: ts(18), color: C.textMuted, margin: "4px 0" }}>{k("codeLabel")}</p>
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
          <BodyText muted>{k("codeSpoken")}</BodyText>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <GhostBtn onClick={generate} disabled={busy}>{k("another")}</GhostBtn>
            <GhostBtn onClick={() => setOpen(false)}>{k("close")}</GhostBtn>
          </div>
        </>
      ) : (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <PrimaryBtn onClick={generate} disabled={busy}>
            {busy ? k("generating") : k("generate")}
          </PrimaryBtn>
          <GhostBtn onClick={() => setOpen(false)}>{k("close")}</GhostBtn>
        </div>
      )}
    </Card>
  );
}

/* The whole of what acceptance means, in one screen and one button.
   No checklist, no toggles, no second step — the review door is in the
   notification that follows and in Settings for ever after. */
function WelcomeSheet({ name, onClose }) {
  const { t, ts, meta } = useI18n();
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("circle.welcome.title", { name })}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 80,
        background: "rgba(45, 36, 24, 0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        style={{
          background: C.white,
          borderRadius: 24,
          maxWidth: 520,
          width: "100%",
          padding: "30px 26px",
          boxShadow: "0 10px 40px rgba(45, 36, 24, 0.35)",
        }}
      >
        <p aria-hidden="true" style={{ fontSize: ts(46), margin: "0 0 6px", textAlign: "center" }}>
          🤝
        </p>
        <h2
          style={{
            fontFamily: meta.fonts.heading,
            fontSize: ts(30),
            lineHeight: 1.25,
            fontWeight: 700,
            color: C.green,
            margin: "0 0 14px",
            textAlign: "center",
          }}
        >
          {t("circle.welcome.title", { name })}
        </h2>
        <p style={{ fontSize: ts(22), lineHeight: 1.6, color: C.textMain, margin: "0 0 12px" }}>
          {t("circle.welcome.body")}
        </p>
        <p style={{ fontSize: ts(20), lineHeight: 1.6, color: C.textMuted, margin: "0 0 22px" }}>
          {t("circle.welcome.later")}
        </p>
        <button
          type="button"
          onClick={onClose}
          autoFocus
          style={{
            width: "100%",
            minHeight: 68,
            borderRadius: 50,
            border: "none",
            background: C.green,
            color: C.cream,
            fontSize: ts(24),
            fontWeight: 700,
            fontFamily: "inherit",
            cursor: "pointer",
          }}
        >
          {t("circle.welcome.okay")}
        </button>
      </div>
    </div>
  );
}

export default function CirclePage() {
  const { t, ts, meta } = useI18n();
  const { profile } = useSession();
  const iconId = profile?.id ?? null;
  const { members, requests, loading, error, busyIds, actions } = useCircle(iconId);
  const sosCount = members.filter((m) => m.is_sos_contact).length;
  const [welcomeName, setWelcomeName] = useState(null);
  const fresh = useFresh();

  /* The notification's deep link (/app/circle?member=<id>) lands here:
     the member it names is scrolled to and glows, so "review what's
     shared" opens on the right card rather than a wall of them. */
  const [params, setParams] = useSearchParams();
  const wanted = params.get("member");
  useEffect(() => {
    if (!wanted || loading) return;
    if (!members.some((m) => m.id === wanted)) return;
    fresh.mark(wanted);
    const next = new URLSearchParams(params);
    next.delete("member");
    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wanted, loading, members]);

  return (
    <main style={{ minHeight: "100vh", background: C.bg, color: C.textMain, padding: "20px 16px 64px" }}>
      {welcomeName && <WelcomeSheet name={welcomeName} onClose={() => setWelcomeName(null)} />}
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <h1 style={{ fontFamily: meta.fonts.heading, fontSize: ts(32), fontWeight: 700, color: C.green, margin: "4px 0 8px" }}>
          {t("circle.title")}
        </h1>
        <BodyText muted style={{ marginBottom: 8 }}>{t("circle.intro")}</BodyText>

        {error && (
          <Card style={{ background: "#f8ece9", border: `1px solid ${C.error}` }}>
            <BodyText style={{ color: C.error, margin: 0 }} role="alert">{t("circle.error")}</BodyText>
          </Card>
        )}

        {/* Incoming requests first — a one-tap yes shouldn't be buried. */}
        {requests.length > 0 && (
          <>
            <SectionLabel>{t("circle.requests.heading")}</SectionLabel>
            {requests.map((r) => (
              <RequestCard
                key={r.id}
                r={r}
                busy={busyIds.has(r.id)}
                onApprove={async (inviteId) => {
                  await actions.approveRequest(inviteId);
                  // One screen says what just happened; the toast would
                  // be a second, smaller voice saying the same thing.
                  setWelcomeName(personName(r.person, t).split(" ")[0]);
                }}
              />
            ))}
          </>
        )}

        {loading ? (
          <BodyText muted aria-busy="true">···</BodyText>
        ) : members.length === 0 ? (
          <Card>
            <h2 style={{ fontFamily: meta.fonts.heading, fontSize: ts(24), fontWeight: 700, color: C.brown, margin: "0 0 8px" }}>
              {t("circle.empty.heading")}
            </h2>
            <BodyText muted style={{ marginBottom: 16 }}>{t("circle.empty.body")}</BodyText>
            <InvitePanel createInvite={actions.createInvite} />
          </Card>
        ) : (
          <>
            <SectionLabel>
              {members.length === 1
                ? t("circle.member.onePerson")
                : t("circle.member.manyPeople", { n: members.length })}
            </SectionLabel>
            {members.map((m) => (
              <MemberCard
                key={m.id}
                freshProps={fresh.props(m.id)}
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
