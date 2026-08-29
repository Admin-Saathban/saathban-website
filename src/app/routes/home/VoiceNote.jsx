/* ════════════════════════════════════════════════
   Voice note — real MediaRecorder capture for mood and exercise notes.

   Record (up to 2 minutes, with a running clock), listen back,
   re-record, then attach: the file goes to the PRIVATE 'voice-notes'
   bucket under <icon_id>/… (migration 0033 — owner + mood-permitted
   circle reads only; playback through short-lived signed URLs). The
   log payload keeps { path, mime, seconds }.

   Graceful edges, all in words:
   - no MediaRecorder / no mic API → the button is replaced by a line
     saying so; the written note next to it is the fallback.
   - permission denied → same, with a nudge that typing works fine.
   - format detection: Chrome/Firefox give webm/opus, iOS Safari gives
     mp4 (and only recently has MediaRecorder at all). We ask
     isTypeSupported() in order and upload with the BASE mime (no
     ";codecs=" suffix) so the bucket's allow-list matches.
   ════════════════════════════════════════════════ */

import { useEffect, useRef, useState } from "react";
import { COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import supabase from "../../lib/supabase.js";
import { pushToast } from "../../lib/feedback.jsx";

export const VOICE_BUCKET = "voice-notes";
export const VOICE_MAX_SECONDS = 120;

const CANDIDATES = [
  ["audio/webm;codecs=opus", "audio/webm", "webm"],
  ["audio/webm", "audio/webm", "webm"],
  ["audio/mp4", "audio/mp4", "m4a"],
  ["audio/aac", "audio/aac", "aac"],
  ["audio/ogg;codecs=opus", "audio/ogg", "ogg"],
];

function pickFormat() {
  if (typeof window === "undefined" || !window.MediaRecorder) return null;
  for (const [full, base, ext] of CANDIDATES) {
    try {
      if (window.MediaRecorder.isTypeSupported(full)) return { full, base, ext };
    } catch {
      /* keep looking */
    }
  }
  // Some Safari builds answer false to everything yet record mp4 fine.
  return { full: "", base: "audio/mp4", ext: "m4a" };
}

function newId() {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6)}`;
  }
}

const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/* Signed-URL player for a saved note. Used inline in the day view. */
export function VoicePlayer({ voice, compact }) {
  const { t, ts } = useI18n();
  const [url, setUrl] = useState(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    setUrl(null);
    setFailed(false);
    if (!voice?.path) return undefined;
    supabase.storage
      .from(VOICE_BUCKET)
      .createSignedUrl(voice.path, 3600)
      .then(({ data, error }) => {
        if (!alive) return;
        if (error || !data?.signedUrl) setFailed(true);
        else setUrl(data.signedUrl);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [voice?.path]);
  if (!voice?.path) return null;
  if (failed) {
    return (
      <p style={{ fontSize: ts(16), color: C.textMuted, margin: "6px 0 0" }}>{t("home.log.voiceUnavailable")}</p>
    );
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: compact ? 6 : 10 }}>
      <span aria-hidden="true" style={{ fontSize: ts(20) }}>🎙️</span>
      {url ? (
        <audio controls src={url} preload="none" style={{ minHeight: A11Y.minTapTargetPx, maxWidth: "100%" }}>
          {t("home.log.voiceUnavailable")}
        </audio>
      ) : (
        <span role="status" style={{ fontSize: ts(16), color: C.textMuted }}>…</span>
      )}
      {voice.seconds ? (
        <span style={{ fontSize: ts(16), color: C.textMuted }}>{mmss(voice.seconds)}</span>
      ) : null}
    </div>
  );
}

export default function VoiceNote({ iconId, value, onChange, dateIso, moduleKey, editable = true }) {
  const { t, ts } = useI18n();
  const format = useRef(pickFormat());
  const supported = !!format.current && !!navigator.mediaDevices?.getUserMedia;

  // idle | recording | preview | uploading | denied | failed
  const [phase, setPhase] = useState("idle");
  const [seconds, setSeconds] = useState(0);
  const [blob, setBlob] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const recorder = useRef(null);
  const chunks = useRef([]);
  const timer = useRef(null);
  const stream = useRef(null);

  const cleanupStream = () => {
    stream.current?.getTracks().forEach((tr) => tr.stop());
    stream.current = null;
  };
  useEffect(() => () => {
    clearInterval(timer.current);
    cleanupStream();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const start = async () => {
    if (!supported) return;
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setPhase("denied");
      return;
    }
    try {
      const opts = format.current.full ? { mimeType: format.current.full } : undefined;
      const rec = new window.MediaRecorder(stream.current, opts);
      chunks.current = [];
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.current.push(e.data);
      };
      rec.onstop = () => {
        const type = rec.mimeType || format.current.full || format.current.base;
        const b = new Blob(chunks.current, { type });
        cleanupStream();
        clearInterval(timer.current);
        setBlob(b);
        setPreviewUrl((old) => {
          if (old) URL.revokeObjectURL(old);
          return URL.createObjectURL(b);
        });
        setPhase("preview");
      };
      recorder.current = rec;
      rec.start(1000);
      setSeconds(0);
      setPhase("recording");
      timer.current = setInterval(() => {
        setSeconds((s) => {
          if (s + 1 >= VOICE_MAX_SECONDS) {
            try {
              rec.stop();
            } catch {
              /* already stopped */
            }
            return VOICE_MAX_SECONDS;
          }
          return s + 1;
        });
      }, 1000);
    } catch {
      cleanupStream();
      setPhase("failed");
    }
  };

  const stop = () => {
    try {
      recorder.current?.stop();
    } catch {
      setPhase("failed");
    }
  };

  const discard = () => {
    setBlob(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setSeconds(0);
    setPhase("idle");
  };

  const attach = async () => {
    if (!blob || !iconId) return;
    setPhase("uploading");
    const base = (blob.type || format.current.base).split(";")[0] || format.current.base;
    const ext = base === "audio/mp4" ? "m4a" : base === "audio/ogg" ? "ogg" : base === "audio/aac" ? "aac" : "webm";
    const path = `${iconId}/${dateIso}-${moduleKey}-${newId()}.${ext}`;
    const { error } = await supabase.storage
      .from(VOICE_BUCKET)
      .upload(path, blob, { contentType: base, upsert: false });
    if (error) {
      setPhase("failed");
      return;
    }
    // Replacing an earlier note: best-effort removal of the old file.
    if (value?.path) {
      supabase.storage.from(VOICE_BUCKET).remove([value.path]).catch(() => {});
    }
    onChange({ path, mime: base, seconds });
    pushToast(t("feedback.voiceSaved"));
    discard();
  };

  const remove = async () => {
    if (value?.path) {
      await supabase.storage.from(VOICE_BUCKET).remove([value.path]).catch(() => {});
    }
    onChange(null);
  };

  const pill = (label, onClick, tone = "green", extra = {}) => (
    <button
      type="button"
      onClick={onClick}
      style={{
        minHeight: A11Y.minTapTargetPx,
        padding: "0 18px",
        borderRadius: 50,
        border: `2px solid ${tone === "brown" ? C.brown : C.green}`,
        background: tone === "brown" ? C.brown : C.white,
        color: tone === "brown" ? C.cream : C.green,
        fontSize: ts(18),
        fontWeight: 600,
        fontFamily: "inherit",
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        cursor: "pointer",
        ...extra,
      }}
    >
      {label}
    </button>
  );

  const muted = (text) => (
    <p role="status" style={{ fontSize: ts(17), color: C.textMuted, margin: "8px 0 0", lineHeight: 1.5 }}>
      {text}
    </p>
  );

  // A saved note, whatever the phase: always playable.
  const saved = value?.path ? <VoicePlayer voice={value} /> : null;

  if (!editable) return saved;

  if (!supported) {
    return (
      <div>
        {saved}
        {muted(t("home.log.voiceUnsupported"))}
      </div>
    );
  }

  return (
    <div style={{ marginTop: 10 }}>
      {saved}
      {phase === "idle" && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: saved ? 8 : 0 }}>
          {pill(
            <>
              <span aria-hidden="true">🎤</span>
              {value?.path ? t("home.log.recordAgain") : t("home.log.speakInstead")}
            </>,
            start
          )}
          {value?.path
            ? pill(t("home.log.voiceRemove"), remove, "green", { borderColor: C.warmGray, color: C.textMuted })
            : <span style={{ fontSize: ts(17), color: C.textMuted }}>{t("home.log.upToTwoMinutes")}</span>}
        </div>
      )}
      {phase === "recording" && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          {pill(
            <>
              <span aria-hidden="true">⏹</span>
              {t("home.log.recording")}
            </>,
            stop,
            "brown"
          )}
          <span role="timer" aria-live="off" style={{ fontSize: ts(20), fontWeight: 700, color: C.brown }}>
            ● {mmss(seconds)} / {mmss(VOICE_MAX_SECONDS)}
          </span>
        </div>
      )}
      {phase === "preview" && (
        <div>
          <p style={{ fontSize: ts(17), color: C.textMain, margin: "0 0 6px", fontWeight: 600 }}>
            {t("home.log.voiceListen")}
          </p>
          <audio controls src={previewUrl} style={{ minHeight: A11Y.minTapTargetPx, maxWidth: "100%" }} />
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
            {pill(`✓ ${t("home.log.voiceAttach")}`, attach)}
            {pill(t("home.log.recordAgain"), () => { discard(); start(); })}
            {pill(t("home.log.voiceDiscard"), discard, "green", { borderColor: C.warmGray, color: C.textMuted })}
          </div>
        </div>
      )}
      {phase === "uploading" && muted(t("home.log.voiceSaving"))}
      {phase === "denied" && (
        <div>
          {muted(t("home.log.voiceDenied"))}
          {pill(t("home.log.voiceTryAgain"), () => setPhase("idle"), "green", { marginTop: 8 })}
        </div>
      )}
      {phase === "failed" && (
        <div>
          {muted(t("home.log.voiceFailed"))}
          {pill(t("home.log.voiceTryAgain"), discard, "green", { marginTop: 8 })}
        </div>
      )}
    </div>
  );
}
