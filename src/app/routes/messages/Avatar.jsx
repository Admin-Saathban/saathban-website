/* Photo with initials fallback — MESSAGES_SPEC §3, owner's ruling.

   The fallback is not a grey silhouette. A circle with an initial in
   the brand sage says "this is a person we know the name of"; a
   silhouette says "unknown", which is wrong for somebody in your
   chats. Most Icons will not have uploaded a photo for months.

   `about` draws the presence ring (§5.4). It is passed in rather than
   computed here, because whether presence may be shown at all is a
   question about permission and freshness, not about drawing. */

import { APP_COLORS as C } from "../../../shared/tokens.js";

export default function Avatar({ person, size = 52, about = false }) {
  const name = (person?.full_name || "").trim();
  const initial = name ? name.charAt(0).toUpperCase() : "·";
  const url = person?.avatar_url || null;

  return (
    <span
      style={{
        position: "relative",
        width: size,
        height: size,
        flexShrink: 0,
        display: "inline-block",
      }}
    >
      {url ? (
        <img
          src={url}
          alt=""
          style={{
            width: size,
            height: size,
            borderRadius: "50%",
            objectFit: "cover",
            display: "block",
          }}
        />
      ) : (
        <span
          aria-hidden="true"
          style={{
            width: size,
            height: size,
            borderRadius: "50%",
            background: C.sage,
            color: C.cream,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: Math.round(size * 0.42),
            fontWeight: 700,
          }}
        >
          {initial}
        </span>
      )}
      {about && (
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            bottom: 0,
            insetInlineEnd: 0,
            width: Math.max(12, Math.round(size * 0.26)),
            height: Math.max(12, Math.round(size * 0.26)),
            borderRadius: "50%",
            background: C.green,
            border: `2.5px solid ${C.bg}`,
          }}
        />
      )}
    </span>
  );
}
