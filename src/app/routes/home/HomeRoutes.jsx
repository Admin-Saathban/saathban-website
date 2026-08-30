/* ════════════════════════════════════════════════
   Saath-Icon home area — /app/home/*.

   index  → IconHub  (the after-sign-in landing: greeting, today at a
                      glance, cards to every area)
   log    → IconHome (the daily log page — calendar strip, log card,
                      score & sharing)

   Both pages render their own AppHeader.
   ════════════════════════════════════════════════ */

import { useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import IconHub from "./IconHub.jsx";
import IconHome from "./IconHome.jsx";
import FirstRun from "../onboarding/FirstRun.jsx";
import { useSession } from "../../lib/session.jsx";

export default function HomeRoutes() {
  const { profile } = useSession();
  /* PRODUCT_DECISIONS §2 — the first three screens.

     A GATE, NOT A ROUTE. It sits in front of the whole home area
     rather than beside it, so there is no url that skips it and none
     that can be reached again once it is done. The stamp lives in
     profiles.settings (jsonb, already NOT NULL) — no schema for a
     thing that is only ever true once.

     The local flag lets the last screen hand over immediately instead
     of waiting for the profile to be refetched: on a slow connection
     that gap is a person tapping "Skip for now" and watching the same
     screen sit there. */
  const [justOnboarded, setJustOnboarded] = useState(false);
  if (profile && !profile.settings?.onboarded_at && !justOnboarded) {
    return <FirstRun profile={profile} onDone={() => setJustOnboarded(true)} />;
  }

  return (
    <Routes>
      <Route index element={<IconHub />} />
      <Route path="log" element={<IconHome />} />
      <Route path="*" element={<Navigate to="/app/home" replace />} />
    </Routes>
  );
}
