/* ════════════════════════════════════════════════
   Voice — the third of §6's three labelled buttons, and the player for
   what it records.

   PRODUCT_DECISIONS §6: "Three labelled buttons under the composer:
   Photo · Voice · Sticker", and "a voice note is a playable waveform".
   SPEC.md caps a voice note at two minutes.

   ON THE WORD "WAVEFORM": this draws a progress bar, not a picture of
   the audio. Drawing a real one means decoding the whole file to read
   its amplitudes, and drawing a FAKE one — a row of pretty bars with no
   relationship to the sound — would be a decoration pretending to be
   information. What §6 is asking for is that a voice note be playable
   in place rather than a file to download, and that is what this is: a
   large play button, the length in seconds before anything is fetched,
   and a bar that moves with the sound. The real waveform is a later
   pass, noted rather than faked.

   WHY THE LENGTH IS STORED (0074, audio_seconds): so the row can say
   "0:34" before the audio is downloaded. On a Pakistani mobile
   connection, knowing how long something is before deciding to fetch it
   is the difference between a voice note and a surprise.

   Recording asks for the microphone at the moment the person taps
   Voice, never earlier — the permission prompt makes sense next to the
   button that caused it, and nowhere else.
   ════════════════════════════════════════════════ */

import { useEffect, useRef, useState } from "react";
import { APP_COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";

export const MAX_SECONDS = 120;

const mmss = (n) => {
  const s = Math.max(0, Math.round(n || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/* The container's own choice, since browsers disagree: Chrome and
   Firefox give webm/opus, Safari gives mp4/aac. Both are in the
   bucket's allowed types (0074). */
function pickMime() {
  if (typeof MediaRecorder === "undefined") return null;
  for (const m of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"]) {
    try {
      if (MediaRecorder.isTypeSupported(m)) return m;
    } catch {
      /* older browsers throw rather than answer */
    }
  }
  return null;
}

/* maxSeconds is a PROP because the two surfaces disagree on purpose:
   a DM voice note may run to two minutes (SPEC.md), a voice POST is
   capped at one (POSTS_SPEC §7). One recorder with two limits, rather
   than a second recorder that drifts away from this one. */
export function VoiceRecorder({ disabled, onRecorded, maxSeconds = MAX_SECONDS, label }) {
  const { t, ts } = useI18n();
  const [state, setState] = useState("idle"); // idle | recording | error
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");

  const recRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const tickRef = useRef(null);
  const keepRef = useRef(true);

  const cleanup = () => {
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((tr) => tr.stop());
      streamRef.current = null;
    }
    recRef.current = null;
    chunksRef.current = [];
  };

  useEffect(() => cleanup, []);

  const start = async () => {
    setError("");
    const mime = pickMime();
    if (!mime || !navigator.mediaDevices?.getUserMedia) {
      setError("people.thread.voiceUnsupported");
      return;
    }
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      /* Refusing the microphone is a decision, not a fault. */
      setError("people.thread.voiceDenied");
      return;
    }
    streamRef.current = stream;
    keepRef.current = true;
    chunksRef.current = [];

    /* 32 kbps mono. MediaRecorder's default came out at roughly 115
       kbps when measured — about 860KB for a minute — which is a music
       bitrate being spent on one person talking. Opus at 32k is
       comfortably clear for speech and is roughly a quarter of the
       size, which on a free Supabase tier is the difference between a
       few hundred voice posts and a few thousand, and on a Pakistani
       mobile connection is the difference between a listener tapping
       play and giving up. Measured, not assumed: see the storage note
       in tonight's report. */
    const rec = new MediaRecorder(stream, { mimeType: mime, audioBitsPerSecond: 32000 });
    recRef.current = rec;
    rec.ondataavailable = (e) => {
      if (e.data && e.data.size) chunksRef.current.push(e.data);
    };
    rec.onstop = () => {
      const seconds = Math.round((Date.now() - startedAt) / 1000);
      const blob = new Blob(chunksRef.current, { type: mime.split(";")[0] });
      cleanup();
      setState("idle");
      setElapsed(0);
      if (keepRef.current && blob.size > 0 && seconds >= 1) {
        onRecorded(blob, Math.min(seconds, maxSeconds), mime.split(";")[0]);
      }
    };

    const startedAt = Date.now();
    rec.start();
    setState("recording");
    setElapsed(0);
    tickRef.current = setInterval(() => {
      const n = Math.round((Date.now() - startedAt) / 1000);
      setElapsed(n);
      // Two minutes, stopped by the app rather than left to run.
      if (n >= maxSeconds) {
        try { rec.stop(); } catch { /* already stopping */ }
      }
    }, 250);
  };

  const stop = (keep) => {
    keepRef.current = keep;
    try {
      recRef.current?.stop();
    } catch {
      cleanup();
      setState("idle");
    }
  };

  if (state === "recording") {
    return (
      <div
        role="status"
        style={{
          display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
          padding: "0 14px", minHeight: 56, borderRadius: 50,
          background: "#FBF0E6", border: `2px solid ${C.brown}`,
        }}
      >
        <span aria-hidden="true" style={{ fontSize: ts(20) }}>🔴</span>
        <span style={{ fontSize: ts(A11Y.minBodyPx), fontWeight: 700, color: C.textMain }}>
          {mmss(elapsed)} / {mmss(maxSeconds)}
        </span>
        <button
          type="button"
          onClick={() => stop(true)}
          style={{
            minHeight: A11Y.minTapTargetPx, padding: "0 18px", borderRadius: 50, border: "none",
            background: C.green, color: C.cream, fontFamily: "inherit",
            fontSize: ts(17), fontWeight: 700, cursor: "pointer",
          }}
        >
          {t("people.thread.voiceStop")}
        </button>
        <button
          type="button"
          onClick={() => stop(false)}
          style={{
            minHeight: A11Y.minTapTargetPx, padding: "0 18px", borderRadius: 50,
            border: `2px solid ${C.warmGray}`, background: C.white, color: C.textMain,
            fontFamily: "inherit", fontSize: ts(17), fontWeight: 600, cursor: "pointer",
          }}
        >
          {t("people.thread.voiceCancel")}
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={start}
        disabled={disabled}
        /* The accessible name must be the name a person can SEE. This
           was a fixed "Voice" while the visible label became "Say it
           out loud" on the composer, so a screen reader announced one
           thing and the screen said another — found because a test
           looked the button up by its accessible name and could not
           find the words printed on it. */
        aria-label={label || t("people.thread.voiceCta")}
        style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          minHeight: 56, padding: "0 16px", borderRadius: 50,
          border: `2px solid ${C.green}`, background: C.white, color: C.green,
          fontFamily: "inherit", fontSize: ts(A11Y.minBodyPx), fontWeight: 600,
          opacity: disabled ? 0.5 : 1, cursor: disabled ? "default" : "pointer",
        }}
      >
        <span aria-hidden="true" style={{ fontSize: ts(22) }}>🎤</span>
        {label || t("people.thread.voiceCta")}
      </button>
      {error && (
        <p role="alert" style={{ width: "100%", color: C.brown, fontWeight: 700, fontSize: ts(16), margin: "6px 0 0" }}>
          ⚠ {t(error)}
        </p>
      )}
    </>
  );
}

/* The playable part. A large button, the length, and a bar that moves. */
export function VoicePlayer({ url, seconds, mine }) {
  const { t, ts } = useI18n();
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [at, setAt] = useState(0);

  const total = seconds || 0;
  const pct = total ? Math.min(100, (at / total) * 100) : 0;

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      a.pause();
    } else {
      a.play().catch(() => setPlaying(false));
    }
  };

  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: 12,
        minWidth: 210, padding: "10px 14px", borderRadius: 18,
        background: mine ? C.sage : C.white,
        border: `2px solid ${mine ? C.sage : C.warmGray}`,
      }}
    >
      <button
        type="button"
        onClick={toggle}
        aria-label={t(playing ? "people.thread.voicePause" : "people.thread.voicePlay")}
        style={{
          minWidth: A11Y.minTapTargetPx, minHeight: A11Y.minTapTargetPx,
          borderRadius: "50%", border: "none", background: C.green, color: C.cream,
          fontSize: ts(20), cursor: "pointer", flexShrink: 0,
        }}
      >
        <span aria-hidden="true">{playing ? "❚❚" : "▶"}</span>
      </button>

      <div style={{ flex: 1, minWidth: 90 }}>
        <div
          style={{ height: 8, borderRadius: 50, background: C.cream, overflow: "hidden" }}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total || 100}
          aria-valuenow={Math.round(at)}
          aria-label={t("people.thread.voiceNote")}
        >
          <div style={{ width: `${pct}%`, height: "100%", background: C.green, transition: "width .2s linear" }} />
        </div>
        <span style={{ display: "block", marginTop: 4, fontSize: ts(15), color: C.textMuted, fontWeight: 600 }}>
          🎤 {playing || at > 0 ? `${mmss(at)} / ${mmss(total)}` : mmss(total)}
        </span>
      </div>

      <audio
        ref={audioRef}
        src={url || undefined}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setAt(0); }}
        onTimeUpdate={(e) => setAt(e.currentTarget.currentTime)}
        style={{ display: "none" }}
      />
    </div>
  );
}
