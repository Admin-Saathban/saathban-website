/* ════════════════════════════════════════════════
   Help and support — /app/help. NAVIGATION_SPEC §6, row 7.

   Real, not a stub: the `questions` table, its insert policy, its
   admin queue and its reply RPC have all existed since migration 0010
   with nothing in the app able to reach them. This is the missing
   half. The admin queue has been reading an empty table because there
   was no front door, not because nobody had questions.

   MOTION_SPEC §7 — there are no toasts. Sending a question does not
   announce itself; the question appears in the list below, which is
   the confirmation. That is also why the list sits on the same screen
   as the form rather than behind a tab.

   The status words avoid queue language. "Pending", "in queue" and a
   position number all describe the institution's day. Somebody who has
   just asked for help wants to know a person has it.
   ════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { APP_COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import AppHeader from "../../components/AppHeader.jsx";
import { arrivalClass } from "../../components/motion.jsx";
import { askQuestion, fetchMyQuestions } from "./helpData.js";

export default function HelpPage() {
  const { t, ts, lang, meta } = useI18n();
  const { state } = useLocation();
  const dateLocale = lang === "ur" ? "ur-PK" : "en-GB";

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [rows, setRows] = useState(null);

  const load = () =>
    fetchMyQuestions()
      .then(setRows)
      .catch(() => setRows([]));

  useEffect(() => {
    load();
  }, []);

  /* The table's own CHECK constraints, restated here so a person is
     told before the round trip rather than by a database error. */
  const valid = subject.trim().length >= 3 && body.trim().length >= 1;

  const send = async (e) => {
    e.preventDefault();
    setError("");
    if (!valid) {
      setError(t("help.tooShort"));
      return;
    }
    setSending(true);
    try {
      await askQuestion({ subject: subject.trim(), body: body.trim() });
      setSubject("");
      setBody("");
      await load(); /* the question appearing IS the confirmation */
    } catch {
      setError(t("help.error"));
    } finally {
      setSending(false);
    }
  };

  const label = {
    display: "block",
    fontSize: ts(A11Y.minBodyPx),
    fontWeight: 600,
    margin: "0 0 6px",
  };
  const field = {
    width: "100%",
    boxSizing: "border-box",
    padding: "12px 14px",
    borderRadius: 14,
    border: `2px solid ${C.warmGray}`,
    background: C.white,
    color: C.textMain,
    fontSize: ts(A11Y.minBodyPx),
    fontFamily: "inherit",
    lineHeight: 1.5,
  };

  return (
    <>
      <AppHeader />
      <main
        className={arrivalClass(state)}
        style={{
          minHeight: "100vh",
          background: C.bg,
          color: C.textMain,
          fontFamily: meta.fonts.body,
          padding: "16px 16px 80px",
        }}
      >
        <div style={{ maxWidth: 600, margin: "0 auto" }}>
          <h1
            style={{
              fontFamily: meta.fonts.heading,
              fontSize: ts(26),
              fontWeight: 700,
              color: C.green,
              margin: "0 0 4px",
            }}
          >
            {t("help.title")}
          </h1>
          <p
            style={{
              fontSize: ts(A11Y.minBodyPx),
              color: C.textMuted,
              margin: "0 0 18px",
              lineHeight: 1.55,
            }}
          >
            {t("help.intro")}
          </p>

          <form onSubmit={send} style={{ marginBottom: 8 }}>
            <label htmlFor="help-subject" style={label}>
              {t("help.subject")}
            </label>
            <input
              id="help-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={t("help.subjectPlaceholder")}
              maxLength={200}
              style={{ ...field, minHeight: A11Y.minTapTargetPx, marginBottom: 14 }}
            />

            <label htmlFor="help-body" style={label}>
              {t("help.body")}
            </label>
            <textarea
              id="help-body"
              rows={5}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={t("help.bodyPlaceholder")}
              maxLength={4000}
              style={{ ...field, resize: "vertical", marginBottom: 14 }}
            />

            {error && (
              <p
                role="alert"
                style={{ fontSize: ts(16), color: C.brown, fontWeight: 700, margin: "0 0 12px" }}
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={sending || !valid}
              style={{
                minHeight: A11Y.minTapTargetPx,
                padding: "0 26px",
                borderRadius: 50,
                border: "none",
                background: valid && !sending ? C.green : C.warmGray,
                color: valid && !sending ? C.cream : C.textMuted,
                fontSize: ts(A11Y.minBodyPx),
                fontWeight: 700,
                fontFamily: "inherit",
                cursor: valid && !sending ? "pointer" : "default",
              }}
            >
              {sending ? t("help.sending") : t("help.send")}
            </button>
          </form>

          {/* §0.6 — nothing asked yet draws one line, not an empty
              heading over an empty list. */}
          {rows !== null && (
            <>
              <h2
                style={{
                  fontFamily: meta.fonts.heading,
                  fontSize: ts(20),
                  fontWeight: 700,
                  color: C.green,
                  margin: "28px 0 10px",
                }}
              >
                {t("help.yours")}
              </h2>

              {rows.length === 0 ? (
                <p style={{ fontSize: ts(A11Y.minBodyPx), color: C.textMuted, margin: 0 }}>
                  {t("help.none")}
                </p>
              ) : (
                <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                  {rows.map((q) => (
                    <li
                      key={q.id}
                      style={{
                        background: C.white,
                        borderRadius: 16,
                        padding: "14px 16px",
                        marginBottom: 12,
                      }}
                    >
                      <p
                        style={{
                          margin: 0,
                          fontFamily: meta.fonts.heading,
                          fontSize: ts(18),
                          fontWeight: 700,
                        }}
                      >
                        {q.subject}
                      </p>
                      <p
                        style={{
                          margin: "4px 0 0",
                          fontSize: ts(16),
                          lineHeight: 1.55,
                          color: C.textMain,
                        }}
                      >
                        {q.body}
                      </p>
                      <p
                        style={{
                          margin: "8px 0 0",
                          fontSize: ts(14),
                          color: C.textMuted,
                          fontWeight: 600,
                        }}
                      >
                        {t("help.askedOn", {
                          date: new Date(q.created_at).toLocaleDateString(dateLocale, {
                            day: "numeric",
                            month: "long",
                          }),
                        })}
                        {" · "}
                        {q.status === "answered" ? t("help.answered") : t("help.open")}
                      </p>

                      {q.reply && (
                        <div
                          style={{
                            marginTop: 12,
                            paddingTop: 12,
                            borderTop: `1px solid ${C.warmGray}`,
                          }}
                        >
                          <p
                            style={{
                              margin: 0,
                              fontSize: ts(14),
                              fontWeight: 700,
                              color: C.green,
                            }}
                          >
                            {t("help.reply")}
                          </p>
                          <p style={{ margin: "4px 0 0", fontSize: ts(16), lineHeight: 1.55 }}>
                            {q.reply}
                          </p>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </main>
    </>
  );
}
