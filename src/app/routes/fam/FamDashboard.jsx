/* ════════════════════════════════════════════════
   Saath-Fam dashboard — connected Icons as cards, pending requests,
   and the door to the connect flow. Wired to Supabase through
   lib/circle.js.

   The load-bearing rule (SPEC.md, My Circle): every line of an Icon's
   day rendered here is gated on a permission THEY granted. The
   membership row says what was granted; RLS on daily_logs enforces it
   — without can_see_mood the mood rows simply never arrive, and this
   card couldn't render what it wasn't given.
   ════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { useSession } from "../../lib/session.jsx";
import {
  fetchMembershipsAsMember,
  fetchMyPendingRequests,
  fetchTodayLogs,
  localIsoDate,
  hoursLeft,
} from "../../lib/circle.js";
import { FamScreen, Card, SectionLabel, Pill, BodyText } from "./ui.jsx";
import { COPY, MOOD_BY_VALUE } from "./famCopy.js";

const MOOD_CLASS = ["mood", "sleep", "exercise", "diet", "water"];

/* Fold the day's RLS-trimmed rows into what the card shows. */
function summarize(rows) {
  const mood = rows.find((r) => r.module === "mood");
  const meds = rows.find((r) => r.module === "medication");
  const dailyCount = rows.filter((r) => MOOD_CLASS.includes(r.module)).length;
  const latest = rows.reduce(
    (max, r) => (r.updated_at > max ? r.updated_at : max),
    ""
  );
  return {
    mood: mood ? MOOD_BY_VALUE[mood.mood_value] || null : null,
    dailyCount,
    medsTaken: meds ? (meds.payload?.taken || []).length : null,
    lastLogAt: latest
      ? new Date(latest).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
      : null,
  };
}

function IconCard({ view }) {
  const { ts, meta } = useI18n();
  const c = COPY.card;
  const first = view.name.split(" ")[0];
  const p = view.permissions;

  return (
    <Card>
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
          {view.name}
        </h2>
        {p.sosContact != null && (
          <Pill tone="brown">🆘 {p.sosContact === 1 ? c.sosFirst : c.sosSecond}</Pill>
        )}
      </div>
      {view.city && (
        <BodyText muted style={{ margin: "4px 0 16px" }}>
          {view.city}
        </BodyText>
      )}

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

      {/* Daily logs — the granted-or-privacy fork */}
      {p.seeDailyLogs ? (
        view.today.dailyCount > 0 ? (
          <div style={{ background: C.cream, borderRadius: 14, padding: "14px 18px", marginBottom: 14 }}>
            {view.today.mood && (
              <BodyText style={{ marginBottom: 8 }}>
                <span aria-hidden="true" style={{ marginInlineEnd: 8 }}>
                  {view.today.mood.face}
                </span>
                {view.today.mood.label}
              </BodyText>
            )}
            <BodyText style={{ marginBottom: 8 }}>{c.logsSummary(view.today.dailyCount)}</BodyText>
            {view.today.lastLogAt && (
              <BodyText muted style={{ margin: 0, fontSize: ts(16) }}>
                {c.lastLog(view.today.lastLogAt)}
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

      {/* Health — medication class, its own permission */}
      {p.seeHealth ? (
        <BodyText muted={view.today.medsTaken == null} style={{ marginBottom: 14 }}>
          {view.today.medsTaken != null ? c.medsSummary(view.today.medsTaken) : c.quietHealth}
        </BodyText>
      ) : (
        <BodyText muted style={{ marginBottom: 14 }}>
          {c.privateHealth(first)}
        </BodyText>
      )}

      {/* Location standing — stated in words either way; never a map */}
      <BodyText muted style={{ fontSize: ts(16), marginBottom: 18 }}>
        {p.location === "sos_only" ? c.locationSos : c.locationNever}
      </BodyText>

      {/* Reminders — the button exists only where the Icon granted it.
          No locked-state teaser: an ungranted power is simply absent. */}
      {p.manageReminders && (
        <Link
          to={`icon/${view.iconId}/reminders`}
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
  const { profile } = useSession();
  const d = COPY.dashboard;

  const [views, setViews] = useState(null); // null = loading
  const [pending, setPending] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [memberships, requests] = await Promise.all([
          fetchMembershipsAsMember(),
          fetchMyPendingRequests(),
        ]);
        const today = localIsoDate();
        const summaries = await Promise.all(
          memberships.map((m) =>
            fetchTodayLogs(m.icon_id, today).catch(() => [])
          )
        );
        if (cancelled) return;
        setViews(
          memberships.map((m, i) => ({
            membershipId: m.id,
            iconId: m.icon_id,
            name: m.icon_profile.full_name,
            city: m.icon_profile.city,
            permissions: {
              sosContact: m.is_sos_contact ? m.sos_order || 1 : null,
              seeDailyLogs: m.can_see_mood,
              seeHealth: m.can_see_health,
              manageReminders: m.can_manage_reminders,
              location: m.location_access,
            },
            today: summarize(summaries[i]),
          }))
        );
        setPending(requests);
      } catch {
        if (!cancelled) {
          setError(d.loadError);
          setViews([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const firstName = (profile?.full_name || "").split(" ")[0] || "";

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
        {d.greeting(firstName)}
      </h1>
      <BodyText muted style={{ marginBottom: 4 }}>
        {d.intro}
      </BodyText>

      {error && (
        <BodyText role="alert" style={{ fontWeight: 700, color: C.brown }}>
          ⚠ {error}
        </BodyText>
      )}

      <SectionLabel>{d.connectedLabel}</SectionLabel>
      {views === null ? (
        <BodyText muted role="status">…</BodyText>
      ) : views.length === 0 ? (
        <BodyText muted>{d.emptyCircle}</BodyText>
      ) : (
        views.map((v) => <IconCard key={v.membershipId} view={v} />)
      )}

      {pending.length > 0 && (
        <>
          <SectionLabel>{d.pendingLabel}</SectionLabel>
          {pending.map((req) => (
            <Card key={req.id} style={{ background: C.cream, border: `1px dashed ${C.olive}` }}>
              <BodyText>{d.pendingHint(req.invitee_email)}</BodyText>
              <BodyText muted style={{ margin: 0, fontSize: ts(16) }}>
                {d.pendingExpiry(hoursLeft(req.expires_at))}
              </BodyText>
            </Card>
          ))}
        </>
      )}

      <Card style={{ textAlign: "center" }}>
        <BodyText muted>{d.inviteHint}</BodyText>
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
