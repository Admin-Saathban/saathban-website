/* Post-submit and rejection screens for the vetting flow.

   Every one of these is a door, not a wall: each explains what is
   true, what happens next, and how to reach Saathban. The pipeline
   view never shows "rejected" — a rejection renders as the cooldown
   screen with a date, not a scarlet letter. */

import { COLORS as C, FONTS } from "../../../shared/tokens.js";
import { COOLDOWN_DAYS } from "./supabaseVetting.js";

const card = {
  background: C.white,
  border: `2px solid ${C.sage}`,
  borderRadius: 22,
  padding: "28px 22px",
  marginTop: 24,
};

const h1 = {
  fontFamily: FONTS.serif,
  fontSize: "clamp(1.6rem, 5vw, 2.1rem)",
  fontWeight: 700,
  color: C.green,
  lineHeight: 1.2,
  margin: "0 0 12px",
};

const bodyText = { fontSize: 19, lineHeight: 1.6, color: C.textMain, margin: "0 0 16px" };
const mutedText = { fontSize: 18, lineHeight: 1.6, color: C.textMuted, margin: 0 };

/* ─── The pipeline, applicant's view ─── */

const PIPELINE = [
  {
    status: "pending",
    label: "Received",
    now: "Your application is with the review team — a person reads every one, your own words first.",
  },
  {
    status: "interviewing",
    label: "Talking",
    now: "We're at the conversation stage — expect our call, and please give your references a heads-up too.",
  },
  {
    status: "probation",
    label: "Probation",
    now: "You're volunteering alongside an experienced Buddy while we all find our feet together.",
  },
  {
    status: "active",
    label: "Active",
    now: "You're a full Saath-Buddy. Thank you for what you're giving.",
  },
];

export function ApplicationStatus({ application, justSubmitted }) {
  if (application.status === "suspended") {
    return (
      <div style={card}>
        <p aria-hidden="true" style={{ fontSize: 40, margin: "0 0 8px" }}>🍂</p>
        <h1 style={h1}>Your volunteering is paused</h1>
        <p style={bodyText}>
          We've paused things while we look into something — that's all this
          screen can say, and we know that's uncomfortable. Someone from
          Saathban will contact you directly to talk it through.
        </p>
        <p style={mutedText}>
          If you'd rather not wait, write to us and we'll pick it up:
          team@saathban.org
        </p>
      </div>
    );
  }

  const stageIndex = Math.max(
    0,
    PIPELINE.findIndex((p) => p.status === application.status)
  );
  const stage = PIPELINE[stageIndex];
  const applied = new Date(application.created_at);

  return (
    <div style={card}>
      <p aria-hidden="true" style={{ fontSize: 40, margin: "0 0 8px" }}>🌱</p>
      <h1 style={h1}>
        {justSubmitted ? "Application received" : "Your application"}
      </h1>
      {justSubmitted && (
        <p style={bodyText}>Thank you — genuinely. Here's where things stand:</p>
      )}

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
                  {p.label}
                  {current ? " — you are here" : ""}
                </span>
                {current && (
                  <span style={{ display: "block", fontSize: 18, lineHeight: 1.55, color: C.textMain, marginTop: 4 }}>
                    {p.now}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ol>

      {application.status === "pending" && (
        <p style={{ ...mutedText, marginBottom: 12 }}>
          We'll phone both of your references before anything moves — please
          let them know to expect a call from Saathban.
        </p>
      )}
      <p style={mutedText}>
        Applied on {applied.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}.
        We'll reach you by email and phone at every stage — there's nothing
        you need to do here.
      </p>
    </div>
  );
}

/* ─── Kind rejection screens ─── */

const ERROR_SCREENS = {
  under18: {
    icon: "🌤️",
    title: "Not just yet",
    body:
      "Saath-Buddies need to be at least 18, so we can't take your " +
      "application today — and we're genuinely glad you want to do this. " +
      "The door opens on your eighteenth birthday, and seniors will still " +
      "need company then.",
    footer: "Until then: visiting your own elders counts just as much.",
  },
  cooldown: {
    icon: "🍃",
    title: "A little more time",
    body:
      "A previous application was decided recently, and our rule is the " +
      `same for everyone: ${COOLDOWN_DAYS} days before a fresh start. ` +
      "This isn't a judgement of you — it's how we keep every review fair " +
      "and unhurried.",
    footer:
      "If you believe something was missed, write to team@saathban.org and " +
      "a person will look at it.",
  },
  blocked: {
    icon: "🌙",
    title: "We can't take this application",
    body:
      "Something on the account is stopping applications right now. This " +
      "screen can't see why — but a person can. Write to team@saathban.org " +
      "and we'll explain directly.",
    footer: null,
  },
  generic: {
    icon: "🌦️",
    title: "That didn't go through",
    body:
      "Something went wrong on our side while sending your application. " +
      "Nothing you entered was lost — please try again in a moment.",
    footer: "If it keeps happening, write to team@saathban.org.",
  },
};

export function KindErrorScreen({ code, daysLeft, onRetry }) {
  const s = ERROR_SCREENS[code] || ERROR_SCREENS.generic;
  return (
    <div style={{ ...card, border: `2px solid ${C.warmGray}` }}>
      <p aria-hidden="true" style={{ fontSize: 40, margin: "0 0 8px" }}>{s.icon}</p>
      <h1 style={h1}>{s.title}</h1>
      <p style={bodyText}>{s.body}</p>
      {code === "cooldown" && daysLeft > 0 && (
        <p style={{ ...bodyText, fontWeight: 700, color: C.green }}>
          You can apply again in {daysLeft} {daysLeft === 1 ? "day" : "days"}.
        </p>
      )}
      {s.footer && <p style={mutedText}>{s.footer}</p>}
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
            fontFamily: FONTS.sans,
            cursor: "pointer",
          }}
        >
          Back to my application
        </button>
      )}
    </div>
  );
}
