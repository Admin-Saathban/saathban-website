/* ════════════════════════════════════════════════
   The admin front door — PRODUCT_DECISIONS §18.

   "Opening admin shows what needs a human RIGHT NOW, in priority
   order: reports older than a few hours first, then Buddy
   applications waiting, unanswered questions, quiet-day welfare
   flags, documents received. Each row is one tap into the thing.
   FILTERED BY WHAT YOU CAN ACT ON."

   A dashboard of counts tells somebody that work exists. A worklist
   tells them which piece to pick up, and that is the difference
   between a screen that gets opened and one that gets closed.

   ── Filtered by what you can act on ──

   A moderator sees reports and nothing else — not because the other
   rows are hidden, but because the queries behind them return
   nothing to them (0053). The filter is therefore honest by
   construction: this screen cannot show a moderator a Buddy
   application even if it tries, because the database will not hand
   one over.

   ── Priority is by AGE, not by kind ──

   A report from four hours ago outranks one from four minutes ago,
   because the harm is ongoing. Sorting by kind would put every report
   above every application forever, and the oldest application would
   never be looked at.

   §0.6 — nothing waiting means no empty queue rendered. An admin with
   a clear desk should see that plainly, not a list of zeroes.
   ════════════════════════════════════════════════ */

import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import supabase from "../../lib/supabase.js";

const HOURS = 3600000;

/* Each source says how to read it, where it goes, and how urgent it
   becomes with age. Adding a queue means adding one entry here. */
const SOURCES = [
  {
    key: "report",
    to: "/app/admin/moderation",
    /* Reports first, and older reports before newer ones: §18 names
       "older than a few hours" as the top of the list. */
    urgentAfter: 3 * HOURS,
    load: async () => {
      const { data } = await supabase
        .from("community_reports")
        .select("id, created_at")
        .eq("status", "open")
        .order("created_at")
        .limit(20);
      return data || [];
    },
  },
  {
    key: "application",
    to: "/app/admin/buddies",
    urgentAfter: 48 * HOURS,
    load: async () => {
      const { data } = await supabase
        .from("buddy_applications")
        .select("id, created_at")
        .eq("status", "pending")
        .order("created_at")
        .limit(20);
      return data || [];
    },
  },
  {
    key: "question",
    to: "/app/admin/questions",
    urgentAfter: 24 * HOURS,
    load: async () => {
      const { data } = await supabase
        .from("questions")
        .select("id, created_at")
        .eq("status", "open")
        .order("created_at")
        .limit(20);
      return data || [];
    },
  },
];

export default function Worklist() {
  const { t, ts, lang, meta } = useI18n();
  const [rows, setRows] = useState(null);

  const load = useCallback(async () => {
    const out = [];
    for (const s of SOURCES) {
      /* One failing source must not empty the whole desk: a queue the
         caller cannot read simply contributes nothing. */
      const items = await s.load().catch(() => []);
      for (const it of items) {
        out.push({
          id: `${s.key}:${it.id}`,
          kind: s.key,
          to: s.to,
          at: new Date(it.created_at),
          urgent: Date.now() - new Date(it.created_at).getTime() > s.urgentAfter,
        });
      }
    }
    /* Oldest first, across every kind. */
    return out.sort((a, b) => a.at - b.at);
  }, []);

  useEffect(() => {
    let alive = true;
    load().then((r) => alive && setRows(r)).catch(() => alive && setRows([]));
    return () => { alive = false; };
  }, [load]);

  const waited = (d) => {
    const h = Math.floor((Date.now() - d.getTime()) / HOURS);
    if (h < 1) return t("admin.work.justNow");
    if (h < 24) return t("admin.work.hours", { n: h });
    return t("admin.work.days", { n: Math.floor(h / 24) });
  };

  return (
    <section>
      <h1
        style={{
          fontFamily: meta.fonts.heading,
          fontSize: ts(26),
          fontWeight: 800,
          color: C.brown,
          lineHeight: meta.dir === "rtl" ? meta.lineHeight : 1.25,
          margin: "0 0 4px",
        }}
      >
        {t("admin.work.title")}
      </h1>
      <p style={{ fontSize: ts(A11Y.minBodyPx), color: C.textMuted, margin: "0 0 18px" }}>
        {t("admin.work.intro")}
      </p>

      {rows === null && <p role="status" style={{ fontSize: ts(A11Y.minBodyPx), color: C.textMuted }}>…</p>}

      {/* A clear desk says so, warmly, and stops. */}
      {rows !== null && rows.length === 0 && (
        <p data-worklist="clear" style={{ fontSize: ts(20), fontWeight: 700, color: C.green, margin: 0 }}>
          {t("admin.work.clear")}
        </p>
      )}

      {(rows || []).map((r) => (
        <Link
          key={r.id}
          to={r.to}
          data-work={r.kind}
          data-urgent={r.urgent ? "yes" : "no"}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            minHeight: 64,
            padding: "10px 16px",
            marginBottom: 8,
            background: C.white,
            border: r.urgent ? `2.5px solid ${C.brown}` : `1px solid ${C.warmGray}`,
            borderRadius: 16,
            color: C.textMain,
            textDecoration: "none",
          }}
        >
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "block", fontSize: ts(A11Y.minBodyPx), fontWeight: 700 }}>
              {t(`admin.work.kind.${r.kind}`)}
            </span>
            {/* Never urgency by colour alone (§0.2): the words say it. */}
            <span style={{ display: "block", fontSize: ts(A11Y.minBodyPx), color: C.textMuted }}>
              {r.urgent ? `${t("admin.work.waiting")} · ${waited(r.at)}` : waited(r.at)}
            </span>
          </span>
          <span aria-hidden="true" style={{ color: C.green, fontWeight: 700, fontSize: ts(20) }}>
            {meta.dir === "rtl" ? "‹" : "›"}
          </span>
        </Link>
      ))}
    </section>
  );
}
