/* Entry for preview-screens.html — renders every status/refusal screen
   with fixture data, stacked, for visual review. Dev-only. */

import React from "react";
import ReactDOM from "react-dom/client";
import { COLORS as C, FONTS } from "../../../shared/tokens.js";
import { ApplicationStatus, KindErrorScreen } from "./screens.jsx";

const FIXTURE_APP = (status) => ({
  status,
  created_at: "2026-08-20T10:00:00Z",
  decided_at: null,
});

function Gallery() {
  const block = (label, node) => (
    <section key={label} style={{ marginBottom: 40 }}>
      <p
        style={{
          fontFamily: FONTS.sans,
          fontSize: 18,
          fontWeight: 700,
          color: C.textMuted,
          margin: "0 0 4px",
        }}
      >
        ▸ {label}
      </p>
      {node}
    </section>
  );

  return (
    <main
      style={{
        background: C.bg,
        minHeight: "100vh",
        fontFamily: FONTS.sans,
        padding: "24px 16px 64px",
      }}
    >
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        {block(
          "status: pending, just submitted",
          <ApplicationStatus application={FIXTURE_APP("pending")} justSubmitted />
        )}
        {block(
          "status: interviewing, revisit",
          <ApplicationStatus application={FIXTURE_APP("interviewing")} />
        )}
        {block(
          "status: probation, revisit",
          <ApplicationStatus application={FIXTURE_APP("probation")} />
        )}
        {block(
          "status: suspended",
          <ApplicationStatus application={FIXTURE_APP("suspended")} />
        )}
        {block("refusal: under 18", <KindErrorScreen code="under18" />)}
        {block(
          "refusal: cooldown (23 days left)",
          <KindErrorScreen code="cooldown" daysLeft={23} />
        )}
        {block("refusal: blocked", <KindErrorScreen code="blocked" />)}
        {block(
          "refusal: generic with retry",
          <KindErrorScreen code="generic" onRetry={() => {}} />
        )}
      </div>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Gallery />
  </React.StrictMode>
);
