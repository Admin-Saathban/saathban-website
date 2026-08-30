/* ════════════════════════════════════════════════
   What a moderator actually has to judge — the reported file.

   This exists because voice posts could not ship without it. A
   reported voice note arrived in the queue as "(no excerpt captured)":
   the row rendered perfectly and the moderator had nothing whatsoever
   to go on. Shipping audio into a seniors' community with no way to
   review a complaint about it is a safety gap, not a polish one.

   TWO BUCKETS, ONE PLAYER. A reported voice POST is read straight out
   of post-audio, which admins may read (0078). A reported DM voice
   note is read from report-evidence — a copy the reporter's own client
   handed over — because admins have NO read path into DM threads and
   this file is not going to be the thing that quietly creates one
   (QUESTIONS.md C5).

   The URL is signed briefly and only when the moderator asks. A queue
   that pre-signed every attachment would be a page that downloads a
   stranger's private audio on load, which is the opposite of the
   restraint the rest of the admin surface is built with — nothing is
   fetched until somebody decides to look.
   ════════════════════════════════════════════════ */

import { useState } from "react";
import { COLORS as C } from "../../../shared/tokens.js";
import supabase from "../../lib/supabase.js";

const mmss = (n) => {
  const s = Math.max(0, Math.round(n || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export default function ReportedMedia({ bucket, path, kind }) {
  const [url, setUrl] = useState(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  if (!bucket || !path) return null;

  const open = async () => {
    if (busy || url) return;
    setBusy(true);
    setFailed(false);
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 600);
    if (error || !data?.signedUrl) setFailed(true);
    else setUrl(data.signedUrl);
    setBusy(false);
  };

  const box = {
    margin: "0 0 12px",
    padding: "12px 14px",
    borderRadius: 12,
    background: C.cream,
    border: `2px solid ${C.warmGray}`,
  };

  return (
    <div style={box}>
      <p style={{ margin: "0 0 8px", fontSize: 15, color: C.textMuted, fontWeight: 700 }}>
        {kind === "audio" ? "🎤 Reported voice recording" : "🖼️ Reported image"}
        {bucket === "report-evidence" && " · copy handed over by the reporter"}
      </p>

      {!url ? (
        <>
          <button
            type="button"
            onClick={open}
            disabled={busy}
            style={{
              minHeight: 48,
              padding: "0 20px",
              borderRadius: 50,
              border: "none",
              background: C.green,
              color: C.cream,
              fontFamily: "inherit",
              fontSize: 16,
              fontWeight: 700,
              cursor: busy ? "default" : "pointer",
            }}
          >
            {busy ? "Opening…" : kind === "audio" ? "Listen to it" : "Look at it"}
          </button>
          {failed && (
            <p role="alert" style={{ margin: "8px 0 0", color: C.brown, fontWeight: 700, fontSize: 15 }}>
              That file could not be opened — it may have been deleted since the report.
            </p>
          )}
        </>
      ) : kind === "audio" ? (
        /* Native controls on purpose: a moderator needs to scrub, pause
           and replay a specific second, and a custom player that only
           plays start-to-finish makes reviewing a two-minute complaint
           a two-minute job every time. */
        <audio src={url} controls preload="metadata" style={{ width: "100%" }} />
      ) : (
        <img src={url} alt="Reported" style={{ maxWidth: "100%", borderRadius: 10, display: "block" }} />
      )}
    </div>
  );
}

export { mmss };
