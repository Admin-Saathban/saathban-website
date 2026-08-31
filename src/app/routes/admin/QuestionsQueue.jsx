/* ════════════════════════════════════════════════
   /app/admin/questions — the questions queue.

   Any signed-in account can ask a question (questions table, 0010);
   this page is where staff answer. Replying goes through the
   admin_answer_question RPC: the reply is stored on the row, the
   asker gets an in-app notification, and the audit log records it —
   one unit, so those can never drift apart.

   asker_name / asker_role are denormalized onto the row at insert
   because support admins cannot read other profiles (0002) — the
   queue must still know who it's answering.
   ════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { useI18n } from "../../lib/i18n.jsx";
import { useOutletContext } from "react-router-dom";
import { APP_COLORS as C, APP_FONT, A11Y } from "../../../shared/tokens.js";
import { ROLE_DISPLAY } from "../../constants/roles.js";
import { fetchQuestions, answerQuestion } from "./api.js";
import { Card, AdminBtn, fmtDateTime } from "./ui.jsx";

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  fontFamily: APP_FONT,
  fontSize: 17,
  color: C.textMain,
  background: C.cream,
  border: `1px solid ${C.warmGray}`,
  borderRadius: 10,
  padding: "12px 14px",
};

export default function QuestionsQueue() {
  const { t } = useI18n();
  const { reload } = useOutletContext(); // refreshes the sidebar count
  const [questions, setQuestions] = useState(null); // null = loading
  const [error, setError] = useState(null);
  const [drafts, setDrafts] = useState({}); // question id -> reply text
  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    try {
      setError(null);
      setQuestions(await fetchQuestions());
    } catch (e) {
      setError(e.message || "Could not load questions.");
      setQuestions([]);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const reply = async (q) => {
    const text = (drafts[q.id] || "").trim();
    if (!text) return;
    setBusyId(q.id);
    setError(null);
    try {
      await answerQuestion(q.id, text);
      setDrafts((d) => ({ ...d, [q.id]: "" }));
      await load();
      await reload();
    } catch (e) {
      setError(e.message || "The reply didn't send. Please try again.");
    } finally {
      setBusyId(null);
    }
  };

  const open = (questions || []).filter((q) => q.status === "open");
  const answered = (questions || []).filter((q) => q.status === "answered");

  return (
    <div style={{ maxWidth: 860 }}>
      <h1
        style={{
          fontFamily: APP_FONT,
          fontSize: 32,
          fontWeight: 700,
          color: C.green,
          margin: "0 0 6px",
        }}
      >{t("admin.questions")}</h1>
      <p style={{ color: C.textMuted, margin: "0 0 24px" }}>
        {t("admin.questionsIntro")}
            </p>

      {error && (
        <p
          role="alert"
          style={{
            border: `2px solid ${C.brown}`,
            borderRadius: 10,
            padding: "12px 16px",
            color: C.brown,
            fontWeight: 600,
            marginBottom: 18,
          }}
        >
          {error}
        </p>
      )}

      <div style={{ display: "grid", gap: 22 }}>
        <Card
          title={t("admin.waitingReply")}
          aside={
            <span style={{ fontWeight: 700, color: open.length ? C.brown : C.green }}>
              {questions === null ? "…" : `${open.length} open`}
            </span>
          }
        >
          {questions === null ? (
            <p style={{ margin: 0, color: C.textMuted }}>Loading…</p>
          ) : open.length === 0 ? (
            <p style={{ margin: 0, color: C.textMuted }}>{t("admin.queueClear")}</p>
          ) : (
            <div style={{ display: "grid", gap: 16 }}>
              {open.map((q) => (
                <div
                  key={q.id}
                  style={{
                    border: `1px solid ${C.warmGray}`,
                    borderLeft: `4px solid ${C.olive}`,
                    borderRadius: 10,
                    padding: "16px 20px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      gap: 12,
                      flexWrap: "wrap",
                      marginBottom: 6,
                    }}
                  >
                    <strong style={{ fontSize: 18 }}>{q.subject}</strong>
                    <span style={{ color: C.textMuted, fontSize: 15 }}>
                      {q.asker_name}
                      {q.asker_role && <> · {ROLE_DISPLAY[q.asker_role] || q.asker_role}</>}
                      {" · "}
                      {fmtDateTime(q.created_at)}
                    </span>
                  </div>
                  <p style={{ margin: "0 0 14px", whiteSpace: "pre-wrap" }}>{q.body}</p>
                  <div style={{ display: "grid", gap: 10 }}>
                    <textarea
                      rows={3}
                      placeholder={`Reply to ${q.asker_name}…`}
                      value={drafts[q.id] || ""}
                      onChange={(e) =>
                        setDrafts((d) => ({ ...d, [q.id]: e.target.value }))
                      }
                      style={inputStyle}
                    />
                    <div>
                      <AdminBtn
                        kind="primary"
                        disabled={busyId === q.id || !(drafts[q.id] || "").trim()}
                        onClick={() => reply(q)}
                      >{t("admin.sendReply")}</AdminBtn>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title={t("admin.answered")}>
          {answered.length === 0 ? (
            <p style={{ margin: 0, color: C.textMuted }}>{t("admin.nothingYet")}</p>
          ) : (
            <div style={{ display: "grid", gap: 14 }}>
              {answered.map((q) => (
                <div key={q.id} style={{ fontSize: 16 }}>
                  <span style={{ color: C.green, fontWeight: 700 }}>✓</span>{" "}
                  <strong>{q.subject}</strong>
                  <span style={{ color: C.textMuted }}>
                    {" — "}
                    {q.asker_name} · answered {fmtDateTime(q.replied_at)}
                  </span>
                  <div style={{ color: C.textMuted, fontSize: 15, marginTop: 2 }}>
                    {q.reply}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
