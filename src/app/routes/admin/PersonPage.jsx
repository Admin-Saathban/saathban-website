/* ════════════════════════════════════════════════
   /app/admin/people/:id — one account.

   Opening this page calls admin_person (0150), which writes
   'admin_view_person' before it answers. What is shown is the profile
   and COUNTS — days logged, posts, groups, streaks, reports — never the
   words of a log, a post or a message.

   Actions, and who the database lets do them:
     pause / unpause        moderator_set_pause (0125) — reason required
     mark / unmark test     admin_set_test (0150) — support or super
     send a sign-in link    admin_record_signin_link, then Supabase sends
     change role            admin_set_role — super-admin only
     delete with its data   admin_delete_account (0151) — super-admin,
                            typed email, reason, audited before it runs
   The screen hides the super-admin controls from support admins as a
   courtesy only; the functions refuse them either way.
   ════════════════════════════════════════════════ */

import { useCallback, useEffect, useState } from "react";
import { Link, useOutletContext, useParams } from "react-router-dom";
import { APP_COLORS as C, APP_FONT, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { ROLE_DISPLAY } from "../../constants/roles.js";
import { Card, Field, AdminBtn, fmtDate, fmtDateTime } from "./ui.jsx";
import {
  PageTitle,
  StatusChips,
  useRoleLabel,
  TextField,
  Notice,
  FootprintList,
  inputStyle,
  fmtDay,
} from "./adminBits.jsx";
import * as api from "./accountsApi.js";

const ROLES = ["saath_icon", "saath_buddy", "family_member", "admin"];
const LEVELS = ["support", "super", "moderator"];

export default function PersonPage() {
  const { id } = useParams();
  const { t } = useI18n();
  const { admin } = useOutletContext();
  const roleLabel = useRoleLabel();
  const isSuper = admin.level === "super";
  const isSelf = admin.id === id;

  const [person, setPerson] = useState(null);
  const [loadMsg, setLoadMsg] = useState(null);
  const [deleted, setDeleted] = useState(null);

  const load = useCallback(async () => {
    try {
      setPerson(await api.getPerson(id));
      setLoadMsg(null);
    } catch (e) {
      setLoadMsg({ kind: "err", text: t(api.refusalKey(e) || "admin.people.personFailed") });
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const back = (
    <Link
      to="/app/admin/people"
      style={{ display: "inline-flex", alignItems: "center", minHeight: A11Y.minTapTargetPx, color: C.green, fontWeight: 700 }}
    >
      {t("admin.people.back")}
    </Link>
  );

  if (deleted) {
    return (
      <div style={{ maxWidth: 820 }}>
        {back}
        <PageTitle title={t("admin.people.deletedTitle")} />
        <Card>
          <p style={{ marginTop: 0 }}>{t("admin.people.deletedBody", { email: deleted.email })}</p>
          <FilesOutcome outcome={deleted.files} />
        </Card>
      </div>
    );
  }

  if (!person) {
    return (
      <div style={{ maxWidth: 820 }}>
        {back}
        {loadMsg ? <Notice msg={loadMsg} /> : <p role="status">{t("admin.people.loading")}</p>}
      </div>
    );
  }

  const a = person.activity || {};
  return (
    <div style={{ maxWidth: 980 }}>
      {back}
      <PageTitle title={person.full_name || t("admin.people.unnamed")} />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", margin: "-8px 0 20px" }}>
        <span style={{ color: C.textMuted, overflowWrap: "anywhere" }}>{person.email}</span>
        <strong>{roleLabel(person.role, person.admin_level)}</strong>
        <StatusChips person={person} />
      </div>
      <p style={{ color: C.textMuted, fontSize: 15, margin: "-8px 0 18px" }}>{t("admin.people.viewAudited")}</p>
      {/* Super-admin only: support admins read only their own entries (0179). */}
      {isSuper && (
        <Link
          to={`/app/admin/audit?person=${id}`}
          data-person-audit-link
          style={{ display: "inline-flex", alignItems: "center", minHeight: A11Y.minTapTargetPx, color: C.green, fontWeight: 700, margin: "-12px 0 14px" }}
        >
          {t("admin.people.auditLink")}
        </Link>
      )}

      <div style={{ display: "grid", gap: 18 }}>
        <Card title={t("admin.people.profile")}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 16 }}>
            <Field label={t("admin.people.f.joined")}>{fmtDate(person.created_at || person.account_created_at)}</Field>
            <Field label={t("admin.people.f.lastSeen")}>{fmtDateTime(person.last_seen_at)}</Field>
            <Field label={t("admin.people.f.lastSignIn")}>{fmtDateTime(person.last_sign_in_at)}</Field>
            <Field label={t("admin.people.f.emailConfirmed")}>{fmtDate(person.email_confirmed_at)}</Field>
            <Field label={t("admin.people.f.city")}>{[person.city, person.country].filter(Boolean).join(", ") || null}</Field>
            <Field label={t("admin.people.f.timezone")}>{person.timezone}</Field>
            <Field label={t("admin.people.f.language")}>{person.preferred_language}</Field>
            <Field label={t("admin.people.f.tier")}>{person.tier}</Field>
          </div>
        </Card>

        <Card title={t("admin.people.activity")}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 16 }}>
            <Field label={t("admin.people.a.daysLogged")}>{a.days_logged ?? 0}</Field>
            <Field label={t("admin.people.a.lastLog")}>{a.last_logged_day ? fmtDay(a.last_logged_day) : null}</Field>
            <Field label={t("admin.people.a.posts")}>{a.posts ?? 0}</Field>
            <Field label={t("admin.people.a.comments")}>{a.comments ?? 0}</Field>
            <Field label={t("admin.people.a.groupPosts")}>{a.group_posts ?? 0}</Field>
            <Field label={t("admin.people.a.groups")}>{a.group_memberships ?? 0}</Field>
            <Field label={t("admin.people.a.streaks")}>{a.streaks ?? 0}</Field>
            <Field label={t("admin.people.a.circle")}>{t("admin.people.a.circleValue", { mine: a.circle_members ?? 0, joined: a.circles_joined ?? 0 })}</Field>
            <Field label={t("admin.people.a.reportsAbout")}>
              {t("admin.people.a.reportsAboutValue", { n: a.reports_about ?? 0, open: a.reports_open_about ?? 0 })}
            </Field>
            <Field label={t("admin.people.a.reportsBy")}>{a.reports_by ?? 0}</Field>
          </div>
        </Card>

        {person.has_profile && <EverydayActions person={person} isSelf={isSelf} onChanged={load} />}
        {isSuper && person.has_profile && <RoleCard person={person} isSelf={isSelf} onChanged={load} />}
        {/* Break-glass (0187): super-admin, a Saath-Icon, never yourself.
            The page it opens explains, asks why, and tells the person. */}
        {isSuper && person.has_profile && person.role === "saath_icon" && !isSelf && (
          <Card title={t("admin.breakGlass.entryTitle")} style={{ borderColor: C.brown }}>
            <p style={{ marginTop: 0 }}>{t("admin.breakGlass.entryBody", { name: person.full_name || t("admin.people.unnamed") })}</p>
            <Link
              to={`/app/admin/break-glass/${id}`}
              data-person-break-glass
              style={{ display: "inline-flex", alignItems: "center", minHeight: A11Y.minTapTargetPx, color: C.brown, fontWeight: 700 }}
            >
              {t("admin.breakGlass.entryLink", { name: person.full_name || t("admin.people.unnamed") })}
            </Link>
          </Card>
        )}
        {isSuper ? (
          <DeleteCard person={person} isSelf={isSelf} onDeleted={setDeleted} />
        ) : (
          <Card title={t("admin.people.superOnlyTitle")}>
            <p style={{ margin: 0, color: C.textMuted }}>{t("admin.people.superOnlyBody")}</p>
          </Card>
        )}
      </div>
    </div>
  );
}

function useRunner(onChanged) {
  const { t } = useI18n();
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  /* afterOk runs straight after the write succeeds and BEFORE the
     refetch. Clearing the reason after the refetch wiped whatever the
     admin had already started typing for the next action. */
  const run = async (fn, okText, afterOk) => {
    setBusy(true);
    setMsg(null);
    try {
      const out = await fn();
      setMsg({ kind: "ok", text: typeof okText === "function" ? okText(out) : okText });
      if (afterOk) afterOk(out);
      if (onChanged) await onChanged();
      return out;
    } catch (e) {
      const key = api.refusalKey(e);
      setMsg({ kind: "err", text: key ? t(key) : e.message || t("admin.people.failed") });
      return undefined;
    } finally {
      setBusy(false);
    }
  };
  return { msg, busy, run, setMsg };
}

function EverydayActions({ person, isSelf, onChanged }) {
  const { t } = useI18n();
  const { msg, busy, run, setMsg } = useRunner(onChanged);
  const [reason, setReason] = useState("");
  const [confirmLink, setConfirmLink] = useState(false);
  const r = reason.trim();

  const pause = () => {
    if (r.length < 5) return setMsg({ kind: "err", text: t("admin.people.errReason") });
    return run(
      () => api.setPause(person.id, !person.is_paused, r),
      person.is_paused ? t("admin.people.unpaused") : t("admin.people.paused"),
      () => setReason("")
    );
  };
  const flagTest = () => {
    if (r.length < 3) return setMsg({ kind: "err", text: t("admin.people.errReason") });
    return run(
      () => api.setTest(person.id, !person.is_test, r),
      person.is_test ? t("admin.people.unmarkedTest") : t("admin.people.markedTest"),
      () => setReason("")
    );
  };
  const link = () => {
    if (!confirmLink) return setConfirmLink(true);
    setConfirmLink(false);
    return run(
      () => api.sendSignInLink(person.id, r),
      (email) => t("admin.people.linkSent", { email })
    );
  };

  return (
    <Card title={t("admin.people.actions")}>
      <Notice msg={msg} />
      <TextField
        label={t("admin.people.reason")}
        value={reason}
        onChange={setReason}
        placeholder={t("admin.people.reasonPlaceholder")}
        hint={t("admin.people.reasonHint")}
      />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        <AdminBtn kind={person.is_paused ? "primary" : "danger"} disabled={busy || isSelf} onClick={pause}>
          {person.is_paused ? t("admin.people.unpause") : t("admin.people.pause")}
        </AdminBtn>
        <AdminBtn kind="outline" disabled={busy} onClick={flagTest}>
          {person.is_test ? t("admin.people.unmarkTest") : t("admin.people.markTest")}
        </AdminBtn>
        <AdminBtn kind="outline" disabled={busy || !person.email} onClick={link}>
          {confirmLink ? t("admin.people.linkConfirm", { email: person.email }) : t("admin.people.sendLink")}
        </AdminBtn>
      </div>
      {isSelf && <p style={{ color: C.textMuted, marginBottom: 0 }}>{t("admin.people.selfNote")}</p>}
    </Card>
  );
}

function RoleCard({ person, isSelf, onChanged }) {
  const { t } = useI18n();
  const { msg, busy, run, setMsg } = useRunner(onChanged);
  const [role, setRole] = useState(person.role);
  const [level, setLevel] = useState(person.admin_level || "support");
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState(false);
  const changed = role !== person.role || (role === "admin" && level !== (person.admin_level || "support"));
  const lastSuper =
    person.role === "admin" && person.admin_level === "super" && Number(person.active_super_admins) <= 1;

  const apply = () => {
    if (reason.trim().length < 5) return setMsg({ kind: "err", text: t("admin.people.errReason") });
    if (!confirm) return setConfirm(true);
    setConfirm(false);
    return run(
      () => api.setRole(person.id, role, role === "admin" ? level : null, reason.trim()),
      t("admin.people.roleChanged"),
      () => setReason("")
    );
  };

  const selectStyle = { ...inputStyle, width: "auto", minWidth: 200, paddingInlineEnd: 30 };
  return (
    <Card title={t("admin.people.roleTitle")}>
      <Notice msg={msg} />
      <p style={{ marginTop: 0, color: C.textMuted }}>{t("admin.people.roleIntro")}</p>
      {lastSuper && <p style={{ color: C.brown, fontWeight: 700 }}>⚑ {t("admin.people.lastSuperNote")}</p>}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 12 }}>
        <label>
          <span style={{ display: "block", fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{t("admin.people.role")}</span>
          <select value={role} onChange={(e) => { setRole(e.target.value); setConfirm(false); }} style={selectStyle}>
            {ROLES.map((r) => (
              <option key={r} value={r}>{ROLE_DISPLAY[r]}</option>
            ))}
          </select>
        </label>
        {role === "admin" && (
          <label>
            <span style={{ display: "block", fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{t("admin.people.level")}</span>
            <select value={level} onChange={(e) => { setLevel(e.target.value); setConfirm(false); }} style={selectStyle}>
              {LEVELS.map((l) => (
                <option key={l} value={l}>
                  {l === "super" ? t("admin.levelSuper") : l === "moderator" ? t("admin.levelModerator") : t("admin.levelSupport")}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <TextField label={t("admin.people.reason")} value={reason} onChange={setReason} placeholder={t("admin.people.reasonPlaceholder")} />
      <AdminBtn kind="primary" disabled={busy || !changed} onClick={apply}>
        {confirm ? t("admin.people.roleConfirm", { role: roleLabelPlain(role, level, t) }) : t("admin.people.roleApply")}
      </AdminBtn>
      {isSelf && <p style={{ color: C.textMuted, marginBottom: 0 }}>{t("admin.people.roleSelfNote")}</p>}
    </Card>
  );
}

function roleLabelPlain(role, level, t) {
  if (role !== "admin") return ROLE_DISPLAY[role];
  const lvl = level === "super" ? t("admin.levelSuper") : level === "moderator" ? t("admin.levelModerator") : t("admin.levelSupport");
  return `${ROLE_DISPLAY.admin} · ${lvl}`;
}

function DeleteCard({ person, isSelf, onDeleted }) {
  const { t } = useI18n();
  const [preview, setPreview] = useState(null);
  const [reason, setReason] = useState("");
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const openPreview = async () => {
    setBusy(true);
    setMsg(null);
    try {
      setPreview(await api.deletionPreview(person.id));
    } catch (e) {
      setMsg({ kind: "err", text: t(api.refusalKey(e) || "admin.people.failed") });
    } finally {
      setBusy(false);
    }
  };

  const matches = typed.trim().toLowerCase() === String(person.email || "").toLowerCase();
  const ready = matches && reason.trim().length >= 5 && !busy;

  const doDelete = async () => {
    if (!ready) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await api.deleteAccount(person.id, typed.trim(), reason.trim());
      let files = { total: (res.files || []).length, removed: 0, remaining: [] };
      if (files.total > 0) {
        try {
          const out = await api.removeQueuedFiles(res.batch, res.files);
          files = { total: files.total, removed: out.removed, remaining: out.remaining || [] };
        } catch {
          files = { total: files.total, removed: 0, remaining: res.files, unchecked: true };
        }
      }
      onDeleted({ email: res.email, files });
    } catch (e) {
      const key = api.refusalKey(e);
      setMsg({ kind: "err", text: key ? t(key) : e.message || t("admin.people.failed") });
      setBusy(false);
    }
  };

  return (
    <Card title={t("admin.people.deleteTitle")} style={{ borderColor: C.brown }}>
      <Notice msg={msg} />
      <p style={{ marginTop: 0 }}>{t("admin.people.deleteIntro")}</p>
      {isSelf ? (
        <p style={{ color: C.textMuted, margin: 0 }}>{t("admin.people.errSelf")}</p>
      ) : !preview ? (
        <AdminBtn kind="danger" disabled={busy} onClick={openPreview}>
          {t("admin.people.deleteStart")}
        </AdminBtn>
      ) : (
        <>
          <FootprintList footprint={preview.footprint} files={(preview.files || []).length} />
          <p style={{ color: C.textMuted }}>{t("admin.people.deleteCannot")}</p>
          <TextField
            label={t("admin.people.deleteReason")}
            value={reason}
            onChange={setReason}
            placeholder={t("admin.people.deleteReasonPlaceholder")}
          />
          <TextField
            label={t("admin.people.deleteType", { email: person.email })}
            value={typed}
            onChange={setTyped}
            hint={matches ? "✓ " + t("admin.people.deleteTypeOk") : t("admin.people.deleteTypeHint")}
          />
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <AdminBtn kind="danger" disabled={!ready} onClick={doDelete}>
              {busy ? t("admin.people.deleting") : t("admin.people.deleteNow")}
            </AdminBtn>
            <AdminBtn kind="ghost" disabled={busy} onClick={() => { setPreview(null); setTyped(""); }}>
              {t("admin.people.cancel")}
            </AdminBtn>
          </div>
        </>
      )}
    </Card>
  );
}

export function FilesOutcome({ outcome }) {
  const { t } = useI18n();
  if (!outcome || !outcome.total) {
    return <p style={{ margin: 0 }}>{t("admin.files.none")}</p>;
  }
  return (
    <div>
      <p style={{ margin: "0 0 8px" }}>
        {t("admin.files.removed", { n: outcome.removed, total: outcome.total })}
      </p>
      {outcome.remaining && outcome.remaining.length > 0 && (
        <>
          <p style={{ margin: "0 0 6px", color: C.brown, fontWeight: 700 }}>
            ⚑ {outcome.unchecked ? t("admin.files.unchecked") : t("admin.files.remaining", { n: outcome.remaining.length })}
          </p>
          <ul style={{ margin: 0, paddingInlineStart: 22, fontFamily: "monospace", fontSize: 15, overflowWrap: "anywhere" }}>
            {outcome.remaining.map((f) => (
              <li key={f.bucket + f.path}>{f.bucket}/{f.path}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
