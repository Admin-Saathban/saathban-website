/* ════════════════════════════════════════════════
   /app/admin/people — every account.

   admin_list_people (0150) reads auth.users joined to profiles, so an
   unfinished signup with no profile is listed too. The search runs in
   the database (support or super only) and each search is audited, so
   typing is debounced: one audit row per settled search, not per key.
   The filter chips below only narrow what the search already returned.

   Two shapes, chosen by the width the list is given (container query):
   a table across a wide page — person, role, dates, status in columns —
   and stacked rows when narrow or when it sits beside an open person
   (PeopleDesk passes compact, and marks the person who is open).
   ════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { APP_COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { Card, fmtDate } from "./ui.jsx";
import { PageTitle, StatusChips, useRoleLabel, inputStyle, Notice, lastActive } from "./adminBits.jsx";
import * as api from "./accountsApi.js";

const FILTERS = ["all", "active", "paused", "test", "noProfile"];

export default function PeopleList({ compact = false, selectedId = null }) {
  const { t } = useI18n();
  const roleLabel = useRoleLabel();
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState(null);
  const [filter, setFilter] = useState("all");
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    let live = true;
    const timer = setTimeout(async () => {
      try {
        const data = await api.listPeople(query.trim());
        if (live) {
          setRows(data || []);
          setMsg(null);
        }
      } catch (e) {
        if (live) {
          setRows([]);
          setMsg({ kind: "err", text: t(api.refusalKey(e) || "admin.people.loadFailed") });
        }
      }
    }, query ? 350 : 0);
    return () => {
      live = false;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const shown = (rows || []).filter((p) => {
    if (filter === "all") return true;
    if (filter === "paused") return p.is_paused || p.is_blocked;
    if (filter === "test") return p.is_test;
    if (filter === "noProfile") return !p.has_profile;
    return p.has_profile && !p.is_paused && !p.is_blocked && !p.is_test;
  });

  return (
    <div style={{ maxWidth: compact ? "none" : 1600 }} data-people-list={compact ? "compact" : "full"}>
      <style>{`
        .sb-people-wrap { container-type: inline-size; }
        .sb-people-row { display: grid; grid-template-columns: minmax(0, 1fr); gap: 4px 18px; align-items: center; }
        .sb-people-head { display: none; }
        @container (min-width: 820px) {
          .sb-people-row, .sb-people-head { grid-template-columns: minmax(0, 2.2fr) minmax(0, 1fr) minmax(0, 1.2fr) minmax(0, 1.1fr); }
          .sb-people-head { display: grid; gap: 4px 18px; padding: 0 18px 6px; }
        }
      `}</style>
      <PageTitle title={t("admin.people.title")} intro={compact ? null : t("admin.people.intro")} />
      <Notice msg={msg} />

      <label style={{ display: "block", marginBottom: 12, maxWidth: compact ? "none" : 720 }}>
        <span style={{ display: "block", fontWeight: 700, marginBottom: 4 }}>{t("admin.people.search")}</span>
        <input
          type="search"
          value={query}
          placeholder={t("admin.people.searchPlaceholder")}
          onChange={(e) => setQuery(e.target.value)}
          style={inputStyle}
        />
      </label>

      <div role="group" aria-label={t("admin.people.filterLabel")} style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            style={{
              minHeight: A11Y.minTapTargetPx,
              padding: "0 16px",
              borderRadius: 50,
              border: `2px solid ${C.green}`,
              background: filter === f ? C.green : C.white,
              color: filter === f ? C.cream : C.green,
              fontSize: 16,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            {filter === f ? "✓ " : ""}
            {t(`admin.people.filter.${f}`)}
          </button>
        ))}
      </div>

      <Card
        title={t("admin.people.accounts")}
        style={compact ? { padding: "16px 14px" } : undefined}
        aside={
          <span style={{ color: C.textMuted, fontWeight: 700 }} role="status">
            {rows === null ? "…" : t("admin.people.countShown", { n: shown.length, total: rows.length })}
          </span>
        }
      >
        {rows === null ? (
          <p style={{ margin: 0, color: C.textMuted }}>{t("admin.people.loading")}</p>
        ) : shown.length === 0 ? (
          <p style={{ margin: 0, color: C.textMuted }}>{t("admin.people.none")}</p>
        ) : (
          <div className="sb-people-wrap">
            <div className="sb-people-head" aria-hidden="true" style={{ fontSize: 15, fontWeight: 700, color: C.textMuted }}>
              <span>{t("admin.people.col.person")}</span>
              <span>{t("admin.people.col.role")}</span>
              <span>{t("admin.people.col.dates")}</span>
              <span>{t("admin.people.col.status")}</span>
            </div>
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
              {shown.map((p) => {
                const selected = p.id === selectedId;
                return (
                  <li key={p.id}>
                    <Link
                      to={`/app/admin/people/${p.id}`}
                      className="sb-people-row"
                      aria-current={selected ? "page" : undefined}
                      data-person-row={p.id}
                      style={{
                        minHeight: A11Y.minTapTargetPx,
                        padding: "12px 16px",
                        border: selected ? `2.5px solid ${C.green}` : `1px solid ${C.warmGray}`,
                        borderInlineStart: `5px solid ${selected ? C.green : "transparent"}`,
                        borderRadius: 10,
                        textDecoration: "none",
                        color: C.textMain,
                        background: selected ? C.selected : C.white,
                      }}
                    >
                      <span style={{ minWidth: 0 }}>
                        <strong style={{ display: "block", color: C.green, fontSize: 19 }}>
                          {selected && <span aria-hidden="true">▸ </span>}
                          {p.full_name || t("admin.people.unnamed")}
                        </strong>
                        <span style={{ color: C.textMuted, fontSize: 16, overflowWrap: "anywhere" }}>{p.email}</span>
                      </span>
                      <span style={{ fontSize: 16, minWidth: 0 }}>{roleLabel(p.role, p.admin_level)}</span>
                      <span style={{ fontSize: 15, color: C.textMuted, lineHeight: 1.5, minWidth: 0 }}>
                        {t("admin.people.joined", { when: fmtDate(p.joined_at) })}
                        <br />
                        {t("admin.people.lastActive", { when: fmtDate(lastActive(p)) })}
                      </span>
                      <span style={{ minWidth: 0 }}>
                        <StatusChips person={p} />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </Card>
    </div>
  );
}
