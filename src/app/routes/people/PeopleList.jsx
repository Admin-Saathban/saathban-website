/* ════════════════════════════════════════════════
   My People — ONE list of every human connection: circle members,
   accepted friends, fellow group members. Deduped (one row per person,
   however many ways you're connected), how-connected chips, sorted by
   recency of interaction (my_people(), 0029), searchable.

   Away accounts (paused) render dimmed with "away from Saathban" and
   no actions except what the profile offers (remove); blocked people
   never appear — the RPC excludes them with the same caller_hides()
   every feed uses.
   ════════════════════════════════════════════════ */

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { APP_COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { useSession } from "../../lib/session.jsx";
import { Card, SectionLabel, BodyText, Pill } from "../circle/ui.jsx";
import { fetchMyPeople, fetchRequests } from "./myPeopleStore.js";
import Icon from "../../components/Icon.jsx";

/* A LABEL, NOT A CONTROL — so it carries no outline.

   These were circle/ui.jsx Pills, which draw a 2px border. An outline
   is the app's promise that a thing can be tapped, and "In your circle"
   cannot: spending that signal on a caption teaches people to try
   tapping captions, and then to stop trusting outlines.

   Pill itself is unchanged. Their screens rely on its box, so this one
   stops asking for a Pill rather than altering a primitive underneath
   another lane. Tint carries the same three tones with no border. */
const CHIP_TONE = {
  green: { bg: "#EEF3E8", fg: C.green },
  brown: { bg: "#F5EEE6", fg: C.brown },
  plain: { bg: "#00000008", fg: C.textMuted },
};

function Chip({ tone = "plain", icon, children }) {
  const c = CHIP_TONE[tone] || CHIP_TONE.plain;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      background: c.bg, color: c.fg, borderRadius: 999,
      padding: "4px 12px", fontSize: 15, fontWeight: 600,
    }}>
      {icon ? <Icon name={icon} size={15} /> : null}
      {children}
    </span>
  );
}

export default function PeopleList() {
  const { t, ts, meta } = useI18n();
  const { profile } = useSession();
  const [people, setPeople] = useState(null); // null = loading
  const [pendingIn, setPendingIn] = useState(0);
  const [q, setQ] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const [list, reqs] = await Promise.all([
          fetchMyPeople(),
          profile?.id ? fetchRequests(profile.id).catch(() => []) : [],
        ]);
        if (dead) return;
        setPeople(list);
        setPendingIn(reqs.filter((r) => r.incoming && r.status === "pending").length);
      } catch {
        if (!dead) { setError("people.list.loadError"); setPeople([]); }
      }
    })();
    return () => { dead = true; };
  }, [profile?.id]);

  const shown = useMemo(() => {
    if (!people) return [];
    const needle = q.trim().toLowerCase();
    if (!needle) return people;
    return people.filter(
      (p) =>
        (p.full_name || "").toLowerCase().includes(needle) ||
        (p.city || "").toLowerCase().includes(needle) ||
        (p.group_names || []).some((g) => g.toLowerCase().includes(needle))
    );
  }, [people, q]);

  return (
    <>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ fontFamily: meta.fonts.heading, fontSize: ts(32), fontWeight: 700, color: C.green, margin: "4px 0 6px" }}>
          {t("people.list.title")}
        </h1>
        <Link
          to="requests"
          style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            minHeight: A11Y.minTapTargetPx, padding: "0 18px", borderRadius: 50,
            border: `2px solid ${pendingIn > 0 ? C.green : C.warmGray}`,
            background: C.white, color: C.textMain,
            fontSize: ts(A11Y.minBodyPx), fontWeight: 600, textDecoration: "none",
          }}
        >
          <Icon name="letter" size={19} />
          {t("people.list.requestsCta")}
          {pendingIn > 0 && (
            <span style={{ background: C.green, color: C.cream, borderRadius: 50, padding: "2px 10px", fontSize: ts(15), fontWeight: 800 }}>
              {pendingIn}
            </span>
          )}
        </Link>
        {/* ONE INVITE, NOT TWO. It was offered here AND again beside the
            empty state, the same words and the same flower twice on one
            screen — which reads as two different actions until you try
            them. The one that stays is the one next to the empty list,
            where a person who has nobody is actually looking. */}
      </div>
      <BodyText muted style={{ marginBottom: 14 }}>{t("people.list.intro")}</BodyText>

      {error && <BodyText role="alert" style={{ fontWeight: 700, color: C.brown }}>⚠ {t(error)}</BodyText>}

      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t("people.list.searchPh")}
        aria-label={t("people.list.searchPh")}
        style={{
          width: "100%", boxSizing: "border-box", minHeight: A11Y.minTapTargetPx,
          fontSize: ts(A11Y.minBodyPx), fontFamily: "inherit", color: C.textMain,
          background: C.white, border: `1px solid ${C.warmGray}`, borderRadius: 12,
          padding: "10px 14px", marginBottom: 16,
        }}
      />

      {people === null ? (
        <BodyText muted role="status">···</BodyText>
      ) : shown.length === 0 ? (
        <div>
          <BodyText muted style={{ margin: 0 }}>
            {q ? t("people.list.noMatches") : t("people.list.empty")}
          </BodyText>
          {/* The emptier this list, the more the invitation matters —
              so it is offered here rather than only in the header. */}
          {!q && (
            <Link
              to="invite"
              style={{
                display: "inline-flex", alignItems: "center", gap: 8, marginTop: 14,
                minHeight: A11Y.minTapTargetPx, padding: "0 22px", borderRadius: 50,
                background: C.green, color: C.cream,
                fontSize: ts(A11Y.minBodyPx), fontWeight: 700, textDecoration: "none",
              }}
            >
              <Icon name="add" size={19} style={{ marginInlineEnd: 8 }} />{t("people.list.inviteCta")}
            </Link>
          )}
        </div>
      ) : (
        shown.map((p) => {
          const initial = (p.full_name || "?").trim().charAt(0);
          return (
            <Link key={p.id} to={p.id} style={{ textDecoration: "none", color: "inherit" }}>
              {/* A ROW, NOT A CARD. Card is the circle lane's primitive and
                  their screens rely on its box, so this screen stops asking
                  for one instead of changing it underneath them. A list of
                  people is separated by space; ten outlined boxes down a
                  phone is ten rectangles competing with ten faces. */}
              <div style={{ opacity: p.away ? 0.55 : 1, padding: "12px 4px", borderBottom: `1px solid ${C.warmGray}22` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                  <span aria-hidden="true" style={{
                    width: 52, height: 52, borderRadius: "50%", background: p.away ? C.warmGray : C.sage,
                    color: C.cream, display: "inline-flex", alignItems: "center", justifyContent: "center",
                    fontSize: ts(22), fontWeight: 700, flexShrink: 0,
                  }}>
                    {initial}
                  </span>
                  <div style={{ flex: "1 1 180px", minWidth: 0 }}>
                    <p style={{ fontFamily: meta.fonts.heading, fontSize: ts(21), fontWeight: 700, color: C.green, margin: 0 }}>
                      {p.full_name}
                      {p.city && <span style={{ fontFamily: meta.fonts.body, fontWeight: 400, color: C.textMuted, fontSize: ts(16) }}> · {p.city}</span>}
                    </p>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                      {p.away && <Chip icon="sleep">{t("people.list.away")}</Chip>}
                      {p.in_circle && <Chip tone="green" icon="helpOffer">{t("people.chips.circle")}</Chip>}
                      {p.is_friend && <Chip tone="brown" icon="good">{t("people.chips.friend")}</Chip>}
                      {(p.group_names || []).map((g) => (
                        <Chip key={g} icon="groups">{t("people.chips.group", { name: g })}</Chip>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          );
        })
      )}
    </>
  );
}
