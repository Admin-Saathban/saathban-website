/* ════════════════════════════════════════════════
   Grow with Saathban — data layer (migrations 0160–0166).

   Every read and write is a database function. Nothing here decides
   whether a course is finished, whether a survey is offered, or what is
   pending: the server computes each from ONE state (course_progress,
   survey_responses, survey_dismissals) and this file only asks.
   ════════════════════════════════════════════════ */

import supabase from "../../lib/supabase.js";

async function rpc(fn, args) {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) {
    const e = new Error(error.message);
    e.code = error.code;
    e.hint = error.hint;
    throw e;
  }
  return data;
}

/* ── People ── */
export const fetchGrowPage = () => rpc("grow_page");

export const fetchCourse = (ref) => rpc("course_for_me", { p_ref: ref });
export const answerModule = (courseId, moduleKey, answer) =>
  rpc("course_answer_module", { p_course: courseId, p_module: moduleKey, p_answer: answer ?? null });
export const submitExam = (courseId, answers) =>
  rpc("course_submit_exam", { p_course: courseId, p_answers: answers });

export const fetchSurvey = (ref) => rpc("survey_for_me", { p_ref: ref });
export const saveSurveyAnswer = (surveyId, key, value) =>
  rpc("survey_save_answer", { p_survey: surveyId, p_key: key, p_value: value ?? null });
export const submitSurvey = (surveyId) => rpc("survey_submit", { p_survey: surveyId });
export const withdrawSurvey = (surveyId) => rpc("survey_withdraw", { p_survey: surveyId });
export const dismissSurvey = (surveyId) => rpc("survey_dismiss", { p_survey: surveyId });

/* ── Admin (is_admin at the database) ── */
export const adminOverview = () => rpc("admin_grow_overview");
export const adminSaveCourse = (id, fields) => rpc("admin_save_course", { p_id: id || null, p: fields });
export const adminSetCourseStatus = (id, status) => rpc("admin_set_course_status", { p_id: id, p_status: status });
export const adminSaveSurvey = (id, fields) => rpc("admin_save_survey", { p_id: id || null, p: fields });
export const adminSetSurveyStatus = (id, status) => rpc("admin_set_survey_status", { p_id: id, p_status: status });
export const adminSurveyPeople = (surveyId) => rpc("admin_survey_people", { p_survey: surveyId });
export const adminReofferSurvey = (surveyId, profileId = null) =>
  rpc("admin_reoffer_survey", { p_survey: surveyId, p_profile: profileId });
export const adminPendingAdd = ({ course = null, survey = null, skill = null, audience = [] }) =>
  rpc("admin_pending_add", { p_course: course, p_survey: survey, p_skill: skill, p_audience: audience });
export const adminPendingUpdate = (id, audience) => rpc("admin_pending_update", { p_id: id, p_audience: audience });
export const adminPendingRemove = (id) => rpc("admin_pending_remove", { p_id: id });
export const adminPendingReorder = (ids) => rpc("admin_pending_reorder", { p_ids: ids });

/* ── Results (super admin at the database; every read audited) ── */
export const fetchSurveyResults = (surveyId) => rpc("survey_results", { p_survey: surveyId });
export const markResultsExported = (surveyId) => rpc("survey_results_exported", { p_survey: surveyId });

/* ── Helpers ── */

/* Bilingual content from the database: the active language, English
   when the Urdu is still blank on a draft. */
export function pick(obj, field, lang) {
  if (!obj) return "";
  const ur = obj[`${field}_ur`];
  const en = obj[`${field}_en`];
  return (lang === "ur" ? ur || en : en || ur) || "";
}

/* Option/question wording lives as { en, ur }. */
export function word(obj, lang) {
  if (!obj) return "";
  return (lang === "ur" ? obj.ur || obj.en : obj.en || obj.ur) || "";
}

export const ROLE_VALUES = ["saath_icon", "saath_buddy", "family_member", "admin"];

/* Lower-case keys, safe as CSV headers and stable across wording edits
   (the database checks ^[a-z0-9_]{1,40}$). */
export function newKey(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 8).replace(/[^a-z0-9]/g, "x")}`;
}
