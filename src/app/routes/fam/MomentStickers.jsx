/* ════════════════════════════════════════════════
   A one-tap sticker on something their person shared.

   PRODUCT_DECISIONS §10, on the home that must not be a status board:
   "her photo with a ONE-TAP STICKER ... a badge to CHEER". Both are the
   same small act — noticing out loud — so they are one control here
   rather than two features that behave differently.

   One tap, no sheet, no compose box, no second confirm. The row is
   four stickers; touching one sends it and touching it again takes it
   back. That is the entire interaction, because the thing being
   answered is a photo, and anything longer turns a warm reflex into a
   task.

   It rides post_reactions — the SAME table and the same policies the
   community feed uses (one reaction per person per post, insert gated
   on can_use_community, delete gated on it being yours). A Fam member
   may react and always could; nothing was widened to allow this. Their
   person sees it where they shared it, in the feed, exactly as they
   would see a neighbour's.

   Only ever offered on what the person CHOSE to share publicly, which
   is the only window famMoments reads through at all.
   ════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { COLORS as C } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { useSession } from "../../lib/session.jsx";
import {
  fetchReactions,
  setReaction,
  clearReaction,
} from "../../routes/community/communityData.js";

/* Warmth, applause, a smile, a flower. No thumbs-down, and nothing
   that could be read as a verdict on how somebody's day went. */
const STICKERS = ["❤️", "👏", "😊", "🌸"];

export default function MomentStickers({ postId }) {
  const { t, ts } = useI18n();
  const { profile } = useSession();
  const myId = profile?.id;

  const [mine, setMine] = useState(null);
  const [others, setOthers] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!postId || !myId) return undefined;
    let dead = false;
    (async () => {
      try {
        const rows = await fetchReactions([postId]);
        if (dead) return;
        setMine(rows.find((r) => r.profile_id === myId)?.emoji || null);
        setOthers(rows.filter((r) => r.profile_id !== myId).map((r) => r.emoji));
      } catch {
        /* reactions are a nicety; a moment still reads without them */
      }
    })();
    return () => { dead = true; };
  }, [postId, myId]);

  if (!myId) return null;

  const tap = async (emoji) => {
    if (busy) return;
    setBusy(true);
    const previous = mine;
    const next = mine === emoji ? null : emoji;
    setMine(next);                       // the tap answers immediately
    try {
      if (next) await setReaction(postId, myId, next);
      else await clearReaction(postId, myId);
    } catch {
      setMine(previous);                 // and takes itself back if it didn't land
    }
    setBusy(false);
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", margin: "2px 0 10px" }}>
      {STICKERS.map((s) => {
        const on = mine === s;
        return (
          <button
            key={s}
            type="button"
            onClick={() => tap(s)}
            disabled={busy}
            aria-pressed={on}
            aria-label={t("fam.sticker.send", { sticker: s })}
            className="sb-pressable"
            style={{
              minWidth: 48,
              minHeight: 48,
              borderRadius: 50,
              border: on ? `3px solid ${C.green}` : `2px solid ${C.warmGray}`,
              background: on ? "#EEF3E8" : C.white,
              fontSize: ts(22),
              lineHeight: 1,
              cursor: "pointer",
            }}
          >
            <span aria-hidden="true">{s}</span>
          </button>
        );
      })}
      {/* What other people already sent — a quiet echo, never a count
          that could be read as a score on somebody's day. */}
      {others.length > 0 && (
        <span style={{ fontSize: ts(18), marginInlineStart: 4 }} aria-label={t("fam.sticker.othersLabel")}>
          {[...new Set(others)].join(" ")}
        </span>
      )}
    </div>
  );
}
