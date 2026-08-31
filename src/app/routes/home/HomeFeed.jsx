/* ════════════════════════════════════════════════
   The newest of the community, on the home screen.

   The point of the whole redesign: as the day's own business finishes,
   the cards for it become chips, and THIS takes the room they leave.
   A finished day should not leave an empty screen with nothing to do —
   it should leave the people.

   Deliberately a READER, not a second feed. No composer, no comments,
   no reactions, no moderation controls — those all live in Community,
   one tap away, and duplicating them here would mean two places to fix
   every time the rules change. It shows a handful of the newest posts
   and then gets out of the way with a link.

   Shows nothing at all rather than an empty box: on a quiet day the
   home screen simply ends, which is calmer than a heading over
   nothing.
   ════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { APP_COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { fetchFeed, fetchAuthors, imageUrl } from "../community/communityData.js";
import { parseStickerRef, Sticker } from "../../assets/stickers/stickers.jsx";

const SHOW = 4;

function timeAgo(iso, t) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return t("hub.feed.minsAgo", { n: Math.max(1, mins) });
  const hours = Math.round(mins / 60);
  if (hours < 24) return t("hub.feed.hoursAgo", { n: hours });
  return t("hub.feed.daysAgo", { n: Math.round(hours / 24) });
}

export default function HomeFeed() {
  const { t, ts, meta, lang } = useI18n();
  const [posts, setPosts] = useState(null);
  const [people, setPeople] = useState({});

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const rows = await fetchFeed(SHOW);
        if (!alive) return;
        setPosts(rows);
        if (rows.length) setPeople(await fetchAuthors(rows.map((r) => r.author_id)));
      } catch {
        // The feed is a gift, not a duty: a failure leaves the screen
        // as it was rather than showing an error to somebody at home.
        if (alive) setPosts([]);
      }
    })();
    return () => { alive = false; };
  }, []);

  if (!posts || posts.length === 0) return null;

  const lineFor = (p) => {
    switch (p.post_type) {
      case "badge": {
        const name = (lang === "ur" ? p.payload?.name_ur : p.payload?.name_en) || p.payload?.name_en || "";
        return `${p.payload?.emoji || "🏅"} ${t("hub.feed.badge", { badge: name })}`;
      }
      case "score": return t("hub.feed.score");
      case "walk": return t("hub.feed.walk");
      case "activity": return p.payload?.activity || t("hub.feed.activity");
      case "game_open": return t("hub.feed.game");
      case "event": return t("hub.feed.event");
      default: return (p.body || "").trim();
    }
  };

  return (
    <section style={{ marginTop: 4 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
        <h2
          style={{
            fontFamily: meta.fonts.heading,
            fontSize: ts(20),
            fontWeight: 700,
            color: C.brown,
            margin: 0,
          }}
        >
          {t("hub.feed.title")}
        </h2>
        <Link
          to="/app/community"
          style={{
            display: "inline-flex",
            alignItems: "center",
            minHeight: A11Y.minTapTargetPx,
            padding: "0 10px",
            color: C.green,
            fontSize: ts(16),
            fontWeight: 700,
            textDecoration: "none",
          }}
        >
          {t("hub.feed.all")} {meta.dir === "rtl" ? "‹" : "›"}
        </Link>
      </div>

      {posts.map((p) => {
        const line = lineFor(p);
        const sticker = parseStickerRef(p.body);
        const img = imageUrl(p.image_path);
        const who = (people[p.author_id]?.full_name || "").split(" ")[0];
        return (
          <Link
            key={p.id}
            to="/app/community"
            style={{
              display: "block",
              background: C.white,
              border: `1.5px solid ${C.warmGray}`,
              borderRadius: 16,
              padding: "12px 16px",
              marginBottom: 10,
              textDecoration: "none",
              color: C.textMain,
            }}
          >
            <span style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: ts(16), fontWeight: 800, color: C.green }}>{who || "…"}</span>
              <span style={{ fontSize: ts(14), color: C.textMuted }}>{timeAgo(p.created_at, t)}</span>
            </span>
            {sticker ? (
              <Sticker id={sticker} size={72} />
            ) : (
              line && (
                <span
                  style={{
                    display: "block",
                    fontSize: ts(A11Y.minBodyPx),
                    lineHeight: 1.5,
                    overflowWrap: "anywhere",
                  }}
                >
                  {line.length > 140 ? `${line.slice(0, 140)}…` : line}
                </span>
              )
            )}
            {img && (
              <img
                src={img}
                alt=""
                loading="lazy"
                style={{ width: "100%", borderRadius: 12, marginTop: 8, display: "block" }}
              />
            )}
          </Link>
        );
      })}
    </section>
  );
}
