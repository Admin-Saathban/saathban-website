/* ════════════════════════════════════════════════
   /app/admin/welfare — welfare check-ins.

   CLAUDE.md: "Consecutive low-mood days quietly flag staff for human
   outreach … this is the mood log's real purpose." This is where staff
   see that, and record that somebody reached out.

   WHAT IS SHOWN is decided by the database, not here (0183, 0184):
   a name, how many low days in a row, since when, the most recent low
   day, when the person was told about check-ins, the last attempt, and
   how to reach them through routes the admin level can already see
   (email for support and super; phone for super only). Never a mood,
   a note the person wrote, or any other log. Reading those stays
   break-glass (0187): a super-admin sees a link to that separate
   screen, which asks why, reads a short window, and tells the person.

   Support and super-admins. A moderator is kept out by the route guard
   and refused by the database.

   OPENED ON THE RECORD, ONCE PER VISIT. Mounting calls
   admin_welfare_list, which writes one audit entry naming the people
   listed. Recording a check-in writes its own entry; the list is then
   updated in place rather than fetched again, so one visit is one
   "opened" line in the audit log.

   Wide (SPLIT_QUERY): the list, with the chosen person beside it.
   Narrow: one column; a person replaces the list and back returns.
   ════════════════════════════════════════════════ */

import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { APP_COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import supabase from "../../lib/supabase.js";
import useBackToClose from "../../components/useBackToClose.js";
import useMedia, { SPLIT_QUERY } from "./useMedia.js";
import { Card, AdminBtn, fmtDateTime } from "./ui.jsx";
import { PageTitle, Notice, inputStyle, fmtDay } from "./adminBits.jsx";

const OUTCOMES = ["spoke", "no_answer", "not_needed"];
const NOTE_MAX = 500;

const refused = (e) => e?.code === "42501" || /not allowed|permission denied/i.test(e?.message || "");
const notListed = (e) => e?.hint === "welfare_not_listed" || /not on the welfare list/i.test(e?.message || "");

export default function WelfarePage() {
  const { t, meta } = useI18n();
  const { refreshDashboard } = useOutletContext();
  const wide = useMedia(SPLIT_QUERY);

  const [rows, setRows] = useState(null);
  const [phoneVisible, setPhoneVisible] = useState(false);
  const [openMsg, setOpenMsg] = useState(null);
  const [msg, setMsg] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  const openedOnce = useRef(false);
  const open = useCallback(async () => {
    setOpenMsg(null);
    const { data, error } = await supabase.rpc("admin_welfare_list");
    if (error) {
      setOpenMsg({ kind: "err", text: t(refused(error) ? "welfare.admin.notAllowed" : "welfare.admin.openFailed") });
      return;
    }
    setRows(data?.rows || []);
    setPhoneVisible(Boolean(data?.phone_visible));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    /* The ref holds across StrictMode's rehearsal remount, so development
       does not write two audit entries. */
    if (openedOnce.current) return;
    openedOnce.current = true;
    open();
  }, [open]);

  const selected = (rows || []).find((r) => r.icon_id === selectedId) || null;
  const close = useCallback(() => setSelectedId(null), []);
  useBackToClose(!wide && Boolean(selected), close);

  /* Back on a phone: focus returns to the person that was open. */
  const lastOpen = useRef(null);
  useEffect(() => {
    if (selectedId) {
      lastOpen.current = selectedId;
      return;
    }
    if (lastOpen.current) {
      const el = document.querySelector(`[data-welfare-row="${lastOpen.current}"]`);
      if (el) el.focus();
    }
  }, [selectedId]);

  const nameOf = (r) => r?.name || t("welfare.admin.unnamed");

  const onRecorded = (row, res, outcome, note, byName) => {
    if (!res.still_listed) {
      setRows((prev) => prev.filter((r) => r.icon_id !== row.icon_id));
      setSelectedId(null);
      setMsg({ kind: "ok", text: t("welfare.admin.record.savedGone", { name: nameOf(row) }) });
    } else {
      setRows((prev) =>
        prev.map((r) =>
          r.icon_id === row.icon_id
            ? { ...r, last_outreach: { at: res.handled_at, outcome, note: note || null, by_name: byName } }
            : r
        )
      );
      setMsg({ kind: "ok", text: t("welfare.admin.record.savedStays", { name: nameOf(row) }) });
    }
    refreshDashboard?.();
  };

  const onGone = (row) => {
    setRows((prev) => prev.filter((r) => r.icon_id !== row.icon_id));
    setSelectedId(null);
    setMsg({ kind: "err", text: t("welfare.admin.record.notListed", { name: nameOf(row) }) });
    refreshDashboard?.();
  };

  if (rows === null) {
    return (
      <div style={{ maxWidth: 980 }} data-admin-desk="welfare">
        <PageTitle title={t("welfare.admin.title")} />
        {openMsg ? (
          <>
            <Notice msg={openMsg} />
            <AdminBtn onClick={open}>{t("admin.tryAgain")}</AdminBtn>
          </>
        ) : (
          <p role="status" style={{ color: C.textMuted }}>
            {t("welfare.admin.opening")}
          </p>
        )}
      </div>
    );
  }

  const split = wide && Boolean(selected);
  const lh = meta.dir === "rtl" ? 1.9 : 1.5;

  const list = (
    <div data-welfare-list={split ? "compact" : "full"} style={{ maxWidth: split ? "none" : 980 }}>
      <PageTitle title={t("welfare.admin.title")} intro={split ? null : t("welfare.admin.intro")} />
      {!split && (
        <p style={{ color: C.textMuted, margin: "-12px 0 20px", maxWidth: 760, lineHeight: 1.55 }}>{t("welfare.admin.rule")}</p>
      )}
      <Notice msg={msg} />

      {rows.length === 0 ? (
        <Card>
          <p data-welfare="empty" style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 700, color: C.green, lineHeight: lh }}>
            ✓ {t("welfare.admin.empty")}
          </p>
          <p style={{ margin: 0, color: C.textMuted, lineHeight: lh }}>{t("welfare.admin.emptyNote")}</p>
        </Card>
      ) : (
        <>
          <div role="status" style={{ color: C.textMuted, fontWeight: 700, margin: "0 0 10px" }}>
            {t(rows.length === 1 ? "welfare.admin.countOne" : "welfare.admin.countMany", { n: rows.length })}
          </div>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
            {rows.map((r) => {
              const isSel = r.icon_id === selectedId;
              const tried = r.last_outreach?.outcome === "no_answer";
              return (
                <li key={r.icon_id}>
                  <button
                    type="button"
                    data-welfare-row={r.icon_id}
                    aria-current={isSel ? "true" : undefined}
                    onClick={() => setSelectedId(r.icon_id)}
                    style={{
                      display: "block",
                      width: "100%",
                      minHeight: A11Y.minTapTargetPx,
                      textAlign: "start",
                      padding: "12px 16px",
                      border: isSel ? `2.5px solid ${C.green}` : `1px solid ${C.warmGray}`,
                      borderInlineStart: `5px solid ${isSel ? C.green : C.brown}`,
                      borderRadius: 10,
                      background: isSel ? C.selected : C.white,
                      color: C.textMain,
                      fontFamily: "inherit",
                      fontSize: 18,
                      lineHeight: lh,
                      cursor: "pointer",
                    }}
                  >
                    <span style={{ display: "block", fontWeight: 800, fontSize: 20, overflowWrap: "anywhere" }}>
                      {isSel && <span aria-hidden="true">▸ </span>}
                      {nameOf(r)}
                    </span>
                    <span style={{ display: "block" }}>
                      {t(r.low_days === 1 ? "welfare.admin.daysOne" : "welfare.admin.daysMany", { n: r.low_days })}
                      {" · "}
                      {t("welfare.admin.since", { date: fmtDay(r.since) })}
                    </span>
                    {tried && (
                      <span style={{ display: "block", color: C.brown, fontWeight: 700 }}>
                        ↻ {t("welfare.admin.tried", { date: fmtDateTime(r.last_outreach.at) })}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );

  return (
    <div className="sb-adm-split" data-split={split ? "yes" : "no"} data-admin-desk="welfare">
      {(wide || !selected) && <div className="sb-adm-split-list">{list}</div>}
      {selected && (
        <div className="sb-adm-split-detail">
          <PersonDetail
            key={selected.icon_id}
            row={selected}
            name={nameOf(selected)}
            wide={wide}
            phoneVisible={phoneVisible}
            onClose={close}
            onRecorded={onRecorded}
            onGone={onGone}
          />
        </div>
      )}
    </div>
  );
}

function PersonDetail({ row, name, wide, phoneVisible, onClose, onRecorded, onGone }) {
  const { t, meta } = useI18n();
  const { admin } = useOutletContext();
  const headingRef = useRef(null);
  const [outcome, setOutcome] = useState(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const lh = meta.dir === "rtl" ? 1.9 : 1.6;

  useEffect(() => {
    headingRef.current?.focus();
  }, [row.icon_id]);

  const last = row.last_outreach;

  const save = async () => {
    if (!outcome) {
      setMsg({ kind: "err", text: t("welfare.admin.record.pick") });
      return;
    }
    setBusy(true);
    setMsg(null);
    const trimmed = note.trim().slice(0, NOTE_MAX);
    const { data, error } = await supabase.rpc("admin_welfare_record", {
      p_icon: row.icon_id,
      p_outcome: outcome,
      p_note: trimmed || null,
    });
    setBusy(false);
    if (error) {
      if (notListed(error)) {
        onGone(row);
        return;
      }
      setMsg({ kind: "err", text: t("welfare.admin.record.failed") });
      return;
    }
    setOutcome(null);
    setNote("");
    onRecorded(row, data, outcome, trimmed, admin?.name || null);
  };

  return (
    <Card>
      <div data-welfare-detail={row.icon_id}>
        <div style={{ display: "flex", justifyContent: wide ? "flex-end" : "flex-start", marginBottom: 6 }}>
          <AdminBtn kind="ghost" onClick={onClose}>
            {wide ? t("welfare.admin.close") : t("welfare.admin.back")}
          </AdminBtn>
        </div>
        <h2
          ref={headingRef}
          tabIndex={-1}
          style={{ fontSize: 26, fontWeight: 800, color: C.green, lineHeight: meta.dir === "rtl" ? 1.9 : 1.3, margin: "0 0 14px", outline: "none", overflowWrap: "anywhere" }}
        >
          {name}
        </h2>

        <dl style={{ margin: 0, display: "grid", gap: 14 }}>
          <Fact label={t("welfare.admin.f.run")}>
            <span style={{ display: "block", fontWeight: 700 }}>
              {t(row.low_days === 1 ? "welfare.admin.daysOne" : "welfare.admin.daysMany", { n: row.low_days })}
              {" · "}
              {t("welfare.admin.since", { date: fmtDay(row.since) })}
            </span>
            <span style={{ display: "block", color: C.textMuted }}>{t("welfare.admin.lastLow", { date: fmtDay(row.last_low) })}</span>
          </Fact>
          <Fact label={t("welfare.admin.f.told")}>{fmtDateTime(row.told_at)}</Fact>
          <Fact label={t("welfare.admin.f.reach")}>
            {row.email && (
              <span style={{ display: "block", overflowWrap: "anywhere" }}>
                <strong>{t("welfare.admin.f.email")}:</strong>{" "}
                <a href={`mailto:${row.email}`} style={{ color: C.green, fontWeight: 700, display: "inline-flex", alignItems: "center", minHeight: A11Y.minTapTargetPx }}>
                  {row.email}
                </a>
              </span>
            )}
            {phoneVisible ? (
              row.phone ? (
                <span style={{ display: "block" }}>
                  <strong>{t("welfare.admin.f.phone")}:</strong>{" "}
                  <a href={`tel:${row.phone}`} dir="ltr" style={{ color: C.green, fontWeight: 700, display: "inline-flex", alignItems: "center", minHeight: A11Y.minTapTargetPx }}>
                    {row.phone}
                  </a>
                </span>
              ) : (
                <span style={{ display: "block", color: C.textMuted }}>{t("welfare.admin.f.noPhone")}</span>
              )
            ) : (
              <span style={{ display: "block", color: C.textMuted }}>{t("welfare.admin.f.phoneHidden")}</span>
            )}
            <Link
              to={`/app/admin/people/${row.icon_id}`}
              style={{ display: "inline-flex", alignItems: "center", minHeight: A11Y.minTapTargetPx, color: C.green, fontWeight: 700 }}
            >
              {t("welfare.admin.f.openPerson")}
            </Link>
            {admin?.level === "super" && (
              <span style={{ display: "block", marginTop: 4 }}>
                <Link
                  to={`/app/admin/break-glass/${row.icon_id}?from=welfare`}
                  data-welfare-break-glass
                  style={{ display: "inline-flex", alignItems: "center", minHeight: A11Y.minTapTargetPx, color: C.brown, fontWeight: 700 }}
                >
                  {t("admin.breakGlass.welfareLink")}
                </Link>
                <span style={{ display: "block", color: C.textMuted, fontSize: 15 }}>{t("admin.breakGlass.welfareNote")}</span>
              </span>
            )}
          </Fact>
          <Fact label={t("welfare.admin.f.last")}>
            {last ? (
              <>
                <span style={{ display: "block", fontWeight: 700 }}>
                  {t(`welfare.admin.outcome.${last.outcome}`)} · {fmtDateTime(last.at)}
                  {last.by_name ? ` · ${t("welfare.admin.f.by", { name: last.by_name })}` : ""}
                </span>
                {last.note && (
                  <span style={{ display: "block", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                    <strong>{t("welfare.admin.f.note")}:</strong> {last.note}
                  </span>
                )}
              </>
            ) : (
              <span style={{ color: C.textMuted }}>{t("welfare.admin.f.none")}</span>
            )}
          </Fact>
        </dl>

        <fieldset
          data-welfare-record
          style={{ border: `2px solid ${C.warmGray}`, borderRadius: 12, padding: "12px 16px 16px", margin: "22px 0 0", minWidth: 0 }}
        >
          <legend style={{ fontSize: 21, fontWeight: 800, color: C.green, padding: "0 6px", lineHeight: lh }}>
            {t("welfare.admin.record.title")}
          </legend>
          <div role="radiogroup" aria-label={t("welfare.admin.record.what")} style={{ display: "grid", gap: 8, margin: "4px 0 12px" }}>
            <span style={{ fontWeight: 700, fontSize: 16 }}>{t("welfare.admin.record.what")}</span>
            {OUTCOMES.map((o) => {
              const on = outcome === o;
              return (
                <label
                  key={o}
                  data-welfare-outcome={o}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    minHeight: A11Y.minTapTargetPx,
                    padding: "6px 14px",
                    borderRadius: 10,
                    border: on ? `2.5px solid ${C.green}` : `1px solid ${C.warmGray}`,
                    background: on ? C.selected : C.white,
                    cursor: "pointer",
                    fontWeight: on ? 800 : 600,
                    lineHeight: lh,
                  }}
                >
                  <input
                    type="radio"
                    name={`welfare-outcome-${row.icon_id}`}
                    value={o}
                    checked={on}
                    onChange={() => setOutcome(o)}
                    style={{ width: 24, height: 24, margin: 0, accentColor: C.green, flex: "0 0 auto" }}
                  />
                  <span>{t(`welfare.admin.outcome.${o}`)}</span>
                </label>
              );
            })}
            {outcome && (
              <p role="status" style={{ margin: "2px 0 0", color: C.textMuted, lineHeight: lh }}>
                {t(`welfare.admin.record.hint.${outcome}`)}
              </p>
            )}
          </div>

          <label style={{ display: "block", marginBottom: 12 }}>
            <span style={{ display: "block", fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{t("welfare.admin.record.noteLabel")}</span>
            <textarea
              value={note}
              maxLength={NOTE_MAX}
              rows={3}
              onChange={(e) => setNote(e.target.value)}
              data-welfare-note
              style={{ ...inputStyle, padding: "10px 14px", minHeight: 96, resize: "vertical", lineHeight: lh }}
            />
            <span style={{ display: "flex", justifyContent: "space-between", gap: 12, color: C.textMuted, fontSize: 15, marginTop: 4, lineHeight: lh }}>
              <span>{t("welfare.admin.record.noteHint")}</span>
              <span aria-hidden="true" style={{ flex: "0 0 auto" }}>{t("welfare.admin.record.noteCount", { n: note.length })}</span>
            </span>
          </label>

          <Notice msg={msg} />
          <AdminBtn kind="primary" onClick={save} disabled={busy}>
            {busy ? t("welfare.admin.record.saving") : t("welfare.admin.record.save")}
          </AdminBtn>
        </fieldset>
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
