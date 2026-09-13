/* ════════════════════════════════════════════════
   Grow admin — Pending.

   Pending is a list of POINTERS plus an audience and an order (0164). It
   holds no "done" state of its own: when a person finishes the course,
   answers or dismisses the survey, or asks to be told when a section
   opens — wherever they do it — the pointer stops showing for them by
   itself. So this screen only chooses what to point at, for whom, and in
   what order.
   ════════════════════════════════════════════════ */

import { useState } from "react";
import { APP_COLORS as C } from "../../../../shared/tokens.js";
import { useI18n } from "../../../lib/i18n.jsx";
import { pushToast } from "../../../lib/feedback.jsx";
import { STRINGS, NOT_OPEN_SKILLS } from "../strings.js";
import {
  adminPendingAdd,
  adminPendingRemove,
  adminPendingReorder,
  adminPendingUpdate,
  pick,
} from "../growData.js";
import { AudiencePicker, Btn, Notice, StatusPill, audienceText, errorMessage, useAdminStyles } from "./ui.jsx";

export default function PendingAdmin({ overview, reload }) {
  const { t, lang, ts } = useI18n();
  const s = useAdminStyles();
  const skillsText = STRINGS[lang] || STRINGS.en;
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(null); // pending id whose audience is open
  const [draftAudience, setDraftAudience] = useState([]);
  const [kind, setKind] = useState("course");
  const [target, setTarget] = useState("");
  const [audience, setAudience] = useState([]);

  const items = overview.pending;
  const pointed = {
    course: new Set(items.map((p) => p.course_id).filter(Boolean)),
    survey: new Set(items.map((p) => p.survey_id).filter(Boolean)),
    skill: new Set(items.map((p) => p.skill).filter(Boolean)),
  };
  const choices =
    kind === "course"
      ? overview.courses.filter((c) => !pointed.course.has(c.id)).map((c) => ({ value: c.id, label: `${pick(c, "title", lang)} (${t(`grow.page.kind.${c.kind}`)} · ${t(`grow.admin.status.${c.status}`)})` }))
      : kind === "survey"
        ? overview.surveys.filter((x) => !pointed.survey.has(x.id)).map((x) => ({ value: x.id, label: `${pick(x, "title", lang)} (${t(`grow.admin.status.${x.status}`)})` }))
        : NOT_OPEN_SKILLS.filter((k) => !pointed.skill.has(k)).map((k) => ({ value: k, label: skillsText.cards[k].name }));

  const run = async (fn, ok) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      await reload();
      if (ok) pushToast(ok, { key: "grow-admin" });
      return true;
    } catch (e) {
      setError(errorMessage(e, t));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const move = (i, delta) => {
    const j = i + delta;
    if (j < 0 || j >= items.length) return;
    const ids = items.map((p) => p.id);
    [ids[i], ids[j]] = [ids[j], ids[i]];
    run(() => adminPendingReorder(ids));
  };

  const title = (p) => (p.skill ? skillsText.cards[p.skill]?.name || p.skill : pick(p, "title", lang));
  const kindWord = (p) => (p.skill ? t("grow.page.kind.skill") : p.course_id ? t(`grow.page.kind.${p.kind}`) : t("grow.page.kind.survey"));

  return (
    <section data-admin-tab="pending">
      <h2 style={s.h2}>{t("grow.admin.tabs.pending")}</h2>
      <p style={s.muted}>{t("grow.admin.pendingExplain")}</p>
      {error && <Notice tone="error">{error}</Notice>}

      {items.length === 0 ? (
        <p style={s.body}>{t("grow.admin.pendingEmpty")}</p>
      ) : (
        <ol style={{ listStyle: "none", margin: "0 0 20px", padding: 0 }}>
          {items.map((p, i) => (
            <li key={p.id} data-admin-pending={p.id} data-target={p.course_id || p.survey_id || p.skill} style={s.card}>
              <div style={{ ...s.row, marginBottom: 4 }}>
                <span style={{ ...s.muted, margin: 0, fontWeight: 700 }}>{i + 1}. {kindWord(p)}</span>
                {p.status && <StatusPill status={p.status} />}
              </div>
              <h3 style={s.h3}>{title(p)}</h3>
              <p style={s.muted}>{t("grow.admin.forAudience", { who: audienceText(p.audience, t) })}</p>
              {p.status && p.status !== "published" && <p style={{ ...s.muted, color: C.error }}>{t("grow.admin.pendingHiddenNote")}</p>}
              {editing === p.id ? (
                <>
                  <AudiencePicker name={`pending-${p.id}`} value={draftAudience} onChange={setDraftAudience} />
                  <div style={s.row}>
                    <Btn
                      small
                      disabled={busy}
                      data-action="save-pending-audience"
                      onClick={async () => {
                        if (await run(() => adminPendingUpdate(p.id, draftAudience), t("grow.admin.saved"))) setEditing(null);
                      }}
                    >
                      {t("grow.admin.save")}
                    </Btn>
                    <Btn kind="secondary" small onClick={() => setEditing(null)}>{t("grow.admin.cancel")}</Btn>
                  </div>
                </>
              ) : (
                <div style={s.row}>
                  <Btn kind="secondary" small disabled={busy || i === 0} onClick={() => move(i, -1)}>{t("grow.admin.moveUp")}</Btn>
                  <Btn kind="secondary" small disabled={busy || i === items.length - 1} onClick={() => move(i, 1)}>{t("grow.admin.moveDown")}</Btn>
                  <Btn kind="secondary" small onClick={() => { setEditing(p.id); setDraftAudience(p.audience || []); }}>
                    {t("grow.admin.changeAudience")}
                  </Btn>
                  <Btn kind="danger" small disabled={busy} data-action="remove-pending" onClick={() => run(() => adminPendingRemove(p.id), t("grow.admin.pendingRemoved"))}>
                    {t("grow.admin.removeFromPending")}
                  </Btn>
                </div>
              )}
            </li>
          ))}
        </ol>
      )}

      <div style={{ ...s.card, border: `2px solid ${C.green}` }} data-pending-add>
        <h3 style={s.h3}>{t("grow.admin.addToPending")}</h3>
        <label style={{ display: "block", margin: "0 0 12px" }}>
          <span style={s.label}>{t("grow.admin.pendingKind")}</span>
          <select
            data-field="pending-kind"
            value={kind}
            onChange={(e) => {
              setKind(e.target.value);
              setTarget("");
            }}
            style={{ ...s.input, fontSize: ts(17) }}
          >
            <option value="course">{t("grow.admin.pendingKinds.course")}</option>
            <option value="survey">{t("grow.admin.pendingKinds.survey")}</option>
            <option value="skill">{t("grow.admin.pendingKinds.skill")}</option>
          </select>
        </label>
        <label style={{ display: "block", margin: "0 0 12px" }}>
          <span style={s.label}>{t("grow.admin.pendingWhich")}</span>
          <select data-field="pending-target" value={target} onChange={(e) => setTarget(e.target.value)} style={{ ...s.input, fontSize: ts(17) }}>
            <option value="">{t("grow.admin.choose")}</option>
            {choices.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </label>
        <AudiencePicker name="pending-new" value={audience} onChange={setAudience} />
        <Btn
          data-action="add-pending"
          disabled={busy || !target}
          onClick={async () => {
            const ok = await run(
              () =>
                adminPendingAdd({
                  course: kind === "course" ? target : null,
                  survey: kind === "survey" ? target : null,
                  skill: kind === "skill" ? target : null,
                  audience,
                }),
              t("grow.admin.pendingAdded")
            );
            if (ok) {
              setTarget("");
              setAudience([]);
            }
          }}
        >
          {t("grow.admin.addToPending")}
        </Btn>
      </div>
    </section>
  );
}
