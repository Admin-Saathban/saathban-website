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
import { MOOD_BY_VALUE } from "./famCopy.js";
import AreaCards from "../../components/AreaCards.jsx";
import YourTurnChips from "../games/YourTurnChips.jsx";
import { fetchSharedMoments, momentDayLabel } from "./famMoments.js";

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

/* One shared moment → a warm one-liner. Badge/score/walk cards read
   their 0018 payload snapshot; text posts show a short excerpt. */
function momentLine(m, t, lang) {
  switch (m.post_type) {
    case "badge": {
      const name = (lang === "ur" ? m.payload?.name_ur : m.payload?.name_en) || m.payload?.name_en || "";
      return t("fam.moments.badge", { emoji: m.payload?.emoji || "🏅", badge: name });
    }
    case "score": return t("fam.moments.score");
    case "walk": return t("fam.moments.walk");
    case "event": return t("fam.moments.event");
    // Riddle share: the solve is the moment — never guess counts here.
    case "puzzle_result": return t("fam.moments.riddle");
    default: {
      const body = (m.body || "").trim();
      return body.length > 90 ? `“${body.slice(0, 90)}…”` : body ? `“${body}”` : null;
    }
  }
}

/* Celebration, never monitoring: this strip shows ONLY what the person
   chose to share with the whole community (their posts — the badge/
   score/walk share cards included). Earned badges are owner-only at
   the DB; a share is the one lawful window. No moments → no strip, no
   gap implied. */
function SharedMoments({ view }) {
  const { t, ts, lang } = useI18n();
  const first = view.name.split(" ")[0];
  const moments = view.moments || [];
  if (moments.length === 0) return null;
  return (
    <div style={{ background: "#fdf6ec", border: `1px solid ${C.warmGray}`, borderRadius: 14, padding: "12px 16px", marginBottom: 14 }}>
      <p style={{ fontSize: ts(15), fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: C.greenMuted, margin: "0 0 8px" }}>
        🎉 {t("fam.moments.label", { name: first })}
      </p>
      {moments.map((m) => {
        const line = momentLine(m, t, lang);
        if (!line) return null;
        return (
          <BodyText key={m.id} style={{ margin: "0 0 6px" }}>
            {line}
            <span style={{ color: C.textMuted, fontSize: ts(15) }}> · {momentDayLabel(m.created_at, t)}</span>
          </BodyText>
        );
      })}
    </div>
  );
}

function IconCard({ view }) {
  const { t, ts, meta } = useI18n();
  const first = view.name.split(" ")[0];
  const p = view.permissions;

  return (
    <Card>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 10 }}>
        {/* The name is the door to their unified People profile. */}
        <Link to={`/app/people/${view.iconId}`} style={{ textDecoration: "none" }}>
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
        </Link>
        {p.sosContact != null && (
          <Pill tone="brown">🆘 {p.sosContact === 1 ? t("fam.card.sosFirst") : t("fam.card.sosSecond")}</Pill>
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
        {t("fam.card.todayLabel")}
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
                {t(view.today.mood.labelKey)}
              </BodyText>
            )}
            <BodyText style={{ marginBottom: 8 }}>
              {view.today.dailyCount === 1
                ? t("fam.card.logsSummaryOne")
                : t("fam.card.logsSummaryMany", { n: view.today.dailyCount })}
            </BodyText>
            {view.today.lastLogAt && (
              <BodyText muted style={{ margin: 0, fontSize: ts(16) }}>
                {t("fam.card.lastLog", { time: view.today.lastLogAt })}
              </BodyText>
            )}
          </div>
        ) : (
          <BodyText muted style={{ marginBottom: 14 }}>
            {t("fam.card.quietSoFar")}
          </BodyText>
        )
      ) : (
        <BodyText muted style={{ marginBottom: 14 }}>
          {t("fam.card.privateDaily", { name: first })}
        </BodyText>
      )}

      {/* Health — medication class, its own permission */}
      {p.seeHealth ? (
        <BodyText muted={view.today.medsTaken == null} style={{ marginBottom: 14 }}>
          {view.today.medsTaken != null
            ? t("fam.card.medsSummary", { taken: view.today.medsTaken })
            : t("fam.card.quietHealth")}
        </BodyText>
      ) : (
        <BodyText muted style={{ marginBottom: 14 }}>
          {t("fam.card.privateHealth", { name: first })}
        </BodyText>
      )}

      {/* Location standing — stated in words either way; never a map */}
      <BodyText muted style={{ fontSize: ts(16), marginBottom: 14 }}>
        {p.location === "sos_only" ? t("fam.card.locationSos") : t("fam.card.locationNever")}
      </BodyText>

      {/* Shared moments — celebration of what they chose to share */}
      <SharedMoments view={view} />

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {/* Message — the circle-people DM thread (0019 open_dm_with via
            the people lane's surface; see FAM_WIRING.md — not a fork). */}
        <Link
          to={`/app/people/${view.iconId}/chat`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            minHeight: 56,
            padding: "0 26px",
            borderRadius: 50,
            background: C.green,
            color: C.cream,
            fontSize: ts(19),
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          💬 {t("fam.card.messageCta")}
        </Link>

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
            ⏰ {t("fam.card.remindersCta")}
          </Link>
        )}
      </div>
    </Card>
  );
}

export default function FamDashboard() {
  const { t, ts, meta } = useI18n();
  const { profile } = useSession();

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
        const [summaries, moments] = await Promise.all([
          Promise.all(
            memberships.map((m) => fetchTodayLogs(m.icon_id, today).catch(() => []))
          ),
          Promise.all(
            memberships.map((m) => fetchSharedMoments(m.icon_id).catch(() => []))
          ),
        ]);
        if (cancelled) return;
        setViews(
          memberships.map((m, i) => ({
            moments: moments[i],
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
          // Stored as a key, rendered through t() — stays right if the
          // language changes while the error is up.
          setError("fam.dashboard.loadError");
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
        {t("fam.dashboard.greeting", { name: firstName })}
      </h1>
      <BodyText muted style={{ marginBottom: 4 }}>
        {t("fam.dashboard.intro")}
      </BodyText>

      {error && (
        <BodyText role="alert" style={{ fontWeight: 700, color: C.brown }}>
          ⚠ {t(error)}
        </BodyText>
      )}

      {/* The care cards stay UP TOP — the people come first. */}
      <SectionLabel>{t("fam.dashboard.connectedLabel")}</SectionLabel>
      {views === null ? (
        <BodyText muted role="status">…</BodyText>
      ) : views.length === 0 ? (
        <BodyText muted>{t("fam.dashboard.emptyCircle")}</BodyText>
      ) : (
        views.map((v) => <IconCard key={v.membershipId} view={v} />)
      )}

      {/* Fam plays too: chips when a table waits on them. A first-timer
          needs the word "Games" before "Your move — Carrom" (thumb test):
          the label rides :has() so it appears only when chips render. */}
      <style>{`.fam-chips:has(a)::before{content:var(--chips-label);display:block;font-weight:700;margin:0 0 6px;color:${C.textMuted}}`}</style>
      <div className="fam-chips" style={{ "--chips-label": `"🎲 ${t("hub.games")}:"`, fontSize: ts(16) }}>
        <YourTurnChips />
      </div>

      {/* Every role's home surfaces everything the role can reach —
          Fam takes part in games, events, groups, community, skills. */}
      <div style={{ margin: "14px 0 6px" }}>
        <AreaCards
          cards={[
            { to: "/app/people", emoji: "🫶", key: "hub.people" },
            { to: "/app/games", emoji: "🎲", key: "hub.games" },
            { to: "/app/events", emoji: "🎪", key: "hub.events" },
            { to: "/app/outdoor", emoji: "🌳", key: "hub.outdoor" },
            { to: "/app/groups", emoji: "🧑‍🤝‍🧑", key: "hub.groups" },
            { to: "/app/community", emoji: "🪷", key: "hub.community" },
            { to: "/app/skills", emoji: "🌱", key: "hub.skills" },
            { to: "/app/notifications", emoji: "🔔", key: "hub.notifications" },
          ]}
        />
      </div>

      {pending.length > 0 && (
        <>
          <SectionLabel>{t("fam.dashboard.pendingLabel")}</SectionLabel>
          {pending.map((req) => (
            <Card key={req.id} style={{ background: C.cream, border: `1px dashed ${C.olive}` }}>
              <BodyText>{t("fam.dashboard.pendingHint", { email: req.invitee_email })}</BodyText>
              <BodyText muted style={{ margin: 0, fontSize: ts(16) }}>
                {t("fam.dashboard.pendingExpiry", { h: hoursLeft(req.expires_at) })}
              </BodyText>
            </Card>
          ))}
        </>
      )}

      {/* The connect door is My People's zero-connections empty state —
          with connections on screen, the My People tile above already
          leads onward, so only a quiet line keeps the invite flow reachable
          (thumb test: no duplicate card). */}
      {(views || []).length === 0 ? (
        <Card style={{ textAlign: "center" }}>
          <BodyText muted>{t("fam.dashboard.inviteHint")}</BodyText>
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
            {t("fam.dashboard.inviteCta")}
          </Link>
        </Card>
      ) : (
        <div style={{ textAlign: "center", marginTop: 6 }}>
          <Link
            to="invite"
            style={{ display: "inline-flex", alignItems: "center", minHeight: A11Y.minTapTargetPx, color: C.brown, fontWeight: 600, fontSize: ts(A11Y.minBodyPx), textDecoration: "underline" }}
          >
            {t("fam.dashboard.inviteCta")}
          </Link>
        </div>
      )}
    </FamScreen>
  );
}
