/* ════════════════════════════════════════════════
   A group's cover — GROUPS_SPEC §1, §3.

   §3 opens the group interior with "Cover · name · member count · the
   group's own feed", and §1 says the type chosen on the first screen
   "gives a DEFAULT COVER IMAGE, so nobody has to find a photo".

   ── Why the default is drawn, not a stock photograph ──

   §1 keeps cover and description OUT of creation because "older users
   abandon at the photo step". A cover that only exists once somebody
   uploads one puts that step straight back, just later. So every
   group has a cover from the moment it exists: a band of colour and
   the type's mark, chosen by the type. It is not a placeholder
   waiting to be replaced — it is a finished, respectable cover that a
   photograph may improve.

   Six types, six colours, and the same colour every time for the same
   type, so a walking group looks like a walking group across the app.

   A real photograph, when there is one, lives in the private
   group-covers bucket and arrives as a signed URL. Until it arrives
   the preset shows, so the header never collapses or flashes empty.
   ════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { APP_COLORS as C } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import Icon from "../../components/Icon.jsx";
import { coverFor, signedCoverUrl } from "./groupsStore.js";

/* Deliberately not the brand green for all six: a group's cover is
   the one place a group gets to look like itself rather than like the
   app. Muted, because a cover sits behind a name that must stay
   readable. */
/* Marks come from the app's drawn set, not the system emoji font.
   A cover is the largest mark on the screen, so an emoji here was
   the most visible piece of the old vocabulary left. Names checked
   against components/Icon.jsx — it renders nothing for one it does
   not know. */
const PRESETS = {
  walking:   { from: "#5B7A46", to: "#8CA86B", mark: "walk" },
  chai:      { from: "#8A5A2B", to: "#C08B54", mark: "diet" },
  books:     { from: "#3F5A78", to: "#7192B5", mark: "saved" },
  family:    { from: "#7A4A5E", to: "#B0798F", mark: "people" },
  gardening: { from: "#3F6B4A", to: "#79A882", mark: "park" },
  other:     { from: "#6B5E52", to: "#A29384", mark: "gathering" },
};

/* The picker reads this rather than listing the six itself — one
   source, so a seventh type cannot appear in one place and not the
   other. */
export const COVER_PRESETS = Object.keys(PRESETS);

export default function GroupCover({ group, height = 132 }) {
  const { ts } = useI18n();
  const [photo, setPhoto] = useState(null);
  const cover = coverFor(group);

  useEffect(() => {
    let alive = true;
    setPhoto(null);
    if (cover.kind === "photo") {
      signedCoverUrl(cover.path).then((u) => alive && setPhoto(u)).catch(() => {});
    }
    return () => { alive = false; };
  }, [group?.cover]);

  const preset = PRESETS[cover.key] || PRESETS.other;

  return (
    <div
      aria-hidden="true"
      style={{
        height,
        borderRadius: 18,
        marginBottom: 14,
        overflow: "hidden",
        background: photo
          ? `center / cover no-repeat url("${photo}")`
          : `linear-gradient(135deg, ${preset.from}, ${preset.to})`,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "flex-end",
      }}
    >
      {!photo && (
        <span style={{ opacity: 0.9, padding: "0 18px 12px 0", color: "#fff" }}>
          <Icon name={preset.mark} size={Math.round(height * 0.34)} strokeWidth={1.5} />
        </span>
      )}
    </div>
  );
}
