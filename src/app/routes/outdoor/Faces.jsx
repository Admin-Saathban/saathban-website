/* ════════════════════════════════════════════════
   Who is there now — OUT_AND_ABOUT_SPEC §3.

   "Who is there now — FACES FIRST, then words. 'Three people here
    now' with overlapping avatars. A 70-year-old recognises Fatima's
    face faster than she reads a sentence. This is the whole point of
    the feature and it is currently hidden one tap in."

   So the faces come before the sentence in the DOM, not just visually
   — a screen reader hears the names too, and the order is the point.

   ── "Quiet right now", never "0 people" ──

   §3 is explicit: never "0 people", which is a scoreboard reading
   nil. An empty park is not a failure and must not be shown as one.
   "Quiet right now" is also true in a way "0 people" is not: quiet is
   a reason some people go.

   ── Why initials are a real fallback and not a placeholder ──

   Signing an avatar URL is a round trip per person, and a list of
   twenty places would be a hundred of them. So faces render
   immediately as initials on a stable per-person colour, and real
   photos replace them as their signed URLs arrive. Nobody waits on a
   spinner to find out whether the park is busy, and a person with no
   photo — most of this audience — is not a grey silhouette among
   people who have one.
   ════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { APP_COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { signedAvatarUrl } from "../profile/avatar.js";

/* A stable colour per person, so the same face keeps the same colour
   between renders and between screens — recognition is the feature. */
const TINTS = ["#7A9A5B", "#B07A4A", "#6B7FA8", "#A86B8F", "#5B8A8A", "#9A7B4A"];
const tintFor = (id) => {
  let h = 0;
  for (let i = 0; i < (id || "").length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return TINTS[h % TINTS.length];
};
const initialOf = (name) => (name || "").trim().charAt(0).toUpperCase() || "·";

function Face({ id, name, avatarUrl, size }) {
  const [src, setSrc] = useState(null);
  useEffect(() => {
    let alive = true;
    if (avatarUrl) signedAvatarUrl(avatarUrl).then((u) => alive && setSrc(u)).catch(() => {});
    return () => { alive = false; };
  }, [avatarUrl]);

  return (
    <span
      title={name || undefined}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        borderRadius: "50%",
        background: src ? C.warmGray : tintFor(id),
        color: C.white,
        border: `2px solid ${C.white}`,
        marginInlineEnd: -Math.round(size * 0.28),
        fontSize: Math.round(size * 0.44),
        fontWeight: 700,
        overflow: "hidden",
        flex: "0 0 auto",
      }}
    >
      {src ? (
        <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        initialOf(name)
      )}
    </span>
  );
}

export default function Faces({ people = [], size = 30, max = 4, style }) {
  const { t, ts } = useI18n();

  /* §3: "Quiet right now" when empty. Never a count of nothing. */
  if (people.length === 0) {
    return (
      <span style={{ display: "block", fontSize: ts(16), color: C.textMuted, ...style }}>
        {t("outdoor.who.quiet")}
      </span>
    );
  }

  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  const names = people.map((p) => p.name).filter(Boolean);

  /* The words that go beside the faces. Names while there are few
     enough to be worth reading — recognising that Fatima is there is
     the entire reason to look — and a count once a name list would
     just be a wall. */
  const words =
    names.length === 0
      ? t("outdoor.who.hereMany", { n: people.length })
      : people.length === 1
        ? t("outdoor.who.hereOne", { name: names[0] })
        : people.length === 2
          ? t("outdoor.who.hereTwo", { a: names[0], b: names[1] })
          : t("outdoor.who.hereMany", { n: people.length });

  return (
    <span style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4, ...style }}>
      {/* Faces first — in the DOM, so this is the order read aloud too. */}
      <span style={{ display: "inline-flex", alignItems: "center", paddingInlineEnd: Math.round(size * 0.28) }}>
        {shown.map((p) => (
          <Face key={p.id} id={p.id} name={p.name} avatarUrl={p.avatarUrl} size={size} />
        ))}
        {extra > 0 && (
          <span
            aria-hidden="true"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: size,
              height: size,
              borderRadius: "50%",
              background: C.cream,
              color: C.textMuted,
              border: `2px solid ${C.white}`,
              marginInlineEnd: -Math.round(size * 0.28),
              fontSize: Math.round(size * 0.38),
              fontWeight: 700,
              flex: "0 0 auto",
            }}
          >
            +{extra}
          </span>
        )}
      </span>
      <span style={{ fontSize: ts(16), color: C.olive, fontWeight: 600, minWidth: 0 }}>{words}</span>
    </span>
  );
}
