/* ════════════════════════════════════════════════
   /app/admin/test-data — test accounts, and a reviewed way to clear them.

   admin_test_data_overview (0154), support or super, audited: every
   account flagged is_test, what each holds (counts), the totals, and a
   short readable sample of their posts and group messages (never DMs,
   never daily logs).

   Removal is three steps and never automatic:
     1. a fresh dry run — the numbers are fetched again, not reused;
     2. a reason and the exact phrase REMOVE <n> TEST ACCOUNTS;
     3. admin_remove_test_accounts — super-admin only; refused if the
        count changed since the dry run, if you are flagged yourself, or
        if a flagged account is staff. Each account is audited with its
        snapshot before it goes. Files are then removed through Storage.
   ════════════════════════════════════════════════ */

import { useCallback, useEffect, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { APP_COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { Card, AdminBtn, fmtDate } from "./ui.jsx";
import { PageTitle, Notice, TextField, useRoleLabel, FootprintList } from "./adminBits.jsx";
import { FilesOutcome } from "./PersonPage.jsx";
import * as api from "./accountsApi.js";

function sumGroup(accounts, group) {
  const out = {};
  for (const a of accounts || []) {
    for (const [k, v] of Object.entries(a.footprint?.[group] || {})) out[k] = (out[k] || 0) + Number(v || 0);
  }
  return out;
}

export default function TestDataPage() {
  const { t } = useI18n();
  const { admin } = useOutletContext();
  const isSuper = admin.level === "super";
  const roleLabel = useRoleLabel();
  const [data, setData] = useState(null);
  const [msg, setMsg] = useState(null);

  const load = useCallback(async () => {
    try {
      setData(await api.testDataOverview());
    } catch (e) {
      setMsg({ kind: "err", text: t(api.refusalKey(e) || "admin.testData.loadFailed") });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const unflag = async (id) => {
    setMsg(null);
    try {
      await api.setTest(id, false, t("admin.testData.unflagReason"));
      setMsg({ kind: "ok", text: t("admin.people.unmarkedTest") });
      await load();
    } catch (e) {
      setMsg({ kind: "err", text: t(api.refusalKey(e) || "admin.people.failed") });
    }
  };

  const accounts = data?.accounts || [];
  const sampleKinds = ["posts", "comments", "group_posts", "group_messages", "park_board"];

  return (
    <div style={{ maxWidth: 980 }}>
      <PageTitle title={t("admin.testData.title")} intro={t("admin.testData.intro")} />
      <Notice msg={msg} />

      {data === null ? (
        !msg && <p role="status">{t("admin.testData.loading")}</p>
      ) : (
        <div style={{ display: "grid", gap: 18 }}>
          <Card title={t("admin.testData.accounts", { n: accounts.length })}>
            {accounts.length === 0 ? (
              <p style={{ margin: 0, color: C.textMuted }}>{t("admin.testData.none")}</p>
            ) : (
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
                {accounts.map((a) => {
                  const counts = Object.entries(a.footprint?.removed || {}).filter(([, n]) => Number(n) > 0);
                  return (
                    <li key={a.id} style={{ border: `1px solid ${C.warmGray}`, borderRadius: 10, padding: "12px 16px" }}>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px", alignItems: "baseline" }}>
                        <Link to={`/app/admin/people/${a.id}`} style={{ color: C.green, fontWeight: 700, fontSize: 19, display: "inline-flex", alignItems: "center", minHeight: A11Y.minTapTargetPx, position: "relative" }}>
                          {a.full_name || t("admin.people.unnamed")}
                        </Link>
                        <span style={{ color: C.textMuted, overflowWrap: "anywhere" }}>{a.email}</span>
                        <span>{roleLabel(a.role, a.admin_level)}</span>
                        <span style={{ color: C.textMuted, fontSize: 15 }}>
                          {t("admin.people.lastActive", { when: fmtDate(a.last_active) })}
                        </span>
                      </div>
                      <p style={{ margin: "6px 0 0", fontSize: 16, lineHeight: 1.6 }}>
                        {counts.length
                          ? counts.map(([k, n]) => `${t(`admin.fp.removed.${k}`)} ${n}`).join(" · ")
                          : t("admin.fp.nothing")}
                        {a.files > 0 ? ` · ${t("admin.fp.files", { n: a.files })}` : ""}
                      </p>
                      <div style={{ marginTop: 8 }}>
                        <AdminBtn kind="ghost" onClick={() => unflag(a.id)}>
                          {t("admin.testData.unflag")}
                        </AdminBtn>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          {accounts.length > 0 && (
            <Card title={t("admin.testData.sampleTitle")}>
              {sampleKinds.map((k) =>
                (data.sample?.[k] || []).length ? (
                  <div key={k} style={{ marginBottom: 12 }}>
                    <div style={{ fontWeight: 700 }}>{t(`admin.testData.sample.${k}`)}</div>
                    <ul style={{ margin: "4px 0 0", paddingInlineStart: 22, lineHeight: 1.6 }}>
                      {data.sample[k].map((s) => (
                        <li key={s.id} style={{ overflowWrap: "anywhere" }}>
                          <strong>{s.author}</strong>: {s.text || "—"}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null
              )}
              <p style={{ margin: 0, color: C.textMuted, fontSize: 15 }}>{t("admin.testData.sampleNote")}</p>
            </Card>
          )}

          {accounts.length > 0 &&
            (isSuper ? (
              <RemovalCard onFinished={load} />
            ) : (
              <Card title={t("admin.testData.removeTitle")}>
                <p style={{ margin: 0, color: C.textMuted }}>{t("admin.testData.superOnly")}</p>
              </Card>
            ))}
        </div>
      )}
    </div>
  );
}

function RemovalCard({ onFinished }) {
  const { t } = useI18n();
  const [dry, setDry] = useState(null);
  const [reason, setReason] = useState("");
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [done, setDone] = useState(null);

  const runDry = async () => {
    setBusy(true);
    setMsg(null);
    try {
      setDry(await api.testDataOverview());
      setTyped("");
    } catch (e) {
      setMsg({ kind: "err", text: t(api.refusalKey(e) || "admin.people.failed") });
    } finally {
      setBusy(false);
    }
  };

  const n = dry?.accounts?.length || 0;
  const blocked = dry && (dry.caller_is_flagged || Number(dry.flagged_admins) > 0);
  const ready = dry && !blocked && typed.trim() === dry.confirm_phrase && reason.trim().length >= 5 && !busy;

  const remove = async () => {
    if (!ready) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await api.removeTestAccounts(n, typed.trim(), reason.trim());
      let files = { total: (res.files || []).length, removed: 0, remaining: [] };
      if (files.total) {
        try {
          const f = await api.removeQueuedFiles(res.batch, res.files);
          files = { total: files.total, removed: f.removed, remaining: f.remaining || [] };
        } catch {
          files = { total: files.total, removed: 0, remaining: res.files, unchecked: true };
        }
      }
      setDone({ accounts: res.accounts, files });
      setDry(null);
      await onFinished();
    } catch (e) {
      const key = api.refusalKey(e);
      setMsg({ kind: "err", text: key ? t(key) : e.message || t("admin.people.failed") });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title={t("admin.testData.removeTitle")} style={{ borderColor: C.brown }}>
      <Notice msg={msg} />
      {done ? (
        <>
          <p style={{ marginTop: 0, fontWeight: 700 }}>{t("admin.testData.doneBody", { n: done.accounts })}</p>
          <FilesOutcome outcome={done.files} />
        </>
      ) : !dry ? (
        <>
          <p style={{ marginTop: 0 }}>{t("admin.testData.removeIntro")}</p>
          <AdminBtn kind="outline" disabled={busy} onClick={runDry}>
            {t("admin.testData.dryRun")}
          </AdminBtn>
        </>
      ) : (
        <>
          <p style={{ marginTop: 0, fontWeight: 700 }}>{t("admin.testData.dryHeading", { n })}</p>
          <ul style={{ margin: "0 0 12px", paddingInlineStart: 22, lineHeight: 1.6 }}>
            {dry.accounts.map((a) => (
              <li key={a.id} style={{ overflowWrap: "anywhere" }}>
                {a.full_name || t("admin.people.unnamed")} — {a.email}
              </li>
            ))}
          </ul>
          <FootprintList
            footprint={{
              removed: dry.totals,
              affects_others: sumGroup(dry.accounts, "affects_others"),
              stays: sumGroup(dry.accounts, "stays"),
            }}
            files={dry.files}
          />
          <p style={{ color: C.textMuted }}>{t("admin.testData.othersNote")}</p>
          {dry.caller_is_flagged && <p style={{ color: C.brown, fontWeight: 700 }}>⚑ {t("admin.testData.youAreFlagged")}</p>}
          {Number(dry.flagged_admins) > 0 && (
            <p style={{ color: C.brown, fontWeight: 700 }}>⚑ {t("admin.testData.staffFlagged", { n: dry.flagged_admins })}</p>
          )}
          <TextField label={t("admin.people.deleteReason")} value={reason} onChange={setReason} placeholder={t("admin.testData.reasonPlaceholder")} />
          <TextField
            label={t("admin.testData.typePhrase", { phrase: dry.confirm_phrase })}
            value={typed}
            onChange={setTyped}
            hint={typed.trim() === dry.confirm_phrase ? "✓ " + t("admin.people.deleteTypeOk") : t("admin.testData.typeHint")}
          />
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <AdminBtn kind="danger" disabled={!ready} onClick={remove}>
              {busy ? t("admin.people.deleting") : t("admin.testData.removeNow", { n })}
            </AdminBtn>
            <AdminBtn kind="ghost" disabled={busy} onClick={() => setDry(null)}>
              {t("admin.people.cancel")}
            </AdminBtn>
          </div>
        </>
      )}
    </Card>
  );
}
