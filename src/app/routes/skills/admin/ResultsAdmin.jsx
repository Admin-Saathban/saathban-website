/* ════════════════════════════════════════════════
   Grow admin — Survey results. SUPER ADMINS ONLY (§16, §18; 0166).

   Per question: counts for each choice, split into submitted and
   part-way (never merged); written answers in full, each marked
   submitted or part-way. Totals for submitted, part-way and dismissed.

   Opening a survey's results is recorded in the audit log by the
   database before anything is returned, and the CSV export records
   itself too. The CSV is built here in the browser from the same
   payload; rows carry no names and no ids.
   ════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { APP_COLORS as C } from "../../../../shared/tokens.js";
import { useI18n } from "../../../lib/i18n.jsx";
import { pushToast } from "../../../lib/feedback.jsx";
import { fetchSurveyResults, markResultsExported, pick, word } from "../growData.js";
import { Btn, Notice, StatusPill, errorMessage, useAdminStyles } from "./ui.jsx";

export function resultsToCsv(results, lang) {
  const qs = results?.survey?.questions || [];
  const esc = (v) => {
    const s = v == null ? "" : String(v);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = ["response", "status", "day", ...qs.map((q) => `${q.key}: ${word(q, lang)}`)];
  const lines = [header.map(esc).join(",")];
  (results?.rows || []).forEach((row, i) => {
    const cells = [
      i + 1,
      row.status,
      row.day,
      ...qs.map((q) => {
        const v = row.answers?.[q.key];
        if (v == null) return "";
        if (q.type === "text") return v;
        const label = (k) => word((q.options || []).find((o) => o.key === k), lang) || k;
        return Array.isArray(v) ? v.map(label).join("; ") : label(v);
      }),
    ];
    lines.push(cells.map(esc).join(","));
  });
  /* The byte-order mark makes spreadsheet programs read Urdu as UTF-8. */
  return "\uFEFF" + lines.join("\r\n");
}

export default function ResultsAdmin({ overview, params, setParams }) {
  const { t, lang } = useI18n();
  const s = useAdminStyles();
  const surveyId = params.get("survey") || "";
  const [results, setResults] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    setResults(null);
    setError("");
    if (!surveyId) return undefined;
    setLoading(true);
    fetchSurveyResults(surveyId)
      .then((r) => alive && setResults(r))
      .catch((e) => alive && setError(errorMessage(e, t)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [surveyId, t]);

  const exportCsv = async () => {
    try {
      await markResultsExported(surveyId);
    } catch (e) {
      setError(errorMessage(e, t));
      return;
    }
    const csv = resultsToCsv(results, lang);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${results.survey.slug || "survey"}-results-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
    pushToast(t("grow.admin.exported"), { key: "grow-admin" });
  };

  const questionMeta = (key) => (results?.survey?.questions || []).find((q) => q.key === key);

  return (
    <section data-admin-tab="results">
      <h2 style={s.h2}>{t("grow.admin.tabs.results")}</h2>
      <p style={s.muted}>{t("grow.admin.resultsExplain")}</p>

      <label style={{ display: "block", margin: "0 0 14px" }}>
        <span style={s.label}>{t("grow.admin.chooseSurvey")}</span>
        <select
          data-field="results-survey"
          value={surveyId}
          onChange={(e) => setParams(e.target.value ? { tab: "results", survey: e.target.value } : { tab: "results" })}
          style={s.input}
        >
          <option value="">{t("grow.admin.choose")}</option>
          {overview.surveys.map((sv) => (
            <option key={sv.id} value={sv.id}>
              {pick(sv, "title", lang)} ({t(`grow.admin.status.${sv.status}`)})
            </option>
          ))}
        </select>
      </label>

      {error && <Notice tone="error">{error}</Notice>}
      {loading && <p aria-busy="true" style={s.muted}>···</p>}

      {results && (
        <div data-results={results.survey.id}>
          <Notice>{t("grow.admin.resultsAudited")}</Notice>
          <div style={s.card}>
            <div style={{ ...s.row, marginBottom: 6 }}>
              <StatusPill status={results.survey.status} />
            </div>
            <h3 style={s.h3}>{pick(results.survey, "title", lang)}</h3>
            <p style={s.body} data-results-totals>
              {t("grow.admin.resultsTotals", { submitted: results.submitted, part: results.part_way, dismissed: results.dismissed_people })}
            </p>
            <Btn data-action="export-csv" onClick={exportCsv}>{t("grow.admin.exportCsv")}</Btn>
          </div>

          {results.questions.map((rq, i) => {
            const q = questionMeta(rq.key) || {};
            const total = Math.max(1, Number(results.submitted) + Number(results.part_way));
            return (
              <article key={rq.key} data-result-question={rq.key} style={s.card}>
                <p style={{ ...s.muted, margin: "0 0 2px" }}>
                  {t("grow.admin.questionN", { n: i + 1 })} · {t(`grow.admin.type.${rq.type}`)}
                </p>
                <h3 style={s.h3}>{word(q, lang)}</h3>
                <p style={s.muted}>
                  {t("grow.admin.answeredBy", { submitted: rq.answered.submitted, part: rq.answered.part_way })}
                </p>

                {rq.type !== "text" && (
                  <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                    {(q.options || []).map((o) => {
                      const c = rq.counts?.[o.key] || { submitted: 0, part_way: 0 };
                      const pct = Math.round((100 * Number(c.submitted)) / total);
                      return (
                        <li key={o.key} data-result-option={o.key} data-submitted={c.submitted} data-part-way={c.part_way} style={{ margin: "0 0 12px" }}>
                          <div style={{ ...s.row, justifyContent: "space-between" }}>
                            <span style={{ ...s.body, margin: 0, fontWeight: 600 }}>{word(o, lang)}</span>
                            <span style={{ ...s.body, margin: 0 }}>
                              {t("grow.admin.countPair", { submitted: c.submitted, part: c.part_way })}
                            </span>
                          </div>
                          <div aria-hidden="true" style={{ height: 10, borderRadius: 6, background: "#EEF0F2", overflow: "hidden", marginTop: 4 }}>
                            <div style={{ width: `${pct}%`, height: "100%", background: C.green }} />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}

                {rq.type === "text" &&
                  (rq.texts.length === 0 ? (
                    <p style={s.muted}>{t("grow.admin.noWritten")}</p>
                  ) : (
                    <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                      {rq.texts.map((x, k) => (
                        <li key={k} data-written={x.status} style={{ borderInlineStart: `3px solid ${x.status === "submitted" ? C.green : C.warmGray}`, padding: "6px 12px", margin: "0 0 10px" }}>
                          <p dir="auto" style={{ ...s.body, whiteSpace: "pre-wrap", margin: "0 0 2px" }}>{x.text}</p>
                          <p style={{ ...s.muted, margin: 0 }}>
                            {x.status === "submitted" ? t("grow.admin.submittedTag") : t("grow.admin.partWayTag")}
                          </p>
                        </li>
                      ))}
                    </ul>
                  ))}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
