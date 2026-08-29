/* Post-submit and rejection screens for the vetting flow.

   Every one of these is a door, not a wall: each explains what is
   true, what happens next, and how to reach Saathban. The pipeline
   view never shows "rejected" — a rejection renders as the cooldown
   screen with a date, not a scarlet letter.

   All copy resolves from locales/ under vetting.status.* and
   vetting.refused.*. */

import { COLORS as C } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { COOLDOWN_DAYS } from "./supabaseVetting.js";

const card = {
  background: C.white,
  border: `2px solid ${C.sage}`,
  borderRadius: 22,
  padding: "28px 22px",
  marginTop: 24,
};

const h1For = (meta) => ({
  fontFamily: meta.fonts.heading,
  fontSize: "clamp(1.6rem, 5vw, 2.1rem)",
  fontWeight: 700,
  color: C.green,
  lineHeight: 1.2,
  margin: "0 0 12px",
});

const bodyText = { fontSize: 19, lineHeight: 1.6, color: C.textMain, margin: "0 0 16px" };
const mutedText = { fontSize: 18, lineHeight: 1.6, color: C.textMuted, margin: 0 };

/* ─── The pipeline, applicant's view ─── */

const PIPELINE = [
  { status: "pending", labelKey: "vetting.status.pendingLabel", nowKey: "vetting.status.pendingNow" },
  {
    status: "interviewing",
    labelKey: "vetting.status.interviewingLabel",
    nowKey: "vetting.status.interviewingNow",
  },
  {
    status: "probation",
    labelKey: "vetting.status.probationLabel",
    nowKey: "vetting.status.probationNow",
  },
  { status: "active", labelKey: "vetting.status.activeLabel", nowKey: "vetting.status.activeNow" },
];

export function ApplicationStatus({ application, justSubmitted }) {
  const { t, lang, meta } = useI18n();
  const dateLocale = lang === "ur" ? "ur-PK" : "en-GB";

  if (application.status === "suspended") {
    return (
      <div style={card}>
        <p aria-hidden="true" style={{ fontSize: 40, margin: "0 0 8px" }}>🍂</p>
        <h1 style={h1For(meta)}>{t("vetting.status.suspendedTitle")}</h1>
        <p style={bodyText}>{t("vetting.status.suspendedBody")}</p>
        <p style={mutedText}>{t("vetting.status.suspendedFooter")}</p>
      </div>
    );
  }

  const stageIndex = Math.max(
    0,
    PIPELINE.findIndex((p) => p.status === application.status)
  );
  const applied = new Date(application.created_at);

  return (
    <div style={card}>
      <p aria-hidden="true" style={{ fontSize: 40, margin: "0 0 8px" }}>🌱</p>
      <h1 style={h1For(meta)}>
        {justSubmitted ? t("vetting.status.received") : t("vetting.status.yours")}
      </h1>
      {justSubmitted && <p style={bodyText}>{t("vetting.status.thanks")}</p>}

      <ol style={{ listStyle: "none", margin: "8px 0 20px", padding: 0 }}>
        {PIPELINE.map((p, i) => {
          const done = i < stageIndex;
          const current = i === stageIndex;
          return (
            <li
              key={p.status}
              aria-current={current ? "step" : undefined}
              style={{ display: "flex", gap: 14, marginBottom: 4 }}
            >
              <span style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <span
                  aria-hidden="true"
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: "50%",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 18,
                    fontWeight: 700,
                    background: done || current ? C.green : C.white,
                    color: done || current ? C.cream : C.textMuted,
                    border: `2.5px solid ${done || current ? C.green : C.warmGray}`,
                    flexShrink: 0,
                  }}
                >
                  {done ? "✓" : i + 1}
                </span>
                {i < PIPELINE.length - 1 && (
                  <span
                    aria-hidden="true"
                    style={{
                      width: 3,
                      flex: 1,
                      minHeight: 18,
                      background: done ? C.green : C.warmGray,
                      margin: "4px 0",
                    }}
                  />
                )}
              </span>
              <span style={{ paddingBottom: 16 }}>
                <span
                  style={{
                    display: "block",
                    fontSize: 19,
                    fontWeight: 700,
                    color: current ? C.green : done ? C.textMain : C.textMuted,
                  }}
                >
                  {t(p.labelKey)}
                  {current ? t("vetting.status.youAreHere") : ""}
                </span>
                {current && (
                  <span
                    style={{
                      display: "block",
                      fontSize: 18,
                      lineHeight: 1.55,
                      color: C.textMain,
                      marginTop: 4,
                    }}
                  >
                    {t(p.nowKey)}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ol>

      {application.status === "pending" && (
        <p style={{ ...mutedText, marginBottom: 12 }}>{t("vetting.status.refsHeadsUp")}</p>
      )}
      <p style={mutedText}>
        {t("vetting.status.appliedOn", {
          date: applied.toLocaleDateString(dateLocale, {
            day: "numeric",
            month: "long",
            year: "numeric",
          }),
        })}
      </p>
    </div>
  );
}

/* ─── Kind rejection screens ─── */

const ERROR_SCREENS = {
  under18: {
    icon: "🌤️",
    titleKey: "vetting.refused.under18Title",
    bodyKey: "vetting.refused.under18Body",
    footerKey: "vetting.refused.under18Footer",
  },
  cooldown: {
    icon: "🍃",
    titleKey: "vetting.refused.cooldownTitle",
    bodyKey: "vetting.refused.cooldownBody",
    footerKey: "vetting.refused.cooldownFooter",
  },
  blocked: {
    icon: "🌙",
    titleKey: "vetting.refused.blockedTitle",
    bodyKey: "vetting.refused.blockedBody",
    footerKey: null,
  },
  generic: {
    icon: "🌦️",
    titleKey: "vetting.refused.genericTitle",
    bodyKey: "vetting.refused.genericBody",
    footerKey: "vetting.refused.genericFooter",
  },
};

export function KindErrorScreen({ code, daysLeft, onRetry }) {
  const { t, meta } = useI18n();
  const s = ERROR_SCREENS[code] || ERROR_SCREENS.generic;
  return (
    <div style={{ ...card, border: `2px solid ${C.warmGray}` }}>
      <p aria-hidden="true" style={{ fontSize: 40, margin: "0 0 8px" }}>{s.icon}</p>
      <h1 style={h1For(meta)}>{t(s.titleKey)}</h1>
      <p style={bodyText}>{t(s.bodyKey, { days: COOLDOWN_DAYS })}</p>
      {code === "cooldown" && daysLeft > 0 && (
        <p style={{ ...bodyText, fontWeight: 700, color: C.green }}>
          {daysLeft === 1
            ? t("vetting.refused.applyAgainOne")
            : t("vetting.refused.applyAgainMany", { n: daysLeft })}
        </p>
      )}
      {s.footerKey && <p style={mutedText}>{t(s.footerKey)}</p>}
      {code === "generic" && onRetry && (
        <button
          type="button"
          onClick={onRetry}
          style={{
            marginTop: 20,
            minHeight: 56,
            padding: "0 32px",
            borderRadius: 50,
            border: "none",
            background: C.green,
            color: C.cream,
            fontSize: 19,
            fontWeight: 700,
            fontFamily: "inherit",
            cursor: "pointer",
          }}
        >
          {t("vetting.refused.backToForm")}
        </button>
      )}
    </div>
  );
}
