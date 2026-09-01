/* ════════════════════════════════════════════════
   A player's face, at the table.

   The app has had profile photos since 0085 and the game never showed
   one: every circle at every table drew an initial, including for the
   person who had just uploaded a picture of themselves. The owner's
   report is the shortest possible statement of it — "I have a photo
   and it doesn't show."

   THE PATH IS NOT A URL. avatar_url on profiles stores a PATH into a
   private bucket; reading it needs a signed URL that expires in an
   hour. signedAvatarUrl caches per path for slightly less than that,
   so a table drawing four faces on every poll costs four cache hits
   and no network.

   THE INITIAL IS NOT A PLACEHOLDER, IT IS THE FALLBACK. It shows
   while the signature is in flight, and it stays for anybody who has
   no photo — which will be most people for a long time. So it has to
   look deliberate rather than like a picture that failed, which is
   why the circle keeps its colour and its weight either way and the
   photo simply covers it when it arrives.
   ════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { signedAvatarUrl } from "../profile/avatar.js";

/* path → a usable src, or null while it is being signed / if there
   is none. Safe with null, and safe to call on every render. */
export function useSignedAvatar(path) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    if (!path) {
      setUrl(null);
      return undefined;
    }
    let alive = true;
    signedAvatarUrl(path)
      .then((u) => alive && setUrl(u || null))
      /* A face that will not load is not an error worth showing
         anybody: the initial is already there underneath. */
      .catch(() => alive && setUrl(null));
    return () => {
      alive = false;
    };
  }, [path]);
  return url;
}

/* The photo itself, drawn over whatever is already in the circle.
   Absolute, so the initial underneath never moves when it arrives. */
export function AvatarPhoto({ src, alt = "" }) {
  if (!src) return null;
  return (
    <img
      src={src}
      alt={alt}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        objectFit: "cover",
        borderRadius: "50%",
      }}
    />
  );
}
