/* ════════════════════════════════════════════════
   /app/buddy — the Saath-Buddy home (after-sign-in landing).

   Always reflects the real pipeline status — an active Buddy never
   sees "start my application" again:

     no application      → the door to /app/vetting
     pending/interviewing/
     probation           → status summary + the documents channel
     active              → active home: status, matched-Icons
                           placeholder, documents channel
     suspended           → paused notice only — the documents channel
                           and matching section are withdrawn
     rejected (cooldown) → the vetting screen explains the wait

   Documents channel (migration 0015): requests staff made in the
   admin lane appear here; the Buddy uploads the file to their own
   folder in the PRIVATE buddy-documents bucket, the row flips to
   received, and the requesting admin is notified — all server-side.

   Strings are local English for now — i18n lane: lift under buddy.*.
   ════════════════════════════════════════════════ */

import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { COLORS as C, FONTS, A11Y } from "../../../shared/tokens.js";
import { useSession } from "../../lib/session.jsx";
import AppHeader from "../../components/AppHeader.jsx";
import supabase from "../../lib/supabase.js";
import {
  fetchOwnApplications,
  liveApplication,
  cooldownDaysLeft,
  uploadBuddyDocument,
} from "../vetting/supabaseVetting.js";

const STATUS_LINE = {
  pending: "Your application is with the review team.",
  interviewing: "We're at the conversation stage — expect our call.",
  probation: "You're volunteering alongside an experienced Buddy.",
  active: "You're a full Saath-Buddy. Thank you for what you're giving.",
};

const card = {
  background: C.white,
  border: `2px solid ${C.warmGray}`,
  borderRadius: 18,
  padding: "20px 22px",
  marginBottom: 16,
};

export default function BuddyHome() {
  const { profile } = useSession();
  const firstName = (profile?.full_name || "").split(" ")[0];

  const [application, setApplication] = useState(undefined); // undefined = loading
  const [cooldown, setCooldown] = useState(0);
  const [requests, setRequests] = useState([]);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const fileInputs = useRef({});

  const load = useCallback(async () => {
    try {
      const rows = await fetchOwnApplications();
      const live = liveApplication(rows);
      setApplication(live ?? null);
      setCooldown(cooldownDaysLeft(rows));
      if (live && live.status !== "suspended") {
        const { data } = await supabase
          .from("buddy_document_requests")
          .select("*")
          .order("created_at");
        setRequests(data || []);
      } else {
        setRequests([]);
      }
    } catch {
      setApplication(null);
      setError("Something didn't load. Pull down or try again in a moment.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const respond = async (req, file) => {
    if (!file) return;
    setBusyId(req.id);
    setError("");
    try {
      const path = await uploadBuddyDocument(
        profile.id,
        `doc-${req.id.slice(0, 8)}`,
        file
      );
      const { error: err } = await supabase
        .from("buddy_document_requests")
        .update({ response_path: path })
        .eq("id", req.id);
      if (err) throw err;
      await load();
    } catch (e) {
      setError(e.message || "The upload didn't go through. Please try again.");
    } finally {
      setBusyId(null);
    }
  };

  const status = application?.status;
  const showDocuments =
    application && status !== "suspended" && requests.length > 0;

  return (
    <>
      <AppHeader />
      <main
        style={{
          minHeight: "100vh",
          background: C.bg,
          color: C.textMain,
          fontFamily: FONTS.sans,
          padding: "20px 16px 56px",
        }}
      >
        <div style={{ maxWidth: 620, margin: "0 auto" }}>
          <h1
            style={{
              fontFamily: FONTS.serif,
              fontSize: 30,
              fontWeight: 700,
              color: C.green,
              margin: "6px 0 20px",
            }}
          >
            {firstName ? `Welcome, ${firstName}` : "Welcome"}
          </h1>

          {error && (
            <p role="alert" style={{ color: C.brown, fontWeight: 700 }}>
              ⚠ {error}
            </p>
          )}

          {/* ── Status ── */}
          {application === undefined ? (
            <p style={{ color: C.textMuted }} role="status">Loading…</p>
          ) : application === null ? (
            <section style={card}>
              <h2 style={{ fontFamily: FONTS.serif, fontSize: 22, color: C.brown, margin: "0 0 8px" }}>
                {cooldown > 0 ? "About your application" : "Your volunteer application"}
              </h2>
              <p style={{ fontSize: A11Y.minBodyPx, lineHeight: 1.6, margin: "0 0 16px" }}>
                {cooldown > 0
                  ? `You can apply again in ${cooldown} day${cooldown === 1 ? "" : "s"} — the details are on the application page.`
                  : "Becoming a Saath-Buddy starts with an application and an interview — the care we take is part of the promise."}
              </p>
              <Link
                to="/app/vetting"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  minHeight: A11Y.minTapTargetPx,
                  padding: "0 28px",
                  borderRadius: 50,
                  background: C.green,
                  color: C.cream,
                  fontSize: A11Y.minBodyPx,
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                {cooldown > 0 ? "See the details" : "Start my application"}
              </Link>
            </section>
          ) : status === "suspended" ? (
            <section style={card}>
              <h2 style={{ fontFamily: FONTS.serif, fontSize: 22, color: C.brown, margin: "0 0 8px" }}>
                Your volunteering is paused
              </h2>
              <p style={{ fontSize: A11Y.minBodyPx, lineHeight: 1.6, margin: 0 }}>
                A person at Saathban will be in touch. If you'd like to talk
                sooner, write to team@saathban.org.
              </p>
            </section>
          ) : (
            <>
              <section style={{ ...card, borderColor: status === "active" ? C.green : C.warmGray }}>
                <h2 style={{ fontFamily: FONTS.serif, fontSize: 22, color: C.green, margin: "0 0 8px" }}>
                  {status === "active" ? "You're an active Saath-Buddy" : "Your application"}
                </h2>
                <p style={{ fontSize: A11Y.minBodyPx, lineHeight: 1.6, margin: 0 }}>
                  {STATUS_LINE[status]}
                  {status !== "active" && (
                    <>
                      {" "}
                      <Link to="/app/vetting" style={{ color: C.green, fontWeight: 600 }}>
                        See the full picture
                      </Link>
                    </>
                  )}
                </p>
              </section>

              {status === "active" && (
                <section style={card}>
                  <h2 style={{ fontFamily: FONTS.serif, fontSize: 22, color: C.brown, margin: "0 0 8px" }}>
                    Your Saath-Icons
                  </h2>
                  <p style={{ fontSize: A11Y.minBodyPx, lineHeight: 1.6, color: C.textMuted, margin: 0 }}>
                    Matching opens soon — when it does, the people you're
                    paired with appear here, with everything you need for a
                    good visit.
                  </p>
                </section>
              )}
            </>
          )}

          {/* ── Documents channel ── */}
          {showDocuments && (
            <section style={card}>
              <h2 style={{ fontFamily: FONTS.serif, fontSize: 22, color: C.brown, margin: "0 0 8px" }}>
                Documents
              </h2>
              <p style={{ fontSize: 16, color: C.textMuted, margin: "0 0 14px", lineHeight: 1.6 }}>
                Anything the team has asked for appears here. Photos go to your
                own private folder — only you and the review team can see them.
              </p>
              <div style={{ display: "grid", gap: 12 }}>
                {requests.map((r) => (
                  <div
                    key={r.id}
                    style={{
                      border: `1px solid ${C.warmGray}`,
                      borderRadius: 12,
                      padding: "12px 16px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <strong style={{ fontSize: A11Y.minBodyPx }}>{r.doc_type}</strong>
                      <span
                        style={{
                          fontWeight: 700,
                          fontSize: 15,
                          color: r.status === "received" ? C.green : C.brown,
                        }}
                      >
                        {r.status === "received"
                          ? r.response_path
                            ? "✓ uploaded"
                            : "✓ received"
                          : "waiting for you"}
                      </span>
                    </div>
                    {r.note && (
                      <p style={{ margin: "6px 0 0", fontSize: 16, color: C.textMuted }}>{r.note}</p>
                    )}
                    {r.status === "awaiting" && (
                      <div style={{ marginTop: 10 }}>
                        <input
                          ref={(el) => (fileInputs.current[r.id] = el)}
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          style={{ display: "none" }}
                          onChange={(e) => respond(r, e.target.files?.[0])}
                        />
                        <button
                          type="button"
                          disabled={busyId === r.id}
                          onClick={() => fileInputs.current[r.id]?.click()}
                          style={{
                            minHeight: A11Y.minTapTargetPx,
                            padding: "0 24px",
                            borderRadius: 50,
                            border: "none",
                            background: C.green,
                            color: C.cream,
                            fontFamily: FONTS.sans,
                            fontSize: A11Y.minBodyPx,
                            fontWeight: 600,
                            cursor: busyId === r.id ? "default" : "pointer",
                            opacity: busyId === r.id ? 0.6 : 1,
                          }}
                        >
                          {busyId === r.id ? "Uploading…" : "Upload a photo of it"}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </main>
    </>
  );
}
