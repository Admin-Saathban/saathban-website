/* ════════════════════════════════════════════════
   /app/admin/people — every account.

   admin_list_people (0150) reads auth.users joined to profiles, so an
   unfinished signup with no profile is listed too. The search runs in
   the database (support or super only) and each search is audited, so
   typing is debounced: one audit row per settled search, not per key.
   The filter chips below only narrow what the search already returned.
   ════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { APP_COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { Card, fmtDate } from "./ui.jsx";
import { PageTitle, StatusChips, useRoleLabel, inputStyle, Notice, lastActive } from "./adminBits.jsx";
import * as api from "./accountsApi.js";

const FILTERS = ["all", "active", "paused", "test", "noProfile"];

export default function PeopleList() {
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
  }, [query]);

  const shown = (rows || []).filter((p) => {
    if (filter === "all") return true;
    if (filter === "paused") return p.is_paused || p.is_blocked;
    if (filter === "test") return p.is_test;
    if (filter === "noProfile") return !p.has_profile;
    return p.has_profile && !p.is_paused && !p.is_blocked && !p.is_test;
  });

  return (
    <div style={{ maxWidth: 1040 }}>
      <PageTitle title={t("admin.people.title")} intro={t("admin.people.intro")} />
      <Notice msg={msg} />

      <label style={{ display: "block", marginBottom: 12 }}>
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
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
            {shown.map((p) => (
              <li key={p.id}>
                <Link
                  to={`/app/admin/people/${p.id}`}
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    gap: "6px 18px",
                    minHeight: A11Y.minTapTargetPx,
                    padding: "12px 16px",
                    border: `1px solid ${C.warmGray}`,
                    borderRadius: 10,
                    textDecoration: "none",
                    color: C.textMain,
                    background: C.white,
                  }}
                >
                  <span style={{ flex: "1 1 260px", minWidth: 0 }}>
                    <strong style={{ display: "block", color: C.green, fontSize: 19 }}>
                      {p.full_name || t("admin.people.unnamed")}
                    </strong>
                    <span style={{ color: C.textMuted, fontSize: 16, overflowWrap: "anywhere" }}>{p.email}</span>
                  </span>
                  <span style={{ flex: "0 1 170px", fontSize: 16 }}>{roleLabel(p.role, p.admin_level)}</span>
                  <span style={{ flex: "0 1 200px", fontSize: 15, color: C.textMuted, lineHeight: 1.5 }}>
                    {t("admin.people.joined", { when: fmtDate(p.joined_at) })}
                    <br />
                    {t("admin.people.lastActive", { when: fmtDate(lastActive(p)) })}
                  </span>
                  <span style={{ flex: "0 1 auto" }}>
                    <StatusChips person={p} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
