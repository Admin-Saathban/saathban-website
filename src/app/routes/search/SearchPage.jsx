/* ════════════════════════════════════════════════
   Search — /app/search. NAVIGATION_SPEC §5.

   FULL SCREEN, ARRIVING FROM THE RIGHT, because the magnifier is on
   the right of the header (MOTION_SPEC §1). Deliberately not a drawer:
   a drawer is for choosing between a fixed set of things, and search
   is a place a person works. It needs the keyboard and the whole
   screen.

   One box. Four groups under plain labels, always in the same order —
   People, Groups, Out and about, Posts — so the shape of the answer is
   the same every time and a person learns where to look. No tabs: tabs
   would hide three of the four answers behind a guess about which kind
   of thing they were after.

   NEVER A BLANK PAGE (§5). Before typing there are recent searches and
   places to go. An empty search box with nothing under it is the
   screen that teaches people the feature is broken.

   ── ON THE ACTION THAT SITS ON THE ROW ──

   §5 asks for Join on a public group and Ask on a private one. The
   schema has no way to do either: `group_invites` runs inviter →
   invitee, and there is no join-request RPC in any migration. A button
   labelled Join that cannot join is the exact defect this redesign
   exists to remove, so the row offers Open — which is true, because
   0063 lets anyone see a group whose privacy is 'anyone'. The missing
   RPC is reported rather than papered over.
   ════════════════════════════════════════════════ */

import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { APP_COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import AppHeader from "../../components/AppHeader.jsx";
import Icon from "../../components/Icon.jsx";
import { arrivalClass, openFullScreen } from "../../components/motion.jsx";
import {
  searchPeople,
  searchGroups,
  searchPlaces,
  searchPosts,
  myGroupIds,
  loadRecents,
  rememberSearch,
  forgetRecents,
  suggestedGroups,
  requestToJoinGroup,
  joinPublicGroup,
  myJoinRequests,
} from "./searchData.js";

const DEBOUNCE_MS = 260;
const MIN_CHARS = 2;

function Row({ children, onClick, label }) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 12,
          minHeight: 56,
          /* FULL BLEED, NO CORNER, NO SIDE MARGIN (§4.1 + the owner's
             30 August pass). A row used to be a rounded white card
             inset from both edges: that spent about 32px of a 390px
             screen on gutter, and the rounded corner said "card" when
             §4.1 reserves an outline for "you can tap this". The row
             is plain white to both edges now, and the grey ground
             between rows is what separates them. */
          padding: "10px 16px",
          borderRadius: 0,
          border: "none",
          background: C.white,
          color: C.textMain,
          textAlign: "start",
          fontFamily: "inherit",
          cursor: "pointer",
          marginBottom: 1,
        }}
      >
        {children}
      </button>
    </li>
  );
}

function Group({ title, children }) {
  const { ts, meta } = useI18n();
  return (
    <section style={{ marginBottom: 18 }}>
      <h2
        style={{
          fontFamily: meta.fonts.heading,
          fontSize: ts(17),
          fontWeight: 700,
          color: C.textMuted,
          margin: "0 16px 8px",
          /* No border, no pill: §4.1 says a heading is not a control. */
          letterSpacing: 0.2,
        }}
      >
        {title}
      </h2>
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>{children}</ul>
    </section>
  );
}

/* §5 puts the action ON the row. Which action depends on three facts
   the row already knows: whether you are in the group, whether it is
   open to anyone, and what happened the last time you asked.

   "Not this time" exists because 0086 KEEPS a declined row. Without
   it the button would quietly return to "Ask to join" and a person
   would ask again and again, never learning that anything had
   happened. The row is the place they asked, so the row is where the
   answer belongs. */
function GroupRow({ g, mine, asked, onAsk, onJoin, onOpen, busy }) {
  const { t, ts } = useI18n();
  const isMember = mine.has(g.id);
  const state = asked[g.id];
  const open = g.privacy === "anyone";

  /* §5: JOIN what is open, ASK what is not.

     These were the wrong way round until 0089 — a public group
     offered "Ask to join" and a private one offered nothing at all,
     which made the open groups feel guarded and the closed ones
     invisible. Now the row says what the group actually is.

     The order matters: what you already are beats what happened last
     time, which beats what you could do. */
  const action = isMember
    ? { label: t("search.joined"), act: null }
    : state === "pending"
    ? { label: t("search.asked"), act: null }
    : state === "declined"
    ? { label: t("search.notThisTime"), act: onAsk }
    : open
    ? { label: t("search.join"), act: onJoin }
    : { label: t("search.ask"), act: onAsk };

  return (
    <li>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          minHeight: 56,
          padding: "10px 16px",
          background: C.white,
          marginBottom: 1,
        }}
      >
        <button
          type="button"
          onClick={onOpen}
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            alignItems: "center",
            gap: 12,
            border: "none",
            background: "none",
            padding: 0,
            textAlign: "start",
            fontFamily: "inherit",
            color: C.textMain,
            cursor: "pointer",
          }}
        >
          <Icon name="groups" size={22} style={{ color: C.green }} />
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "block", fontSize: ts(17), fontWeight: 600, lineHeight: 1.3 }}>
              {g.name}
            </span>
            {!open && (
              <span style={{ display: "block", fontSize: ts(14), color: C.textMuted, marginTop: 2 }}>
                {t("search.privateGroup")}
              </span>
            )}
          </span>
        </button>

        {action.label && (action.act ? (
          <button
            type="button"
            onClick={action.act}
            disabled={busy}
            style={{
              flexShrink: 0,
              minHeight: A11Y.minTapTargetPx,
              padding: "0 16px",
              borderRadius: 50,
              /* An outline, because §4.1 reserves one for exactly this:
                 a thing you can tap. It is the only outline on the row. */
              border: `2px solid ${C.green}`,
              background: "transparent",
              color: C.green,
              fontSize: ts(15),
              fontWeight: 700,
              fontFamily: "inherit",
              cursor: busy ? "default" : "pointer",
            }}
          >
            {action.label}
          </button>
        ) : (
          <span style={{ flexShrink: 0, fontSize: ts(15), fontWeight: 600, color: C.textMuted }}>
            {action.label}
          </span>
        ))}
      </div>
    </li>
  );
}

export default function SearchPage() {
  const { t, ts, meta } = useI18n();
  const navigate = useNavigate();
  const { state } = useLocation();

  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState(null); // null = nothing searched yet
  const [mine, setMine] = useState(new Set());
  const [recents, setRecents] = useState(loadRecents);
  const [suggested, setSuggested] = useState([]);
  /* group id -> "pending" | "approved" | "declined". §5 puts the action
     ON the row, which means the row also has to carry what happened to
     it last time. */
  const [asked, setAsked] = useState({});
  const boxRef = useRef(null);

  /* The keyboard should already be up. Somebody who tapped a magnifier
     has said what they want to do next. */
  useEffect(() => {
    boxRef.current?.focus();
    myGroupIds().then(setMine).catch(() => {});
    /* §5 — never a blank page. Fetched on arrival rather than on
       first keystroke, because the whole point is that something is
       already there when the screen opens. */
    suggestedGroups().then(setSuggested).catch(() => {});
    myJoinRequests().then(setAsked).catch(() => {});
  }, []);

  useEffect(() => {
    const term = q.trim();
    if (term.length < MIN_CHARS) {
      setRes(null);
      setBusy(false);
      return undefined;
    }
    setBusy(true);
    let alive = true;
    const id = setTimeout(async () => {
      /* One failing table must not blank the other three — a search
         that returns nothing because Posts errored looks exactly like
         a search that found nothing. */
      const settled = await Promise.all(
        [searchPeople, searchGroups, searchPlaces, searchPosts].map((fn) =>
          fn(term).catch(() => [])
        )
      );
      if (!alive) return;
      const [people, groups, places, posts] = settled;
      setRes({ people, groups, places, posts, term });
      setBusy(false);
      setRecents(rememberSearch(term));
    }, DEBOUNCE_MS);
    return () => {
      alive = false;
      clearTimeout(id);
    };
  }, [q]);

  const [asking, setAsking] = useState(null);
  /* Joining is not asking: it succeeds outright, so the row goes
     straight to "You are in" and the group appears in `mine`. */
  const join = async (id) => {
    setAsking(id);
    try {
      await joinPublicGroup(id);
      setMine(await myGroupIds());
    } catch {
      /* A refusal leaves the row as it was; nothing is claimed. */
    } finally {
      setAsking(null);
    }
  };

  const ask = async (id) => {
    setAsking(id);
    try {
      await requestToJoinGroup(id);
      /* MOTION_SPEC §7 — no toast. The row changing to "Asked" IS the
         confirmation; a banner saying the same thing is the app
         congratulating itself. */
      setAsked(await myJoinRequests());
    } catch {
      /* A refusal from the RPC (invite only, already a member, blocked)
         leaves the row exactly as it was. Nothing is claimed. */
    } finally {
      setAsking(null);
    }
  };

  const go = (to) => openFullScreen(navigate, to, "end");
  const empty =
    res &&
    !res.people.length &&
    !res.groups.length &&
    !res.places.length &&
    !res.posts.length;

  const sub = { display: "block", fontSize: ts(14), color: C.textMuted, marginTop: 2 };
  const name = { display: "block", fontSize: ts(17), fontWeight: 600, lineHeight: 1.3 };

  return (
    <>
      <AppHeader />
      <main
        className={arrivalClass(state)}
        style={{
          minHeight: "100vh",
          background: C.bg,
          color: C.textMain,
          fontFamily: meta.fonts.body,
          /* No side padding: the rows bleed to the screen edges. The
             search box puts its own back. */
          padding: "12px 0 80px",
        }}
      >
        <div style={{ maxWidth: 600, margin: "0 auto" }}>
          <label htmlFor="sb-search" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
            {t("search.title")}
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, padding: "0 16px" }}>
            <input
              id="sb-search"
              ref={boxRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("search.placeholder")}
              autoComplete="off"
              style={{
                flex: 1,
                minWidth: 0,
                minHeight: A11Y.minTapTargetPx,
                padding: "0 16px",
                borderRadius: 50,
                /* The one place an outline is right: this IS the
                   control, and it has to look like somewhere to type. */
                border: `2px solid ${C.warmGray}`,
                background: C.white,
                color: C.textMain,
                fontSize: ts(A11Y.minBodyPx),
                fontFamily: "inherit",
              }}
            />
            {q && (
              <button
                type="button"
                onClick={() => {
                  setQ("");
                  boxRef.current?.focus();
                }}
                aria-label={t("search.clear")}
                style={{
                  minHeight: A11Y.minTapTargetPx,
                  minWidth: A11Y.minTapTargetPx,
                  border: "none",
                  background: "none",
                  color: C.textMuted,
                  fontSize: ts(20),
                  cursor: "pointer",
                }}
              >
                <Icon name="close" size={20} />
              </button>
            )}
          </div>

          {/* ── Before typing: never a blank page (§5) ── */}
          {res === null && !busy && (
            <>
              {recents.length > 0 && (
                <Group title={t("search.recent")}>
                  {recents.map((r) => (
                    <Row key={r} onClick={() => setQ(r)} label={r}>
                      <Icon name="time" size={20} style={{ color: C.textMuted }} />
                      <span style={name}>{r}</span>
                    </Row>
                  ))}
                  <li>
                    <button
                      type="button"
                      onClick={() => setRecents(forgetRecents())}
                      style={{
                        minHeight: A11Y.minTapTargetPx,
                        border: "none",
                        background: "none",
                        color: C.green,
                        fontSize: ts(16),
                        fontWeight: 600,
                        fontFamily: "inherit",
                        textDecoration: "underline",
                        cursor: "pointer",
                        padding: "0 12px",
                      }}
                    >
                      {t("search.forget")}
                    </button>
                  </li>
                </Group>
              )}
              {suggested.length > 0 && (
                <Group title={t("search.suggested")}>
                  {suggested.map((g) => (
                    <GroupRow
                      key={g.id}
                      g={g}
                      mine={mine}
                      asked={asked}
                      busy={asking === g.id}
                      onAsk={() => ask(g.id)}
                      onJoin={() => join(g.id)}
                      onOpen={() => go(`/app/groups/${g.id}`)}
                    />
                  ))}
                </Group>
              )}
              {recents.length === 0 && suggested.length === 0 && (
                /* Nothing to suggest yet — no recents on this device
                   and no public groups in this community. Then the
                   screen says what search is FOR, which is a different
                   job from "try a shorter word": that is advice about
                   a search that has not happened yet. */
                <p style={{ fontSize: ts(16), color: C.textMuted, lineHeight: 1.6, margin: "8px 16px 0" }}>
                  {t("search.beforeTyping")}
                </p>
              )}
            </>
          )}

          {busy && (
            <p role="status" style={{ fontSize: ts(16), color: C.textMuted }}>
              {t("search.searching")}
            </p>
          )}

          {res && !busy && empty && (
            <>
              <p style={{ fontSize: ts(A11Y.minBodyPx), fontWeight: 600, margin: "0 16px 6px" }}>
                {t("search.nothing")}
              </p>
              <p style={{ fontSize: ts(16), color: C.textMuted, margin: "0 16px", lineHeight: 1.6 }}>
                {t("search.nothingHint")}
              </p>
            </>
          )}

          {res && !busy && !empty && (
            <>
              {res.people.length > 0 && (
                <Group title={t("search.people")}>
                  {res.people.map((p) => (
                    <Row
                      key={p.id}
                      onClick={() => go(`/app/people/${p.id}`)}
                      label={`${p.full_name}${p.city ? " — " + p.city : ""}`}
                    >
                      <span
                        aria-hidden="true"
                        style={{
                          width: 40,
                          height: 40,
                          flexShrink: 0,
                          borderRadius: "50%",
                          background: C.sage,
                          color: C.cream,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 800,
                        }}
                      >
                        {(p.full_name || "•").trim().charAt(0).toUpperCase()}
                      </span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={name}>{p.full_name}</span>
                        {p.city && <span style={sub}>{p.city}</span>}
                      </span>
                    </Row>
                  ))}
                </Group>
              )}

              {res.groups.length > 0 && (
                <Group title={t("search.groups")}>
                  {res.groups.map((g) => (
                    <GroupRow
                      key={g.id}
                      g={g}
                      mine={mine}
                      asked={asked}
                      busy={asking === g.id}
                      onAsk={() => ask(g.id)}
                      onJoin={() => join(g.id)}
                      onOpen={() => go(`/app/groups/${g.id}`)}
                    />
                  ))}
                </Group>
              )}

              {res.places.length > 0 && (
                <Group title={t("search.outdoor")}>
                  {res.places.map((pl) => (
                    <Row key={pl.id} onClick={() => go(`/app/outdoor/${pl.id}`)} label={pl.name}>
                      <Icon name="outdoor" size={22} style={{ color: C.green }} />
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={name}>{pl.name}</span>
                        <span style={sub}>
                          {[pl.area, pl.city].filter(Boolean).join(", ")}
                        </span>
                      </span>
                    </Row>
                  ))}
                </Group>
              )}

              {res.posts.length > 0 && (
                /* HALF-WIRED, KNOWINGLY. `?post=` is what POSTS_SPEC §8
                   wants — sharing a post lands you ON the post,
                   highlighted — but the Feed does not read the param
                   yet, so today this opens the feed with the post
                   somewhere in it. The param is sent anyway so the row
                   becomes correct the moment the posts lane wires §8,
                   rather than needing to be found again. */
                <Group title={t("search.posts")}>
                  {res.posts.map((p) => (
                    <Row
                      key={p.id}
                      onClick={() => go(`/app/community?post=${p.id}`)}
                      label={(p.body || "").slice(0, 80)}
                    >
                      <Icon name="messages" size={22} style={{ color: C.green }} />
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span
                          style={{
                            ...name,
                            fontWeight: 500,
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                          }}
                        >
                          {p.body}
                        </span>
                      </span>
                    </Row>
                  ))}
                </Group>
              )}
            </>
          )}
        </div>
      </main>
    </>
  );
}
