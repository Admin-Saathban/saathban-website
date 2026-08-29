/* ════════════════════════════════════════════════
   Saath-Fam dashboard — connected Icons as cards, a pending request,
   and the door to the invite flow. Mock data, no Supabase.

   The load-bearing rule (SPEC.md, My Circle): every line of an Icon's
   day rendered here is gated on a permission THEY granted. Where a
   permission is off, the card shows a calm privacy line — or, for
   reminders, nothing at all. In production RLS enforces this shape;
   here the card component is written so it *couldn't* render what it
   wasn't given.
   ════════════════════════════════════════════════ */

import { Link } from "react-router-dom";
import { COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { FamScreen, Card, SectionLabel, Pill, BodyText } from "./ui.jsx";
import { MOCK_FAM, MOCK_CONNECTED_ICONS, MOCK_PENDING, COPY } from "./famMock.js";

function IconCard({ icon }) {
  const { ts, meta } = useI18n();
  const p = icon.permissions;
  const first = icon.name.split(" ")[0];
  const c = COPY.card;

  return (
    <Card>
      {/* Header: who they are, and their SOS standing if any */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 10 }}>
        <h2
          style={{
            fontFamily: meta.fonts.heading,
            fontSize: ts(24),
            fontWeight: 700,
            color: C.green,
            margin: 0,
          }}
        >
          {icon.name}
        </h2>
        {p.sosContact != null && (
          <Pill tone="brown">🆘 {p.sosContact === 1 ? c.sosFirst : c.sosSecond}</Pill>
        )}
      </div>
      <BodyText muted style={{ margin: "4px 0 16px" }}>
        {icon.relationship} · {icon.city}
      </BodyText>

      {/* Today — only with the daily-logs permission */}
      <p
        style={{
          fontSize: ts(15),
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: C.olive,
          margin: "0 0 8px",
        }}
      >
        {c.todayLabel}
      </p>

      {p.seeDailyLogs ? (
        icon.today.modulesLogged > 0 ? (
          <div
            style={{
              background: C.cream,
              borderRadius: 14,
              padding: "14px 18px",
              marginBottom: 14,
            }}
          >
            {icon.today.mood && (
              <BodyText style={{ marginBottom: 8 }}>
                <span aria-hidden="true" style={{ marginInlineEnd: 8 }}>
                  {icon.today.mood.face}
                </span>
                {icon.today.mood.label}
              </BodyText>
            )}
            <BodyText style={{ marginBottom: 8 }}>
              {c.logsSummary(icon.today.modulesLogged, icon.today.modulesEnabled)}
            </BodyText>
            {icon.today.meds && (
              <BodyText style={{ marginBottom: 8 }}>
                {c.medsSummary(icon.today.meds.taken, icon.today.meds.total)}
              </BodyText>
            )}
            {icon.today.lastLogAt && (
              <BodyText muted style={{ margin: 0, fontSize: ts(16) }}>
                {c.lastLog(icon.today.lastLogAt)}
              </BodyText>
            )}
          </div>
        ) : (
          <BodyText muted style={{ marginBottom: 14 }}>
            {c.quietSoFar}
          </BodyText>
        )
      ) : (
        <BodyText muted style={{ marginBottom: 14 }}>
          {c.privateDaily(first)}
        </BodyText>
      )}

      {/* Health — only with the health permission */}
      {p.seeHealth ? (
        icon.health?.nextAppointment && (
          <BodyText style={{ marginBottom: 14 }}>
            <strong>{c.nextAppt}:</strong> {icon.health.nextAppointment.title},{" "}
            {icon.health.nextAppointment.when}
          </BodyText>
        )
      ) : (
        <BodyText muted style={{ marginBottom: 14 }}>
          {c.privateHealth(first)}
        </BodyText>
      )}

      {/* Location standing — stated in words either way; never a map, never a pin */}
      <BodyText muted style={{ fontSize: ts(16), marginBottom: 18 }}>
        {p.location === "sos_only" ? c.locationSos : c.locationNever}
      </BodyText>

      {/* Reminders — the button exists only where the Icon granted it.
          No locked-state teaser: an ungranted power is simply absent. */}
      {p.manageReminders && (
        <Link
          to={`icon/${icon.id}/reminders`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: A11Y.minTapTargetPx,
            padding: "0 24px",
            borderRadius: 50,
            border: `2px solid ${C.green}`,
            color: C.green,
            background: C.white,
            fontSize: ts(A11Y.minBodyPx),
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          ⏰ {c.remindersCta}
        </Link>
      )}
    </Card>
  );
}

export default function FamDashboard() {
  const { ts, meta } = useI18n();
  const d = COPY.dashboard;

  return (
    <FamScreen>
      <h1
        style={{
          fontFamily: meta.fonts.heading,
          fontSize: ts(32),
          fontWeight: 700,
          color: C.green,
          margin: "0 0 8px",
        }}
      >
        {d.greeting(MOCK_FAM.firstName)}
      </h1>
      <BodyText muted style={{ marginBottom: 4 }}>
        {d.intro}
      </BodyText>

      <SectionLabel>{d.connectedLabel}</SectionLabel>
      {MOCK_CONNECTED_ICONS.map((icon) => (
        <IconCard key={icon.id} icon={icon} />
      ))}

      {MOCK_PENDING.length > 0 && (
        <>
          <SectionLabel>{d.pendingLabel}</SectionLabel>
          {MOCK_PENDING.map((req) => (
            <Card key={req.id} style={{ background: C.cream, border: `1px dashed ${C.olive}` }}>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 10 }}>
                <h2
                  style={{
                    fontFamily: meta.fonts.heading,
                    fontSize: ts(22),
                    fontWeight: 700,
                    color: C.brown,
                    margin: 0,
                  }}
                >
                  {req.name}
                </h2>
                <Pill>⏳ {req.sentAt}</Pill>
              </div>
              <BodyText muted style={{ margin: "4px 0 12px" }}>
                {req.relationship}
              </BodyText>
              <BodyText>{d.pendingHint(req.name.split(" ")[0])}</BodyText>
              <BodyText muted style={{ margin: 0, fontSize: ts(16) }}>
                {d.pendingExpiry(req.expiresInHours)}
              </BodyText>
            </Card>
          ))}
        </>
      )}

      <Card style={{ textAlign: "center" }}>
        <BodyText muted>{d.inviteHint}</BodyText>
        {/* A link styled as the primary button — not a button nested in a
            link, which screen readers announce twice. */}
        <Link
          to="invite"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: 56,
            padding: "0 28px",
            borderRadius: 50,
            background: C.green,
            color: C.cream,
            fontSize: ts(19),
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          {d.inviteCta}
        </Link>
      </Card>
    </FamScreen>
  );
}
