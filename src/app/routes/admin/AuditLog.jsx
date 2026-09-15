/* ════════════════════════════════════════════════
   /app/admin/audit — the audit log, read on the record.

   WHO SEES WHAT is decided by the database (0179, 0180), not here:
     super-admin          every entry
     support / moderator  only entries where THEY are the one who acted
                          ("My actions" in the navigation)
   The screen passes filters; admin_audit_entries forces the actor to the
   caller for anyone below super, whatever the screen sends.

   OPENING IS ON THE RECORD, ONCE. Mounting this screen calls
   admin_audit_open, which writes one 'audit_log_opened' entry and hands
   back its id. Every read passes that id; the database refuses a read
   without a fresh opening of the caller's own. Page turns and filter
   changes reuse it and write nothing — except a super-admin narrowing to
   one person, which the database records once per person per opening
   (everything done about a person is a record of that person). Opening
   from a person's page puts the person on the opening entry itself.

   Rows are kept for good. There is no export and nothing here deletes.

   Wide (SPLIT_QUERY): the list, with the chosen entry's details beside
   it. Narrow: one column; an entry replaces the list and back returns.
   ════════════════════════════════════════════════ */

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { Link, useOutletContext, useSearchParams } from "react-router-dom";
import { APP_COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import supabase from "../../lib/supabase.js";
import useBackToClose from "../../components/useBackToClose.js";
import { ROLE_DISPLAY } from "../../constants/roles.js";
import useMedia, { SPLIT_QUERY } from "./useMedia.js";
import { Card, AdminBtn, fmtDateTime } from "./ui.jsx";
import { PageTitle, Notice, inputStyle, FootprintList, fmtDay } from "./adminBits.jsx";
import { statusLabel } from "./data.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAGE = 30;

/* Every action name the database writes (grep write_audit( and
   audit_log inserts in supabase/migrations), grouped for the filter.
   A name missing here still shows, as "recorded as …". */
export const AUDIT_KINDS = [
  ["looking", ["admin_view_person", "admin_list_people", "admin_preview_deletion", "admin_view_content", "admin_view_test_data", "grow_survey_people_read", "survey_results_read", "survey_results_exported"]],
  ["breakGlass", ["break_glass_read_logs"]],
  ["accounts", ["pause_account", "unpause_account", "change_role", "mark_test", "unmark_test", "send_signin_link", "delete_account", "delete_test_account", "remove_test_accounts", "files_removed"]],
  ["reports", ["moderation_decision", "content_hidden", "content_unhidden", "content_removed"]],
  ["vetting", ["buddy_status_change", "document_request"]],
  ["reach", ["admin_contact", "admin_broadcast", "question_reply", "milestone_message"]],
  ["grow", ["grow_course_created", "grow_course_updated", "grow_course_published", "grow_course_unpublished", "grow_survey_created", "grow_survey_updated", "grow_survey_published", "grow_survey_unpublished", "grow_survey_reoffered", "grow_pending_added", "grow_pending_updated", "grow_pending_removed", "grow_pending_reordered"]],
  ["auditLog", ["audit_log_opened", "audit_log_person_viewed"]],
];

async function rpc(name, args) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw error;
  return data;
}

const needsReopen = (e) => e?.hint === "audit_opening" || /open the audit log again/i.test(e?.message || "");
const refused = (e) => e?.code === "42501" || /not allowed|permission denied/i.test(e?.message || "");

/* "2026-09-15" from a date input → the instant that day starts here. */
function dayStartIso(ymd, addDays = 0) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d + addDays).toISOString();
}

/* A template with {names} → text and nodes, so names can be bold. */
function fill(template, parts) {
  return template.split(/(\{\w+\})/).map((bit, i) => {
    const m = /^\{(\w+)\}$/.exec(bit);
    if (!m) return bit;
    const v = parts[m[1]];
    return <Fragment key={i}>{v === undefined || v === null ? "" : v}</Fragment>;
  });
}

function useWords() {
  const { t, lang } = useI18n();
  const has = (path) => t(path) !== path;
  const level = (l) => (l === "super" ? t("admin.levelSuper") : l === "moderator" ? t("admin.levelModerator") : l ? t("admin.levelSupport") : "");
  const role = (r, l) => (!r ? "—" : r === "admin" ? `${ROLE_DISPLAY.admin} · ${level(l || "support")}` : ROLE_DISPLAY[r] || r);

  /* 0181: a deleted staff account keeps the name it had when the entry
     was written (actor.gone). Only an entry with no actor at all is the
     system. */
  const actorName = (row) => {
    if (!row.actor) return t("admin.audit.system");
    if (row.actor.gone) return t("admin.audit.actorDeleted", { name: row.actor.name || t("admin.audit.noName") });
    return row.actor.name || t("admin.audit.noName");
  };

  const personName = (p) => {
    if (!p) return t("admin.audit.personGone");
    if (p.state === "gone") return p.name ? t("admin.audit.accountDeleted", { name: p.name }) : t("admin.audit.personGone");
    if (p.state === "signup" && !p.name) return t("admin.audit.unfinishedSignup");
    return p.name || t("admin.people.unnamed");
  };

  const statusWord = (action, s) => {
    if (s === null || s === undefined) return "—";
    if (action === "buddy_status_change") return statusLabel(s, t);
    if (action === "moderation_decision") return has(`admin.audit.reportTo.${s}`) ? t(`admin.audit.reportTo.${s}`) : s;
    return has(`admin.audit.status.${s}`) ? t(`admin.audit.status.${s}`) : s;
  };

  const kindWord = (k) => (has(`admin.audit.kind.${k}`) ? t(`admin.audit.kind.${k}`) : k || "—");

  /* The sentence for one entry. */
  const line = (row) => {
    const d = row.detail || {};
    const s = row.subject || {};
    const a = row.action;
    const course = (lang === "ur" && s.course_ur) || s.course_en || t("admin.audit.aCourse");
    const survey = (lang === "ur" && s.survey_ur) || s.survey_en || t("admin.audit.aSurvey");
    const vars = {
      who: <strong>{actorName(row)}</strong>,
      person: <strong>{personName(row.person)}</strong>,
      action: a,
      buddy: ROLE_DISPLAY.saath_buddy,
      course: <strong>{course}</strong>,
      survey: <strong>{survey}</strong>,
    };
    let key = a;
    switch (a) {
      case "admin_list_people":
        if (d.query) key = "admin_list_people_search";
        vars.query = d.query;
        vars.rows = d.rows ?? 0;
        break;
      case "remove_test_accounts":
        vars.n = d.accounts ?? 0;
        break;
      case "admin_view_test_data":
        vars.n = d.accounts ?? 0;
        break;
      case "files_removed":
        vars.removed = d.removed ?? 0;
        vars.remaining = Array.isArray(d.remaining) ? d.remaining.length : 0;
        break;
      case "change_role":
        vars.from = role(d.from_role, d.from_level);
        vars.to = role(d.to_role, d.to_level);
        break;
      case "admin_broadcast":
        vars.n = d.recipients ?? 0;
        vars.audience = d.role ? ROLE_DISPLAY[d.role] || d.role : t("admin.audit.everyone");
        break;
      case "buddy_status_change":
      case "moderation_decision":
      case "grow_course_unpublished":
      case "grow_survey_unpublished":
        vars.from = statusWord(a, d.from);
        vars.to = statusWord(a, d.to);
        break;
      case "content_hidden":
      case "content_unhidden":
      case "content_removed":
        vars.kind = kindWord(d.kind);
        break;
      case "grow_survey_people_read":
        vars.n = d.people ?? 0;
        break;
      case "grow_survey_reoffered":
        if (d.to === "everyone_who_dismissed") key = "grow_survey_reoffered_everyone";
        vars.n = d.people ?? 0;
        break;
      case "grow_pending_added":
      case "grow_pending_updated":
      case "grow_pending_removed":
        vars.thing = <strong>{s.course_en ? course : s.survey_en ? survey : d.skill || t("admin.audit.anItem")}</strong>;
        break;
      case "audit_log_opened":
        if (d.profile_id) key = "audit_log_opened_person";
        else if (d.scope === "own") key = "audit_log_opened_own";
        break;
      default:
    }
    const path = `admin.audit.line.${key}`;
    return fill(has(path) ? t(path) : t("admin.audit.line.unknown"), vars);
  };

  return { t, lang, has, level, role, actorName, personName, statusWord, kindWord, line };
}

export default function AuditLog() {
  const w = useWords();
  const { t } = w;
  const { admin } = useOutletContext();
  const isSuper = admin.level === "super";
  const [params, setParams] = useSearchParams();
  const personParam = params.get("person");
  const person = personParam && UUID.test(personParam) ? personParam : null;
  const wide = useMedia(SPLIT_QUERY);

  const [opening, setOpening] = useState(null); // { opening, scope, staff, person }
  const [openMsg, setOpenMsg] = useState(null);
  const [kind, setKind] = useState("all");
  const [actor, setActor] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [rows, setRows] = useState(null);
  const [more, setMore] = useState(false);
  const [personInfo, setPersonInfo] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [msg, setMsg] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const reopened = useRef(0);

  /* ONE opening per visit. The ref holds across StrictMode's rehearsal
     remount, so development does not write two. */
  const openedOnce = useRef(false);
  const open = useCallback(async () => {
    try {
      setOpenMsg(null);
      setOpening(await rpc("admin_audit_open", { p_person: person }));
    } catch (e) {
      setOpenMsg({ kind: "err", text: t(refused(e) ? "admin.audit.notAllowed" : "admin.audit.openFailed") });
    }
    // The person at the moment of opening; later changes are recorded by the read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (openedOnce.current) return;
    openedOnce.current = true;
    open();
  }, [open]);

  const args = useCallback(
    (extra) => ({
      p_opening: opening?.opening,
      p_actions: kind === "all" ? null : (AUDIT_KINDS.find(([k]) => k === kind) || [null, null])[1],
      p_actor: isSuper && actor ? actor : null,
      p_person: person,
      p_from: from ? dayStartIso(from) : null,
      p_to: to ? dayStartIso(to, 1) : null,
      p_limit: PAGE,
      ...extra,
    }),
    [opening, kind, actor, person, from, to, isSuper]
  );

  /* First page whenever the filters change. */
  useEffect(() => {
    if (!opening) return undefined;
    let live = true;
    setRows(null);
    setMsg(null);
    (async () => {
      try {
        const data = await rpc("admin_audit_entries", args());
        if (!live) return;
        setRows(data.rows || []);
        setMore(Boolean(data.more));
        setPersonInfo(data.person || null);
      } catch (e) {
        if (!live) return;
        if (needsReopen(e) && reopened.current < 1) {
          reopened.current += 1;
          open();
          return;
        }
        setRows([]);
        setMore(false);
        setMsg({ kind: "err", text: t(refused(e) ? "admin.audit.notAllowed" : "admin.audit.loadFailed") });
      }
    })();
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [args]);

  const loadMore = async () => {
    const last = rows && rows[rows.length - 1];
    if (!last) return;
    setLoadingMore(true);
    try {
      const data = await rpc("admin_audit_entries", args({ p_before_at: last.at, p_before_id: last.id }));
      setRows((prev) => [...prev, ...(data.rows || [])]);
      setMore(Boolean(data.more));
    } catch (e) {
      setMsg({ kind: "err", text: t("admin.audit.loadFailed") });
    } finally {
      setLoadingMore(false);
    }
  };

  const setPerson = (id) => {
    const next = new URLSearchParams(params);
    if (id) next.set("person", id);
    else next.delete("person");
    setParams(next, { replace: true });
  };

  const selected = (rows || []).find((r) => r.id === selectedId) || null;
  const close = useCallback(() => setSelectedId(null), []);
  useBackToClose(!wide && Boolean(selected), close);

  /* Back on a phone: return focus to the entry that was open. */
  const lastOpen = useRef(null);
  useEffect(() => {
    if (selectedId) {
      lastOpen.current = selectedId;
      return;
    }
    if (lastOpen.current) {
      const el = document.querySelector(`[data-audit-row="${lastOpen.current}"]`);
      if (el) el.focus();
    }
  }, [selectedId]);

  const filtered = kind !== "all" || Boolean(actor) || Boolean(person) || Boolean(from) || Boolean(to);
  const freshStart =
    rows !== null && !filtered && !more && rows.every((r) => r.action === "audit_log_opened" && r.actor?.id === admin.id);
  const own = opening ? opening.scope === "own" : !isSuper;
  const split = wide && Boolean(selected);

  if (!opening) {
    return (
      <div style={{ maxWidth: 980 }}>
        <PageTitle title={t(own ? "admin.audit.titleOwn" : "admin.audit.title")} />
        {openMsg ? (
          <>
            <Notice msg={openMsg} />
            <AdminBtn onClick={open}>{t("admin.tryAgain")}</AdminBtn>
          </>
        ) : (
          <p role="status" style={{ color: C.textMuted }}>{t("admin.audit.opening")}</p>
        )}
      </div>
    );
  }

  const list = (
    <div data-audit-list={split ? "compact" : "full"} style={{ maxWidth: split ? "none" : 1100 }}>
      <PageTitle
        title={t(own ? "admin.audit.titleOwn" : "admin.audit.title")}
        intro={split ? null : t(own ? "admin.audit.introOwn" : "admin.audit.introAll")}
      />
      <Filters
        w={w}
        isSuper={isSuper}
        compact={split}
        staff={opening.staff || []}
        kind={kind}
        setKind={setKind}
        actor={actor}
        setActor={setActor}
        from={from}
        setFrom={setFrom}
        to={to}
        setTo={setTo}
        person={person}
        personInfo={personInfo || opening.person}
        clearPerson={() => setPerson(null)}
        filtered={filtered}
        clearAll={() => {
          setKind("all");
          setActor("");
          setFrom("");
          setTo("");
          setPerson(null);
        }}
      />
      <Notice msg={msg} />

      {freshStart && (
        <section
          data-audit-fresh
          style={{ border: `2px solid ${C.green}`, background: C.selected, borderRadius: 12, padding: "14px 18px", marginBottom: 16 }}
        >
          <strong style={{ display: "block", color: C.green, fontSize: 20, marginBottom: 4 }}>{t("admin.audit.freshTitle")}</strong>
          <span style={{ lineHeight: 1.6 }}>{t(own ? "admin.audit.freshBodyOwn" : "admin.audit.freshBody")}</span>
        </section>
      )}

      <div role="status" style={{ color: C.textMuted, fontWeight: 700, margin: "0 0 10px" }}>
        {rows === null ? t("admin.audit.loading") : more ? t("admin.audit.countMore", { n: rows.length }) : t("admin.audit.count", { n: rows.length })}
      </div>

      {rows !== null && rows.length === 0 && (
        <Card>
          <p style={{ margin: 0 }}>{filtered ? t("admin.audit.noMatch") : t("admin.audit.freshBody")}</p>
        </Card>
      )}

      {rows !== null && rows.length > 0 && (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
          {rows.map((row) => {
            const isSel = row.id === selectedId;
            return (
              <li key={row.id}>
                <button
                  type="button"
                  data-audit-row={row.id}
                  data-audit-action={row.action}
                  aria-current={isSel ? "true" : undefined}
                  onClick={() => setSelectedId(row.id)}
                  style={{
                    display: "block",
                    width: "100%",
                    minHeight: A11Y.minTapTargetPx,
                    textAlign: "start",
                    padding: "12px 16px",
                    border: isSel ? `2.5px solid ${C.green}` : `1px solid ${C.warmGray}`,
                    borderInlineStart: `5px solid ${isSel ? C.green : "transparent"}`,
                    borderRadius: 10,
                    background: isSel ? C.selected : C.white,
                    color: C.textMain,
                    fontFamily: "inherit",
                    fontSize: 18,
                    lineHeight: w.lang === "ur" ? 1.9 : 1.5,
                    cursor: "pointer",
                  }}
                >
                  <span style={{ display: "block", overflowWrap: "anywhere" }}>
                    {isSel && <span aria-hidden="true">▸ </span>}
                    {w.line(row)}
                  </span>
                  <span style={{ display: "block", color: C.textMuted, fontSize: 16, marginTop: 2 }}>{fmtDateTime(row.at)}</span>
                  {row.reason && (
                    <span style={{ display: "block", fontSize: 16, marginTop: 4, overflowWrap: "anywhere", whiteSpace: "pre-wrap" }}>
                      <strong>{t("admin.audit.reasonLabel")}:</strong> {row.reason}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {more && (
        <div style={{ marginTop: 14 }}>
          <AdminBtn onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? t("admin.audit.loadingMore") : t("admin.audit.loadMore")}
          </AdminBtn>
        </div>
      )}
    </div>
  );

  return (
    <div className="sb-adm-split" data-split={split ? "yes" : "no"} data-admin-desk="audit">
      {(wide || !selected) && <div className="sb-adm-split-list">{list}</div>}
      {selected && (
        <div className="sb-adm-split-detail">
          <EntryDetail
            w={w}
            row={selected}
            admin={admin}
            wide={wide}
            onClose={close}
            onOnlyActor={(id) => {
              setActor(id);
              setSelectedId(null);
            }}
            onOnlyPerson={(id) => {
              setPerson(id);
              setSelectedId(null);
            }}
          />
        </div>
      )}
    </div>
  );
}

function Filters({ w, isSuper, compact, staff, kind, setKind, actor, setActor, from, setFrom, to, setTo, person, personInfo, clearPerson, filtered, clearAll }) {
  const { t } = w;
  const label = { display: "block", fontWeight: 700, fontSize: 16, marginBottom: 4 };
  return (
    <section
      aria-label={t("admin.audit.filters")}
      data-audit-filters
      style={{
        display: "grid",
        gap: 12,
        gridTemplateColumns: compact ? "minmax(0, 1fr)" : "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
        marginBottom: 16,
        alignItems: "end",
      }}
    >
      <label>
        <span style={label}>{t("admin.audit.kindLabel")}</span>
        <select value={kind} onChange={(e) => setKind(e.target.value)} style={inputStyle} data-audit-filter="kind">
          <option value="all">{t("admin.audit.kindAll")}</option>
          {AUDIT_KINDS.map(([k]) => (
            <option key={k} value={k}>
              {t(`admin.audit.kinds.${k}`)}
            </option>
          ))}
        </select>
      </label>
      {isSuper && (
        <label>
          <span style={label}>{t("admin.audit.staffLabel")}</span>
          <select value={actor} onChange={(e) => setActor(e.target.value)} style={inputStyle} data-audit-filter="actor">
            <option value="">{t("admin.audit.staffAll")}</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {(s.name || t("admin.audit.noName")) + (s.level ? ` · ${w.level(s.level)}` : "")}
              </option>
            ))}
          </select>
        </label>
      )}
      <label>
        <span style={label}>{t("admin.audit.fromLabel")}</span>
        <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} style={inputStyle} data-audit-filter="from" />
      </label>
      <label>
        <span style={label}>{t("admin.audit.toLabel")}</span>
        <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} style={inputStyle} data-audit-filter="to" />
      </label>
      {person && (
        <div
          data-audit-person-filter={person}
          style={{
            gridColumn: "1 / -1",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 10,
            padding: "8px 14px",
            border: `2px solid ${C.green}`,
            borderRadius: 10,
            background: C.selected,
          }}
        >
          <span style={{ fontWeight: 700, overflowWrap: "anywhere" }}>
            ✓ {t("admin.audit.personChip", { name: w.personName(personInfo) })}
          </span>
          <AdminBtn kind="ghost" onClick={clearPerson}>
            {t("admin.audit.personClear")}
          </AdminBtn>
        </div>
      )}
      {filtered && (
        <div style={{ gridColumn: "1 / -1" }}>
          <AdminBtn kind="ghost" onClick={clearAll}>
            {t("admin.audit.clear")}
          </AdminBtn>
        </div>
      )}
    </section>
  );
}

/* ── One entry, in full ── */

const SKIP_KEYS = new Set(["profile_id", "author_id", "sender_id", "image_path", "audio_path", "payload", "post_id", "group_id", "place_id", "conversation", "title_en"]);

function EntryDetail({ w, row, admin, wide, onClose, onOnlyActor, onOnlyPerson }) {
  const { t } = w;
  const isSuper = admin.level === "super";
  const canOpenPeople = admin.level === "super" || admin.level === "support";
  const headingRef = useRef(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, [row.id]);

  const p = row.person;
  const facts = factsOf(w, row);

  return (
    <Card style={{ position: "relative" }}>
      <div data-audit-detail={row.id}>
        <div style={{ display: "flex", justifyContent: wide ? "flex-end" : "flex-start", marginBottom: 6 }}>
          <AdminBtn kind="ghost" onClick={onClose}>
            {wide ? t("admin.audit.close") : t("admin.audit.back")}
          </AdminBtn>
        </div>
        <h2
          ref={headingRef}
          tabIndex={-1}
          style={{ fontSize: 22, fontWeight: 600, color: C.textMain, lineHeight: w.lang === "ur" ? 1.9 : 1.45, margin: "0 0 16px", outline: "none", overflowWrap: "anywhere" }}
        >
          {w.line(row)}
        </h2>

        <dl style={{ margin: 0, display: "grid", gap: 14 }}>
          <Fact label={t("admin.audit.when")}>{fmtDateTime(row.at)}</Fact>
          <Fact label={t("admin.audit.who")}>
            <span>
              {w.actorName(row)}
              {row.actor?.level ? ` · ${w.level(row.actor.level)}` : ""}
            </span>
            {!row.actor && <span style={{ display: "block", color: C.textMuted, fontSize: 16 }}>{t("admin.audit.systemNote")}</span>}
            {isSuper && row.actor?.id && (
              <div style={{ marginTop: 6 }}>
                <AdminBtn onClick={() => onOnlyActor(row.actor.id)}>{t("admin.audit.onlyStaff")}</AdminBtn>
              </div>
            )}
          </Fact>
          {(p || /\{person\}/.test(t(`admin.audit.line.${row.action}`))) && (
            <Fact label={t("admin.audit.about")}>
              <span>{w.personName(p)}</span>
              {p && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 6 }}>
                  {isSuper && <AdminBtn onClick={() => onOnlyPerson(p.id)}>{t("admin.audit.onlyPerson")}</AdminBtn>}
                  {canOpenPeople && p.state !== "gone" && (
                    <Link
                      to={`/app/admin/people/${p.id}`}
                      style={{ display: "inline-flex", alignItems: "center", minHeight: A11Y.minTapTargetPx, color: C.green, fontWeight: 700 }}
                    >
                      {t("admin.audit.openPerson")}
                    </Link>
                  )}
                </div>
              )}
            </Fact>
          )}
          <Fact label={t("admin.audit.reasonLabel")}>
            {row.reason ? (
              <span style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{row.reason}</span>
            ) : (
              <span style={{ color: C.textMuted }}>{t("admin.audit.noReason")}</span>
            )}
          </Fact>
        </dl>

        {facts.length > 0 && (
          <details style={{ marginTop: 18 }} data-audit-facts>
            <summary
              style={{ minHeight: A11Y.minTapTargetPx, display: "flex", alignItems: "center", fontWeight: 700, color: C.green, cursor: "pointer" }}
            >
              {t("admin.audit.detailsTitle")}
            </summary>
            <dl style={{ margin: "8px 0 0", display: "grid", gap: 12 }}>
              {facts.map(([k, label, value]) => (
                <Fact key={k} label={label}>
                  {value}
                </Fact>
              ))}
            </dl>
          </details>
        )}
        <p style={{ color: C.textMuted, fontSize: 15, margin: "18px 0 0" }}>{t("admin.audit.entryNo", { id: row.id })}</p>
      </div>
    </Card>
  );
}

function Fact({ label, children }) {
  return (
    <div>
      <dt style={{ fontSize: 15, fontWeight: 700, color: C.textMuted, marginBottom: 2 }}>{label}</dt>
      <dd style={{ margin: 0, fontSize: 18, lineHeight: 1.6, minWidth: 0 }}>{children}</dd>
    </div>
  );
}

const ISO_TIME = /^\d{4}-\d{2}-\d{2}T/;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/* The detail jsonb as [key, label, value] — plain facts, no JSON. */
function factsOf(w, row, detail = row.detail, depth = 0) {
  const { t, has } = w;
  const s = row.subject || {};
  const out = [];
  const labelOf = (k) => (has(`admin.audit.key.${k}`) ? t(`admin.audit.key.${k}`) : k.replace(/_/g, " "));
  const yesNo = (b) => t(b ? "admin.audit.yes" : "admin.audit.no");

  for (const [k, v] of Object.entries(detail || {})) {
    if (SKIP_KEYS.has(k) || v === null || v === undefined || v === "") continue;
    let value;
    if (k === "course_id") value = (w.lang === "ur" && s.course_ur) || s.course_en || shortId(v);
    else if (k === "survey_id") value = (w.lang === "ur" && s.survey_ur) || s.survey_en || shortId(v);
    else if (k === "footprint" && typeof v === "object") value = <FootprintList footprint={v} />;
    else if (k === "snapshot" && typeof v === "object" && depth === 0) {
      const inner = factsOf(w, row, v, 1);
      if (!inner.length) continue;
      value = (
        <dl style={{ margin: "4px 0 0", paddingInlineStart: 14, borderInlineStart: `3px solid ${C.warmGray}`, display: "grid", gap: 10 }}>
          {inner.map(([ik, il, iv]) => (
            <Fact key={ik} label={il}>
              {iv}
            </Fact>
          ))}
        </dl>
      );
    } else if (k === "scope") value = has(`admin.audit.scope.${v}`) ? t(`admin.audit.scope.${v}`) : String(v);
    else if (k === "role" || k === "from_role" || k === "to_role") value = ROLE_DISPLAY[v] || String(v);
    else if (k === "admin_level" || k === "from_level" || k === "to_level") value = w.level(v);
    else if (k === "kind" || k === "target_kind" || k === "post_type") value = w.kindWord(v);
    else if (k === "from" || k === "to") {
      if (row.action === "grow_survey_reoffered") value = has(`admin.audit.reoffer.${v}`) ? t(`admin.audit.reoffer.${v}`) : String(v);
      else value = w.statusWord(row.action, v);
    } else if (k === "mode") value = has(`admin.audit.mode.${v}`) ? t(`admin.audit.mode.${v}`) : String(v);
    else if (k === "audience" && Array.isArray(v)) value = v.length ? v.map((r) => ROLE_DISPLAY[r] || r).join(", ") : t("admin.audit.everyone");
    else if (k === "fields" && Array.isArray(v)) value = v.map((f) => String(f).replace(/_/g, " ")).join(", ");
    else if (Array.isArray(v)) value = t("admin.audit.itemsN", { n: v.length });
    else if (typeof v === "boolean") value = yesNo(v);
    else if (typeof v === "object") value = t("admin.audit.itemsN", { n: Object.keys(v).length });
    else if (typeof v === "string" && UUID.test(v)) value = shortId(v);
    else if (typeof v === "string" && ISO_TIME.test(v)) value = fmtDateTime(v);
    else if (typeof v === "string" && ISO_DAY.test(v)) value = fmtDay(v);
    else value = <span style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{String(v)}</span>;
    out.push([k, labelOf(k), value]);
  }
  return out;
}

function shortId(v) {
  const s = String(v);
  return (
    <span title={s} style={{ fontVariantNumeric: "tabular-nums" }}>
      {s.slice(0, 8)}…
    </span>
  );
}
