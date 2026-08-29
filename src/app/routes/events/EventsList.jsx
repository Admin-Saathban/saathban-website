/* ════════════════════════════════════════════════
   Gatherings — the merged events list (SPEC.md §Events + Calendar).

   Two sources, one list: the marketing site's shared events file
   (content only — no RSVP) and app-managed events from the database
   (RSVP with capacity). Icons RSVP; Fam and Buddies see everything
   published so they can come along — RSVP-on-behalf is an open
   question (QUESTIONS.md), so nothing here implies family should
   sign anyone up.
   ════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { useSession } from "../../lib/session.jsx";
import { STRINGS as PROPOSAL_COPY } from "./proposalsCopy.js";
import {
  sharedEvents,
  fetchAppEvents,
  fetchGoingCount,
  fetchMyRsvps,
  rsvpToEvent,
  cancelRsvp,
  isUpcoming,
} from "./eventsStore.js";
import { Card, SectionLabel, Pill, PrimaryBtn, GhostBtn, BodyText } from "./ui.jsx";

function EventCard({ ev, role, going, count, onRsvp, onCancel, busy, upcoming }) {
  const { t, ts, meta } = useI18n();
  const full = ev.capacity != null && count != null && count >= ev.capacity && !going;

  return (
    <Card>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 10 }}>
        <h2
          style={{
            fontFamily: meta.fonts.heading,
            fontSize: ts(23),
            fontWeight: 700,
            color: C.green,
            margin: 0,
            flex: "1 1 auto",
          }}
        >
          {ev.title}
        </h2>
        {ev.source === "site" && <Pill>{t("events.list.siteBadge")}</Pill>}
        {going && <Pill tone="green">✓ {t("events.list.goingBadge")}</Pill>}
      </div>

      <BodyText muted style={{ margin: "6px 0 10px" }}>
        📅 {ev.dateLabel}
        {ev.timeLabel ? ` · ${ev.timeLabel}` : ""}
        {ev.venue ? ` · ${ev.venue}` : ""}
      </BodyText>

      {ev.description && <BodyText>{ev.description}</BodyText>}

      {/* Capacity said in words, app events only */}
      {ev.source === "app" && upcoming && (
        <BodyText muted style={{ fontSize: ts(18) }}>
          {ev.capacity != null
            ? t("events.list.capacity", { going: count ?? "…", cap: ev.capacity })
            : count === 1
            ? t("events.list.goingOne")
            : count > 0
            ? t("events.list.goingMany", { n: count })
            : t("events.list.openToAll")}
        </BodyText>
      )}

      {/* RSVP — Icons only, app events only, upcoming only */}
      {ev.source === "app" && upcoming && role === "saath_icon" && (
        going ? (
          <GhostBtn onClick={() => onCancel(ev)} disabled={busy}>
            {t("events.list.cancelCta")}
          </GhostBtn>
        ) : full ? (
          <BodyText muted style={{ fontWeight: 600, margin: 0 }}>
            {t("events.list.fullNote")}
          </BodyText>
        ) : (
          <PrimaryBtn onClick={() => onRsvp(ev)} disabled={busy}>
            {t("events.list.rsvpCta")}
          </PrimaryBtn>
        )
      )}

      {/* Fam and Buddies: welcome said in words, never a missing button. */}
      {ev.source === "app" && upcoming && role === "family_member" && (
        <BodyText muted style={{ fontSize: ts(18), margin: 0 }}>
          {t("events.list.famNote")}
        </BodyText>
      )}
      {ev.source === "app" && upcoming && role === "saath_buddy" && (
        <BodyText muted style={{ fontSize: ts(18), margin: 0 }}>
          {t("events.list.buddyNote")}
        </BodyText>
      )}
    </Card>
  );
}

export default function EventsList() {
  const { t, ts, meta, lang } = useI18n();
  const { profile } = useSession();
  const role = profile?.role;
  const ps = PROPOSAL_COPY[lang] || PROPOSAL_COPY.en;

  const [events, setEvents] = useState(null); // null = loading
  const [counts, setCounts] = useState({});
  const [myGoing, setMyGoing] = useState(new Set());
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");

  const load = async () => {
    const appEvents = (await fetchAppEvents()).filter((e) => e.is_published);
    const all = [...appEvents, ...sharedEvents()];
    const countEntries = await Promise.all(
      appEvents.map(async (e) => [e.id, await fetchGoingCount(e.id).catch(() => null)])
    );
    let mine = new Set();
    if (role === "saath_icon") {
      mine = new Set((await fetchMyRsvps().catch(() => [])).map((r) => r.id));
    }
    setEvents(all);
    setCounts(Object.fromEntries(countEntries));
    setMyGoing(mine);
  };

  useEffect(() => {
    // Errors are stored as locale keys (or raw server messages, which
    // t() passes through) so they re-render right on a language switch.
    load().catch(() => {
      setError("events.list.loadError");
      setEvents([]);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  const act = async (fn, ev) => {
    setBusyId(ev.id);
    setError("");
    try {
      await fn(ev.id);
      await load();
    } catch (err) {
      setError(err.message || "events.list.rsvpError");
    } finally {
      setBusyId(null);
    }
  };

  const upcoming = (events || [])
    .filter((e) => isUpcoming(e))
    .sort((a, b) => (a.when || 0) - (b.when || 0));
  const past = (events || [])
    .filter((e) => !isUpcoming(e))
    .sort((a, b) => (b.when || 0) - (a.when || 0));

  return (
    <>
      <h1
        style={{
          fontFamily: meta.fonts.heading,
          fontSize: ts(32),
          fontWeight: 700,
          color: C.green,
          margin: "12px 0 8px",
        }}
      >
        {t("events.list.title")}
      </h1>
      <BodyText muted>{t("events.list.intro")}</BodyText>

      {/* Icons can suggest a gathering; an admin reviews it (migration 0019). */}
      {role === "saath_icon" && (
        <Link
          to="suggest"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            minHeight: 56,
            padding: "0 26px",
            borderRadius: 50,
            background: C.green,
            color: C.cream,
            fontSize: ts(19),
            fontWeight: 700,
            textDecoration: "none",
            margin: "4px 0 8px",
          }}
        >
          <span aria-hidden="true">✨</span>
          {ps.listCta}
        </Link>
      )}

      {error && (
        <BodyText role="alert" style={{ fontWeight: 700, color: C.brown }}>
          ⚠ {t(error)}
        </BodyText>
      )}

      <SectionLabel>{t("events.list.upcomingLabel")}</SectionLabel>
      {events === null ? (
        <BodyText muted role="status">…</BodyText>
      ) : upcoming.length === 0 ? (
        <BodyText muted>{t("events.list.noUpcoming")}</BodyText>
      ) : (
        upcoming.map((ev) => (
          <EventCard
            key={ev.id}
            ev={ev}
            role={role}
            upcoming
            going={myGoing.has(ev.id)}
            count={counts[ev.id]}
            busy={busyId === ev.id}
            onRsvp={(e) => act(rsvpToEvent, e)}
            onCancel={(e) => act(cancelRsvp, e)}
          />
        ))
      )}

      {past.length > 0 && (
        <>
          <SectionLabel>{t("events.list.pastLabel")}</SectionLabel>
          {past.map((ev) => (
            <EventCard key={ev.id} ev={ev} role={role} upcoming={false} going={false} />
          ))}
        </>
      )}
    </>
  );
}
