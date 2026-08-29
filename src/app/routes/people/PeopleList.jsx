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
import { COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { useSession } from "../../lib/session.jsx";
import { Card, SectionLabel, BodyText, Pill } from "../circle/ui.jsx";
import { fetchMyPeople, fetchRequests } from "./myPeopleStore.js";

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
          ✉️ {t("people.list.requestsCta")}
          {pendingIn > 0 && (
            <span style={{ background: C.green, color: C.cream, borderRadius: 50, padding: "2px 10px", fontSize: ts(15), fontWeight: 800 }}>
              {pendingIn}
            </span>
          )}
        </Link>
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
          background: C.white, border: `2px solid ${C.warmGray}`, borderRadius: 12,
          padding: "10px 14px", marginBottom: 16,
        }}
      />

      {people === null ? (
        <BodyText muted role="status">···</BodyText>
      ) : shown.length === 0 ? (
        <Card>
          <BodyText muted style={{ margin: 0 }}>
            {q ? t("people.list.noMatches") : t("people.list.empty")}
          </BodyText>
        </Card>
      ) : (
        shown.map((p) => {
          const initial = (p.full_name || "?").trim().charAt(0);
          return (
            <Link key={p.id} to={p.id} style={{ textDecoration: "none", color: "inherit" }}>
              <Card style={{ opacity: p.away ? 0.55 : 1, padding: 16 }}>
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
                      {p.away && <Pill>🌙 {t("people.list.away")}</Pill>}
                      {p.in_circle && <Pill tone="green">🤝 {t("people.chips.circle")}</Pill>}
                      {p.is_friend && <Pill tone="brown">🌸 {t("people.chips.friend")}</Pill>}
                      {(p.group_names || []).map((g) => (
                        <Pill key={g}>🧑‍🤝‍🧑 {t("people.chips.group", { name: g })}</Pill>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>
            </Link>
          );
        })
      )}
    </>
  );
}
